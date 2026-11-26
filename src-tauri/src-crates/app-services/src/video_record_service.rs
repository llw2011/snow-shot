use ffmpeg_sidecar::{child::FfmpegChild, command::FfmpegCommand, event::FfmpegEvent};
use regex::Regex;
use serde::{Deserialize, Serialize};
#[cfg(target_os = "macos")]
use snow_shot_app_utils::monitor_info::MonitorList;
use std::{
    collections::VecDeque,
    io::{BufReader, Read, Result},
    path::{Path, PathBuf},
    sync::mpsc,
    time::{Duration, Instant},
};

const RECORD_START_TIMEOUT: Duration = Duration::from_secs(10);
const RECORD_STOP_TIMEOUT: Duration = Duration::from_secs(5);
const STDERR_TAIL_LIMIT: usize = 40;

enum StartupSignal {
    Progress(String),
    Log(String),
    Eof,
}

fn find_ffmpeg_in_path() -> Option<PathBuf> {
    let binary_name = if cfg!(target_os = "windows") {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        let candidate = dir.join(binary_name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn is_live_progress_line(line: &str) -> bool {
    let trimmed = line.strip_prefix("[info]").unwrap_or(line).trim();
    if !trimmed.contains("frame=") || !trimmed.contains("time=") {
        return false;
    }

    let frame = trimmed
        .split("frame=")
        .nth(1)
        .and_then(|s| s.split_whitespace().next())
        .and_then(|s| s.parse::<u64>().ok());

    let Some(frame_count) = frame else {
        return false;
    };

    // FFmpeg prints a terminal summary with `Lsize= 0KiB time=N/A` right before
    // exiting on startup errors (e.g. gdigrab / encoder failure). Never treat a
    // zero-frame final summary line as an active recording.
    if trimmed.contains("Lsize=") && frame_count == 0 {
        return false;
    }

    let time_val = trimmed
        .split("time=")
        .nth(1)
        .and_then(|s| s.split_whitespace().next())
        .unwrap_or("N/A");

    frame_count > 0 || (time_val != "N/A" && !trimmed.contains("Lsize="))
}

fn summarize_ffmpeg_errors(lines: &VecDeque<String>) -> String {
    let error_lines: Vec<&str> = lines
        .iter()
        .map(|s| s.as_str())
        .filter(|line| {
            let lower = line.to_ascii_lowercase();
            lower.contains("[error]")
                || lower.contains("[fatal]")
                || lower.contains("failed")
                || lower.contains("error")
                || lower.contains("invalid")
                || lower.contains("cannot")
                || lower.contains("not found")
                || lower.contains("permission denied")
        })
        .collect();

    if !error_lines.is_empty() {
        let start = error_lines.len().saturating_sub(3);
        return error_lines[start..].join(" | ");
    }

    let tail: Vec<&str> = lines.iter().rev().take(3).map(|s| s.as_str()).collect();
    tail.into_iter().rev().collect::<Vec<_>>().join(" | ")
}

fn spawn_stderr_drainer(stderr: std::process::ChildStderr) -> mpsc::Receiver<StartupSignal> {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut reader = BufReader::new(stderr);
        let mut byte = [0u8; 1];
        let mut buf = Vec::with_capacity(256);
        let mut startup_channel_open = true;

        loop {
            match reader.read(&mut byte) {
                Ok(0) => {
                    if !buf.is_empty() && startup_channel_open {
                        let line = String::from_utf8_lossy(&buf).trim().to_string();
                        if !line.is_empty() {
                            let signal = if is_live_progress_line(&line) {
                                StartupSignal::Progress(line)
                            } else {
                                StartupSignal::Log(line)
                            };
                            let _ = tx.send(signal);
                        }
                    }
                    if startup_channel_open {
                        let _ = tx.send(StartupSignal::Eof);
                    }
                    break;
                }
                Ok(_) => {
                    if byte[0] == b'\r' || byte[0] == b'\n' {
                        if !buf.is_empty() {
                            if startup_channel_open {
                                let line = String::from_utf8_lossy(&buf).trim().to_string();
                                if !line.is_empty() {
                                    let signal = if is_live_progress_line(&line) {
                                        StartupSignal::Progress(line)
                                    } else {
                                        StartupSignal::Log(line)
                                    };
                                    if tx.send(signal).is_err() {
                                        // Keep draining stderr for the rest of FFmpeg's lifetime
                                        // so the pipe never fills up and stalls recording.
                                        startup_channel_open = false;
                                    }
                                }
                            }
                            buf.clear();
                        }
                    } else if buf.len() < 4096 {
                        buf.push(byte[0]);
                    }
                }
                Err(_) => {
                    if startup_channel_open {
                        let _ = tx.send(StartupSignal::Eof);
                    }
                    break;
                }
            }
        }
    });
    rx
}

fn wait_child_with_timeout(child: &mut FfmpegChild, timeout: Duration) {
    let deadline = Instant::now() + timeout;
    loop {
        match child.as_inner_mut().try_wait() {
            Ok(Some(_)) => return,
            Ok(None) => {
                if Instant::now() >= deadline {
                    log::warn!(
                        "[VideoRecordService] FFmpeg did not exit gracefully in time; killing process"
                    );
                    let _ = child.kill();
                    let _ = child.wait();
                    return;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                log::warn!("[VideoRecordService] try_wait failed: {}", e);
                let _ = child.kill();
                let _ = child.wait();
                return;
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn append_windows_encoder_quality_args(command: &mut FfmpegCommand, encoder: &str) {
    if encoder.contains("nvenc") {
        command.arg("-cq").arg("23");
    } else if encoder.contains("amf") {
        command
            .arg("-rc")
            .arg("cqp")
            .arg("-qp_i")
            .arg("23")
            .arg("-qp_p")
            .arg("23");
    } else {
        command.arg("-crf").arg("23");
    }
    command.arg("-pix_fmt").arg("yuv420p");
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Copy)]
pub enum VideoRecordState {
    Idle,
    Recording,
    Paused,
}

#[derive(PartialEq, Serialize, Deserialize, Debug, Clone, Copy)]
pub enum VideoFormat {
    Mp4,
    Gif,
}

impl VideoFormat {
    pub fn extension(&self) -> &str {
        match self {
            VideoFormat::Mp4 => "mp4",
            VideoFormat::Gif => "gif",
        }
    }
}

// 录制参数结构体，用于在暂停后恢复录制时重用参数
#[derive(Clone, Debug)]
struct RecordingParams {
    min_x: i32,
    min_y: i32,
    max_x: i32,
    max_y: i32,
    output_file: String,
    format: VideoFormat,
    frame_rate: u32,
    enable_microphone: bool,
    #[allow(unused)]
    enable_system_audio: bool,
    microphone_device_name: String,
    #[allow(unused)]
    hwaccel: bool,
    encoder: String,
    encoder_preset: String,
    video_max_width: i32,
    video_max_height: i32,
}

pub struct VideoRecordService {
    pub state: VideoRecordState,
    pub child: Option<FfmpegChild>,
    // 片段管理相关字段
    segments: Vec<String>,                     // 存储所有片段文件路径
    segment_counter: u32,                      // 片段计数器
    recording_params: Option<RecordingParams>, // 录制参数，用于恢复录制
    record_video_size: Option<(i32, i32)>,     // 录制视频大小
    ffmpeg_path: Option<PathBuf>,
}

#[cfg(target_os = "macos")]
#[derive(PartialEq, Serialize, Deserialize, Debug, Clone, Copy)]
pub enum DeviceType {
    Audio,
    Video,
}

#[cfg(target_os = "macos")]
#[derive(PartialEq, Serialize, Deserialize, Debug, Clone)]
pub struct DeviceInfo {
    pub name: String,
    pub index: usize,
    pub device_type: DeviceType,
}

impl VideoRecordService {
    pub fn new() -> Self {
        Self {
            state: VideoRecordState::Idle,
            child: None,
            segments: Vec::new(),
            segment_counter: 0,
            recording_params: None,
            record_video_size: None,
            ffmpeg_path: None,
        }
    }

    pub fn init(&mut self, ffmpeg_plugin_dir: &Path) {
        #[cfg(target_os = "windows")]
        {
            self.ffmpeg_path = Some(ffmpeg_plugin_dir.join("ffmpeg.exe"));
        }

        #[cfg(target_os = "macos")]
        {
            use std::fs;
            use std::os::unix::fs::PermissionsExt;

            let ffmpeg_path = ffmpeg_plugin_dir.join("ffmpeg");

            // 为 ffmpeg 文件添加可执行权限
            if ffmpeg_path.exists() {
                if let Ok(metadata) = fs::metadata(&ffmpeg_path) {
                    let mut permissions = metadata.permissions();
                    permissions.set_mode(0o755); // 设置可执行权限 (rwxr-xr-x)

                    if let Err(e) = fs::set_permissions(&ffmpeg_path, permissions) {
                        log::error!(
                            "[VideoRecordService] Failed to set executable permissions for ffmpeg: {}",
                            e
                        );
                    } else {
                        log::info!(
                            "[VideoRecordService] Successfully set executable permissions for ffmpeg"
                        );
                    }
                }
            }

            self.ffmpeg_path = Some(ffmpeg_path);
        }

        #[cfg(target_os = "linux")]
        {
            self.ffmpeg_path = Some(ffmpeg_plugin_dir.join("ffmpeg"));
        }
    }

    pub fn resolve_ffmpeg_path(&self) -> Result<PathBuf> {
        if let Some(configured) = self.ffmpeg_path.as_ref() {
            if configured.is_file() {
                return Ok(configured.clone());
            }
            log::warn!(
                "[VideoRecordService] Configured FFmpeg binary not found at {}; trying PATH fallback",
                configured.display()
            );
        }

        if let Some(from_path) = find_ffmpeg_in_path() {
            log::info!(
                "[VideoRecordService] Resolved FFmpeg binary from PATH: {}",
                from_path.display()
            );
            return Ok(from_path);
        }

        Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            match self.ffmpeg_path.as_ref() {
                Some(configured) => format!(
                    "[VideoRecordService] FFmpeg executable not found at {} or in system PATH",
                    configured.display()
                ),
                None => "[VideoRecordService] FFmpeg path is not configured and not found in system PATH"
                    .to_string(),
            },
        ))
    }

    pub fn get_ffmpeg_command(&self) -> Result<FfmpegCommand> {
        let ffmpeg_path = self.resolve_ffmpeg_path()?;
        Ok(FfmpegCommand::new_with_path(ffmpeg_path))
    }

    fn get_actual_video_size(
        &self,
        width: i32,
        height: i32,
        video_max_width: i32,
        video_max_height: i32,
    ) -> (i32, i32) {
        if width > video_max_width || height > video_max_height {
            // 计算保持宽高比的最大尺寸
            let max_width = video_max_width;
            let max_height = video_max_height;

            let scale_x = max_width as f64 / width as f64;
            let scale_y = max_height as f64 / height as f64;

            let target_size_scale = scale_x.min(scale_y);

            let mut target_width = (width as f64 * target_size_scale) as i32;
            let mut target_height = (height as f64 * target_size_scale) as i32;

            if target_width % 2 == 1 {
                target_width -= 1;
            }
            if target_height % 2 == 1 {
                target_height -= 1;
            }

            (target_width, target_height)
        } else {
            (width, height)
        }
    }

    pub fn start(
        &mut self,
        min_x: i32,
        min_y: i32,
        max_x: i32,
        max_y: i32,
        output_file: String,
        format: VideoFormat,
        frame_rate: u32,
        enable_microphone: bool,
        enable_system_audio: bool,
        microphone_device_name: String,
        hwaccel: bool,
        encoder: String,
        encoder_preset: String,
        video_max_width: i32,
        video_max_height: i32,
    ) -> Result<()> {
        if self.state == VideoRecordState::Recording {
            return Err(std::io::Error::new(
                std::io::ErrorKind::AlreadyExists,
                "Recording is already in progress",
            ));
        }

        // 保存录制参数
        self.recording_params = Some(RecordingParams {
            min_x,
            min_y,
            max_x,
            max_y,
            output_file: output_file.clone(),
            format,
            frame_rate,
            enable_microphone,
            enable_system_audio,
            microphone_device_name,
            hwaccel,
            encoder,
            encoder_preset,
            video_max_width,
            video_max_height,
        });

        // 重置片段相关状态
        self.segments.clear();
        self.segment_counter = 0;
        self.record_video_size = None;

        // 开始第一个片段的录制
        self.start_segment()
    }

    fn start_segment(&mut self) -> Result<()> {
        let params = self.recording_params.as_ref().ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Recording parameters are not initialized",
            )
        })?;

        // 计算录制区域的宽度和高度
        let mut width = params.max_x - params.min_x;
        let mut height = params.max_y - params.min_y;

        if width <= 0 || height <= 0 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Invalid recording area dimensions",
            ));
        }

        // 确保宽度和高度都是偶数（libx264要求）
        if width % 2 == 1 {
            width -= 1;
        }
        if height % 2 == 1 {
            height -= 1;
        }

        println!(
            "Recording segment {} area: {}x{} at ({}, {})",
            self.segment_counter + 1,
            width,
            height,
            params.min_x,
            params.min_y
        );

        let mut command = self.get_ffmpeg_command()?;

        // 硬件加速选项必须在输入选项之前；Windows gdigrab 输出原始 BMP，不适用解码硬件加速
        #[cfg(not(target_os = "windows"))]
        if params.hwaccel {
            command.arg("-hwaccel").arg("auto");
        }

        // 根据平台设置不同的输入格式
        #[cfg(target_os = "windows")]
        {
            // Windows 使用 gdigrab
            command
                .arg("-f")
                .arg("gdigrab")
                .arg("-framerate")
                .arg(params.frame_rate.to_string())
                // 设置偏移量
                .arg("-offset_x")
                .arg(params.min_x.to_string())
                .arg("-offset_y")
                .arg(params.min_y.to_string())
                // 设置录制区域大小
                .arg("-video_size")
                .arg(format!("{}x{}", width, height))
                // 输入源为桌面
                .arg("-i")
                .arg("desktop");
        }

        #[cfg(target_os = "macos")]
        {
            // macOS 使用 avfoundation
            command
                .arg("-f")
                .arg("avfoundation")
                .arg("-framerate")
                .arg(params.frame_rate.to_string());
        }

        let mut audio_input = String::new();

        // 根据平台添加音频输入
        #[cfg(target_os = "windows")]
        {
            // 添加系统音频输入
            if params.enable_system_audio {
                // command
                //     .arg("-f")
                //     .arg("dshow")
                //     .arg("-i")
                //     .arg("audio=virtual-audio-capturer");
                // audio_inputs.push("1:a".to_string());
            }

            // 添加麦克风音频输入
            if params.enable_microphone {
                let device_names = self.get_microphone_device_names();

                if device_names.len() > 0 {
                    command.arg("-f").arg("dshow").arg("-i").arg(format!(
                        "audio={}",
                        if device_names.contains(&params.microphone_device_name) {
                            params.microphone_device_name.clone()
                        } else {
                            device_names[0].clone()
                        }
                    ));
                    audio_input = format!("{}:a", 1);
                }
            }
        }

        #[cfg(target_os = "macos")]
        let monitor_list = MonitorList::all(true);
        #[cfg(target_os = "macos")]
        let mut target_monitor_index = 0;

        // macOS 音频输入处理
        #[cfg(target_os = "macos")]
        {
            let device_info_list = self.get_device_info_list();

            let audio_device = if params.enable_microphone {
                device_info_list.iter().find(|d| {
                    d.device_type == DeviceType::Audio
                        && Self::format_device_name(d) == params.microphone_device_name
                })
            } else {
                None
            };

            // 没有找到对应的显示器，回退到默认显示器
            for (monitor_index, monitor) in monitor_list.iter().enumerate() {
                use snow_shot_app_shared::ElementRect;

                if monitor.rect.overlaps(&ElementRect {
                    min_x: params.min_x,
                    min_y: params.min_y,
                    max_x: params.max_x,
                    max_y: params.max_y,
                }) {
                    target_monitor_index = monitor_index;
                    break;
                }
            }

            // 判断是否存在对应的显示器
            if !device_info_list.iter().any(|d| {
                d.device_type == DeviceType::Video
                    && d.name == format!("Capture screen {}", target_monitor_index)
            }) {
                target_monitor_index = 0;
                log::warn!(
                    "[video_record_service::start_segment] No corresponding display found for microphone device: {}",
                    params.microphone_device_name
                );
            }

            if let Some(audio_device) = audio_device {
                // 格式: -f avfoundation -i "0:设备索引"
                command
                    .arg("-i")
                    .arg(format!("{}:{}", target_monitor_index, audio_device.index));
                audio_input = format!("{}:a", audio_device.index);
            } else {
                command.arg("-i").arg(format!("{}", target_monitor_index));
            }
        }

        // 生成当前片段的文件名
        let segment_filename = format!(
            "{}_segment_{:03}.{}",
            params.output_file,
            self.segment_counter,
            params.format.extension()
        );

        // 确保输出文件的目录存在
        if let Some(parent_dir) = std::path::Path::new(&segment_filename).parent() {
            if let Err(e) = std::fs::create_dir_all(parent_dir) {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to create output directory: {}", e),
                ));
            }
        }

        let mut video_filter = String::new();
        let (target_width, target_height) = self.get_actual_video_size(
            width,
            height,
            params.video_max_width,
            params.video_max_height,
        );
        if target_width != width || target_height != height {
            video_filter = format!("scale={}:{}:flags=lanczos", target_width, target_height);
            println!(
                "Scaling video from {}x{} to {}x{}",
                width, height, target_width, target_height
            );
        }
        self.record_video_size = Some((target_width, target_height));

        // 根据格式设置不同的参数
        match params.format {
            VideoFormat::Mp4 => {
                command.arg("-c:v").arg(&params.encoder);

                // 根据编码器类型设置预设值
                if params.encoder.contains("amf") {
                    // AMD AMF编码器只支持特定的预设值
                    let amf_preset = match params.encoder_preset.as_str() {
                        "ultrafast" | "superfast" | "veryfast" | "faster" | "fast" => "speed",
                        "medium" | "slow" => "balanced",
                        "slower" | "veryslow" | "placebo" => "quality",
                        // 如果已经是AMF支持的预设值，直接使用
                        "speed" | "balanced" | "quality" => &params.encoder_preset,
                        _ => "balanced", // 默认使用balanced
                    };
                    command.arg("-preset").arg(amf_preset);
                } else if params.encoder.contains("nvenc") {
                    // NVIDIA NVENC编码器支持的预设值
                    let nvenc_preset = match params.encoder_preset.as_str() {
                        "ultrafast" => "p1",              // 最快
                        "superfast" | "veryfast" => "p2", // 更快
                        "faster" | "fast" => "p3",        // 快
                        "medium" => "p4",                 // 中等（默认）
                        "slow" => "p5",                   // 慢
                        "slower" => "p6",                 // 更慢
                        "veryslow" | "placebo" => "p7",   // 最慢
                        // 如果已经是NVENC支持的预设值，直接使用
                        "p1" | "p2" | "p3" | "p4" | "p5" | "p6" | "p7" | "hq" | "hp" | "ll"
                        | "llhq" | "llhp" | "default" | "bd" | "lossless" | "losslesshp" => {
                            &params.encoder_preset
                        }
                        _ => "p4", // 默认使用p4（中等）
                    };
                    command.arg("-preset").arg(nvenc_preset);
                } else {
                    // 其他编码器（如x264）使用原始预设值
                    command.arg("-preset").arg(&params.encoder_preset);
                }

                #[cfg(target_os = "windows")]
                {
                    if !video_filter.is_empty() {
                        command.arg("-vf").arg(&video_filter);
                    }

                    append_windows_encoder_quality_args(&mut command, &params.encoder);
                }

                #[cfg(target_os = "macos")]
                {
                    let target_monitor_rect =
                        if let Some(monitor) = monitor_list.iter().nth(target_monitor_index) {
                            monitor.rect
                        } else {
                            snow_shot_app_shared::ElementRect {
                                min_x: 0,
                                min_y: 0,
                                max_x: 0,
                                max_y: 0,
                            }
                        };

                    let crop_filter = format!(
                        "crop={}:{}:{}:{}",
                        width,
                        height,
                        (params.min_x - target_monitor_rect.min_x),
                        (params.min_y - target_monitor_rect.min_y)
                    );

                    // 组合 video_filter 和 crop_filter
                    let final_filter = if !video_filter.is_empty() {
                        format!("{},{}", crop_filter, video_filter)
                    } else {
                        crop_filter
                    };

                    command.arg("-vf").arg(final_filter);
                    command.arg("-crf").arg("23").arg("-pix_fmt").arg("uyvy422"); // 添加像素格式，确保兼容性
                }

                // 音频编码设置
                if !audio_input.is_empty() {
                    command.arg("-c:a").arg("aac").arg("-b:a").arg("128k");

                    // 音频处理，添加降噪
                    let filter_complex =
                        format!("[{}]anlmdn=s=10:p=0.001:r=0.005[aout]", audio_input);
                    command.arg("-filter_complex").arg(filter_complex);
                    command.arg("-map").arg("0:v").arg("-map").arg("[aout]");
                } else {
                    // 没有音频输入时，只映射视频
                    command.arg("-map").arg("0:v");
                }

                command.arg("-movflags").arg("+faststart"); // 优化MP4文件结构
            }
            VideoFormat::Gif => {
                // GIF格式不包含音频
                command
                    .arg("-vf")
                    .arg("fps=10,scale=-1:-1:flags=lanczos,palettegen=reserve_transparent=0")
                    .arg("-loop")
                    .arg("0");
            }
        }

        command.arg("-y");

        // 输出文件
        command.arg(&segment_filename);

        log::info!("[VideoRecordService] FFmpeg segment command: {:?}", command);

        // 启动ffmpeg进程
        match command.spawn() {
            Ok(mut child) => {
                let Some(stderr) = child.take_stderr() else {
                    let _ = child.kill();
                    let _ = child.wait();
                    self.state = VideoRecordState::Idle;
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        "Failed to capture FFmpeg stderr",
                    ));
                };

                let rx = spawn_stderr_drainer(stderr);
                let deadline = Instant::now() + RECORD_START_TIMEOUT;
                let mut recent_logs: VecDeque<String> = VecDeque::with_capacity(STDERR_TAIL_LIMIT);

                loop {
                    let remaining = deadline.saturating_duration_since(Instant::now());
                    if remaining.is_zero() {
                        let summary = summarize_ffmpeg_errors(&recent_logs);
                        log::error!(
                            "[VideoRecordService] Timed out waiting for FFmpeg recording startup. Recent stderr: {}",
                            summary
                        );
                        let _ = child.kill();
                        let _ = child.wait();
                        self.state = VideoRecordState::Idle;
                        return Err(std::io::Error::new(
                            std::io::ErrorKind::TimedOut,
                            if summary.is_empty() {
                                "Timed out waiting for FFmpeg to start recording".to_string()
                            } else {
                                format!(
                                    "Timed out waiting for FFmpeg to start recording: {}",
                                    summary
                                )
                            },
                        ));
                    }

                    match rx.recv_timeout(remaining.min(Duration::from_millis(100))) {
                        Ok(StartupSignal::Progress(line)) => {
                            // Confirm process is still running (didn't fail immediately after emitting line)
                            if let Ok(Some(status)) = child.as_inner_mut().try_wait() {
                                let summary = summarize_ffmpeg_errors(&recent_logs);
                                log::error!(
                                    "[VideoRecordService] FFmpeg exited ({}) immediately after progress line ({}): {}",
                                    status,
                                    line,
                                    summary
                                );
                                self.state = VideoRecordState::Idle;
                                return Err(std::io::Error::new(
                                    std::io::ErrorKind::Other,
                                    if summary.is_empty() {
                                        format!("FFmpeg exited immediately with status {}", status)
                                    } else {
                                        format!("FFmpeg exited ({}): {}", status, summary)
                                    },
                                ));
                            }

                            log::info!("[VideoRecordService] Recording started: {}", line);
                            self.child = Some(child);
                            self.state = VideoRecordState::Recording;
                            self.segments.push(segment_filename);
                            self.segment_counter += 1;
                            return Ok(());
                        }
                        Ok(StartupSignal::Log(line)) => {
                            if recent_logs.len() >= STDERR_TAIL_LIMIT {
                                recent_logs.pop_front();
                            }
                            recent_logs.push_back(line);
                        }
                        Ok(StartupSignal::Eof) | Err(mpsc::RecvTimeoutError::Disconnected) => {
                            let status_text = match child.wait() {
                                Ok(status) => status.to_string(),
                                Err(e) => format!("wait error: {}", e),
                            };
                            let summary = summarize_ffmpeg_errors(&recent_logs);
                            log::error!(
                                "[VideoRecordService] FFmpeg exited before recording started ({}): {}",
                                status_text,
                                summary
                            );
                            self.state = VideoRecordState::Idle;
                            return Err(std::io::Error::new(
                                std::io::ErrorKind::Other,
                                if summary.is_empty() {
                                    format!(
                                        "Failed to start recording segment (FFmpeg exited: {})",
                                        status_text
                                    )
                                } else {
                                    format!("FFmpeg failed to start ({}): {}", status_text, summary)
                                },
                            ));
                        }
                        Err(mpsc::RecvTimeoutError::Timeout) => {
                            if let Ok(Some(status)) = child.as_inner_mut().try_wait() {
                                // Drain any buffered stderr lines for diagnostics
                                while let Ok(signal) = rx.try_recv() {
                                    if let StartupSignal::Log(line) = signal {
                                        if recent_logs.len() >= STDERR_TAIL_LIMIT {
                                            recent_logs.pop_front();
                                        }
                                        recent_logs.push_back(line);
                                    }
                                }
                                let summary = summarize_ffmpeg_errors(&recent_logs);
                                log::error!(
                                    "[VideoRecordService] FFmpeg terminated during startup ({}): {}",
                                    status,
                                    summary
                                );
                                self.state = VideoRecordState::Idle;
                                return Err(std::io::Error::new(
                                    std::io::ErrorKind::Other,
                                    if summary.is_empty() {
                                        format!("FFmpeg terminated during startup ({})", status)
                                    } else {
                                        format!("FFmpeg failed to start ({}): {}", status, summary)
                                    },
                                ));
                            }
                        }
                    }
                }
            }
            Err(e) => {
                self.state = VideoRecordState::Idle;
                log::error!("[VideoRecordService] FFmpeg spawn error: {}", e);
                Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to start recording segment: {}", e),
                ))
            }
        }
    }

    #[cfg(target_os = "macos")]
    pub fn get_device_info_list(&self) -> Vec<DeviceInfo> {
        let mut device_info_list = Vec::new();

        let mut command = match self.get_ffmpeg_command() {
            Ok(command) => command,
            Err(e) => {
                log::error!(
                    "[get_device_info_list] Failed to create ffmpeg command: {}",
                    e
                );
                return device_info_list;
            }
        };
        command
            .arg("-list_devices")
            .arg("true")
            .arg("-f")
            .arg("avfoundation")
            .arg("-i")
            .arg("dummy");

        log::info!("FFmpeg get_device_info_list command (macOS): {:?}", command);

        let mut child = match command.spawn() {
            Ok(child) => child,
            Err(e) => {
                log::error!("[get_device_info_list] Failed to spawn ffmpeg: {}", e);
                return device_info_list;
            }
        };

        let output_iter = match child.iter() {
            Ok(output) => output,
            Err(e) => {
                log::error!("[get_device_info_list] Failed to iter ffmpeg: {}", e);
                return device_info_list;
            }
        };

        // macOS avfoundation 格式的正则表达式
        // 格式: [AVFoundation indev @ 0x...] [info] [0] 设备名称
        let device_regex =
            match Regex::new(r#"\[AVFoundation indev @ [^\]]+\]\s+\[info\]\s+\[(\d+)\]\s+(.+)"#) {
                Ok(regex) => regex,
                Err(e) => {
                    log::error!("[get_device_info_list] Failed to create regex: {}", e);
                    return device_info_list;
                }
            };

        // 检测当前正在解析的设备类型
        let mut current_device_type = DeviceType::Video;

        for line in output_iter {
            match line {
                FfmpegEvent::Log(_, line) => {
                    // 检查是否遇到了视频设备列表的标记
                    if line.contains("AVFoundation video devices") {
                        current_device_type = DeviceType::Video;
                        log::info!(
                            "[get_device_info_list] Found video devices marker, starting to parse devices"
                        );
                        continue;
                    }

                    // 检查是否遇到了音频设备列表的标记
                    if line.contains("AVFoundation audio devices") {
                        current_device_type = DeviceType::Audio;
                        log::info!(
                            "[get_device_info_list] Found audio devices marker, starting to parse devices"
                        );
                        continue;
                    }

                    if let Some(captures) = device_regex.captures(&line) {
                        let device_index = match captures.get(1) {
                            Some(device_index) => device_index.as_str(),
                            None => continue,
                        };
                        let device_name = match captures.get(2) {
                            Some(device_name) => device_name.as_str().to_string(),
                            None => continue,
                        };
                        let device_index = match device_index.parse::<usize>() {
                            Ok(device_index) => device_index,
                            Err(e) => {
                                log::warn!(
                                    "[get_device_info_list] Failed to parse device index: {}",
                                    e
                                );
                                continue;
                            }
                        };
                        device_info_list.push(DeviceInfo {
                            name: device_name,
                            index: device_index,
                            device_type: current_device_type,
                        });
                    }
                }
                _ => {}
            }
        }

        let _ = child.wait();

        log::info!(
            "[get_device_names] Total found devices: {}",
            device_info_list.len()
        );
        device_info_list
    }

    #[cfg(target_os = "macos")]
    fn format_device_name(device_info: &DeviceInfo) -> String {
        format!("[{}] {}", device_info.index, device_info.name)
    }

    pub fn get_microphone_device_names(&self) -> Vec<String> {
        let mut device_names = Vec::new();

        #[cfg(target_os = "windows")]
        {
            let mut command = match self.get_ffmpeg_command() {
                Ok(command) => command,
                Err(e) => {
                    println!(
                        "[get_microphone_device_names] Failed to create ffmpeg command: {}",
                        e
                    );
                    return device_names;
                }
            };
            command
                .arg("-list_devices")
                .arg("true")
                .arg("-f")
                .arg("dshow")
                .arg("-i")
                .arg("dummy");

            let mut child = match command.spawn() {
                Ok(child) => child,
                Err(e) => {
                    println!(
                        "[get_microphone_device_names] Failed to spawn ffmpeg: {}",
                        e
                    );
                    return device_names;
                }
            };

            let output_iter = match child.iter() {
                Ok(output) => output,
                Err(e) => {
                    println!("[get_microphone_device_names] Failed to iter ffmpeg: {}", e);
                    return device_names;
                }
            };

            // Windows dshow 格式的正则表达式
            // 格式: [dshow @ address] [info] "设备名称" (audio)
            let device_regex = match Regex::new(r#"\[info\]\s+"([^"]+)"\s+\(audio\)"#) {
                Ok(regex) => regex,
                Err(e) => {
                    println!(
                        "[get_microphone_device_names] Failed to create regex: {}",
                        e
                    );
                    return device_names;
                }
            };

            for line in output_iter {
                match line {
                    FfmpegEvent::Log(_, line) => {
                        // 使用正则表达式解析音频设备
                        if let Some(captures) = device_regex.captures(&line) {
                            if let Some(device_name) = captures.get(1) {
                                let name = device_name.as_str().to_string();
                                device_names.push(name.clone());
                                println!(
                                    "[get_microphone_device_names] Found audio device: {}",
                                    name
                                );
                            }
                        }
                    }
                    _ => {}
                }
            }

            let _ = child.wait();
        }

        #[cfg(target_os = "macos")]
        {
            let device_info_list = self.get_device_info_list();
            for device_info in device_info_list {
                if device_info.device_type == DeviceType::Audio {
                    device_names.push(Self::format_device_name(&device_info));
                }
            }
        }

        println!(
            "[get_microphone_device_names] Total found devices: {}",
            device_names.len()
        );
        device_names
    }

    /// 根据设备名称获取设备索引
    /// 返回 Option<u32>，如果找不到设备则返回 None
    pub fn get_microphone_device_index(&self, device_name: &str) -> Option<u32> {
        // 使用正则表达式从设备名称中提取索引
        // 设备名称格式: [0] 设备名称
        if let Ok(device_index_regex) = Regex::new(r#"\[(\d+)\]\s+(.+)"#) {
            if let Some(captures) = device_index_regex.captures(device_name) {
                if let Some(index_match) = captures.get(1) {
                    if let Ok(device_index) = index_match.as_str().parse::<u32>() {
                        println!(
                            "[get_microphone_device_index] Found device index {} for device: {}",
                            device_index, device_name
                        );
                        return Some(device_index);
                    }
                }
            }
        }

        println!(
            "[get_microphone_device_index] Failed to extract index from device name: {}",
            device_name
        );
        None
    }

    pub fn kill(&mut self) -> Result<()> {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
        }

        self.cleanup();
        Ok(())
    }

    fn get_final_filename(&self) -> Result<String> {
        let params = self.recording_params.as_ref().ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Recording parameters are not initialized",
            )
        })?;
        Ok(format!(
            "{}.{}",
            params.output_file,
            params.format.extension()
        ))
    }

    pub fn stop(
        &mut self,
        convert_to_gif: bool,
        gif_format: &str,
        gif_frame_rate: u32,
        gif_max_width: i32,
        gif_max_height: i32,
    ) -> Result<Option<String>> {
        if self.state != VideoRecordState::Recording && self.state != VideoRecordState::Paused {
            return Ok(None);
        }

        log::info!("[VideoRecordService] Stopping and merging segments");

        // 停止当前录制（有界等待，防止 ffmpeg 忽略 q 时无限阻塞）
        if let Some(mut child) = self.child.take() {
            let _ = child.quit();
            wait_child_with_timeout(&mut child, RECORD_STOP_TIMEOUT);
        }

        // 如果只有一个片段，直接重命名
        let mut final_filename = self.get_final_filename()?;
        if self.segments.len() == 1 {
            if let Err(e) = std::fs::rename(&self.segments[0], &final_filename) {
                log::error!(
                    "[VideoRecordService] Failed to rename single segment: {}",
                    e
                );
                self.cleanup();
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to rename segment: {}", e),
                ));
            }
        } else if self.segments.len() > 1 {
            // 多个片段需要合并
            if let Err(e) = self.merge_segments(final_filename.clone()) {
                self.cleanup();
                return Err(e);
            }
        }

        // 如果需要转换为GIF格式
        let params = self.recording_params.as_ref().ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Recording parameters are not initialized",
            )
        })?;
        if convert_to_gif && params.format == VideoFormat::Mp4 {
            final_filename = self.convert_to_gif(
                gif_format,
                &final_filename,
                gif_frame_rate,
                gif_max_width,
                gif_max_height,
            )?;
        }

        self.cleanup();
        Ok(Some(final_filename))
    }

    fn merge_segments(&mut self, final_filename: String) -> Result<()> {
        let params = self.recording_params.as_ref().ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Recording parameters are not initialized",
            )
        })?;

        // 创建临时的文件列表
        let list_filename = format!("{}_segments.txt", params.output_file);
        let mut list_content = String::new();

        for segment in &self.segments {
            list_content.push_str(&format!("file '{}'\n", segment));
        }

        if let Err(e) = std::fs::write(&list_filename, list_content) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to create segment list: {}", e),
            ));
        }

        // 使用ffmpeg合并片段
        let mut command = self.get_ffmpeg_command()?;
        command
            .arg("-f")
            .arg("concat")
            .arg("-safe")
            .arg("0")
            .arg("-i")
            .arg(&list_filename)
            .arg("-c")
            .arg("copy")
            .arg("-y")
            .arg(&final_filename);

        println!("Merging segments with command: {:?}", command);

        match command.spawn() {
            Ok(mut child) => {
                let _ = child.wait();

                // 删除临时文件列表
                let _ = std::fs::remove_file(&list_filename);

                // 删除所有片段文件
                for segment in &self.segments {
                    if let Err(e) = std::fs::remove_file(segment) {
                        println!("Warning: Failed to delete segment file {}: {}", segment, e);
                    }
                }

                println!("Segments merged successfully");
                Ok(())
            }
            Err(e) => {
                println!("Failed to merge segments: {}", e);
                Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to merge segments: {}", e),
                ))
            }
        }
    }

    fn convert_to_gif(
        &self,
        format: &str,
        mp4_filename: &str,
        gif_frame_rate: u32,
        gif_max_width: i32,
        gif_max_height: i32,
    ) -> Result<String> {
        let params = self.recording_params.as_ref().ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Recording parameters are not initialized",
            )
        })?;

        // 生成输出文件名
        let output_filename = if format == "apng" {
            format!("{}.png", params.output_file)
        } else if format == "webp" {
            format!("{}.webp", params.output_file)
        } else {
            format!("{}.gif", params.output_file)
        };

        let format_name = if format == "apng" {
            "APNG"
        } else if format == "webp" {
            "WEBP"
        } else {
            "GIF"
        };
        println!(
            "[FFmpeg] Converting MP4 to {}: {} -> {}",
            format_name, mp4_filename, output_filename
        );

        // 确保输出文件的目录存在
        if let Some(parent_dir) = std::path::Path::new(&output_filename).parent() {
            if let Err(e) = std::fs::create_dir_all(parent_dir) {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to create output directory: {}", e),
                ));
            }
        }

        let (video_width, video_height) = self.record_video_size.ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Recorded video size is not initialized",
            )
        })?;

        let (target_width, target_height) =
            self.get_actual_video_size(video_width, video_height, gif_max_width, gif_max_height);

        let scale_filter = if target_width != video_width || target_height != video_height {
            format!("scale={}:{}:flags=lanczos", target_width, target_height)
        } else {
            format!("scale=-1:-1:flags=lanczos")
        };

        // 构建FFmpeg命令进行MP4到GIF/APNG的转换
        let mut command = self.get_ffmpeg_command()?;

        if format == "apng" {
            // APNG格式转换 - 平衡版本
            // APNG 是无损格式，通过压缩级别和预测模式优化
            // 优化策略（平衡模式）：
            // 1. compression_level=6：中等偏高的压缩级别，速度和大小平衡
            // 2. pred=mixed：混合预测模式，对大多数内容压缩效果最好
            command
                .arg("-i")
                .arg(mp4_filename)
                .arg("-vf")
                .arg(format!("fps={},{}", gif_frame_rate, scale_filter))
                .arg("-f")
                .arg("apng")
                .arg("-plays")
                .arg("0") // 无限循环
                .arg("-compression_level")
                .arg("6")
                .arg("-pred")
                .arg("mixed")
                .arg("-y")
                .arg(&output_filename);
        } else if format == "webp" {
            // WEBP格式转换 - 平衡版本，适合日常使用
            // WEBP 支持有损和无损压缩，这里使用有损模式获得更好的压缩率
            // 优化策略（平衡模式）：
            // 1. lossless=0：使用有损压缩模式（文件更小）
            // 2. quality=85：质量设为85（0-100），保证良好视觉效果
            // 3. compression_level=4：中等压缩级别，速度和大小平衡
            // 4. method=4：中等压缩方法，编码速度较快
            command
                .arg("-i")
                .arg(mp4_filename)
                .arg("-vf")
                .arg(format!("fps={},{}", gif_frame_rate, scale_filter))
                .arg("-f")
                .arg("webp")
                .arg("-lossless")
                .arg("0")
                .arg("-quality")
                .arg("85")
                .arg("-compression_level")
                .arg("4")
                .arg("-method")
                .arg("4")
                .arg("-loop")
                .arg("0") // 无限循环
                .arg("-y")
                .arg(&output_filename);
        } else {
            // GIF格式转换 - 平衡版本，适合日常使用
            // 优化策略（平衡模式）：
            // 1. max_colors=192：保留较多颜色，保证视觉质量
            // 2. 使用 diff 统计模式以更好地处理动画
            // 3. 使用 floyd_steinberg 抖动算法提高视觉质量
            // 4. diff_mode=rectangle 优化动画压缩
            command
                .arg("-i")
                .arg(mp4_filename)
                .arg("-vf")
                .arg(format!(
                    "fps={},{},split[s0][s1];[s0]palettegen=max_colors=192:stats_mode=diff[p];[s1][p]paletteuse=dither=floyd_steinberg:diff_mode=rectangle",
                    gif_frame_rate, scale_filter,
                ))
                .arg("-loop")
                .arg("0")
                .arg("-y")
                .arg(&output_filename);
        }

        println!("FFmpeg {} conversion command: {:?}", format_name, command);

        match command.spawn() {
            Ok(mut child) => {
                let _ = child.wait();

                // 检查输出文件是否成功生成
                if std::path::Path::new(&output_filename).exists() {
                    println!(
                        "{} conversion completed successfully: {}",
                        format_name, output_filename
                    );

                    // 删除原始MP4文件
                    if let Err(e) = std::fs::remove_file(mp4_filename) {
                        println!(
                            "Warning: Failed to delete original MP4 file {}: {}",
                            mp4_filename, e
                        );
                    }

                    Ok(output_filename)
                } else {
                    Err(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        format!("{} conversion failed - output file not found", format_name),
                    ))
                }
            }
            Err(e) => {
                println!("Failed to convert MP4 to {}: {}", format_name, e);
                Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to convert MP4 to {}: {}", format_name, e),
                ))
            }
        }
    }

    fn cleanup(&mut self) {
        self.state = VideoRecordState::Idle;
        self.segments.clear();
        self.segment_counter = 0;
        self.recording_params = None;
    }

    pub fn pause(&mut self) -> Result<()> {
        if self.state != VideoRecordState::Recording {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "No recording in progress",
            ));
        }

        log::info!("[VideoRecordService] Pausing recording - stopping current segment");

        // 停止当前片段的录制
        if let Some(mut child) = self.child.take() {
            let _ = child.quit();
            wait_child_with_timeout(&mut child, RECORD_STOP_TIMEOUT);
        }

        self.state = VideoRecordState::Paused;
        Ok(())
    }

    pub fn resume(&mut self) -> Result<()> {
        if self.state != VideoRecordState::Paused {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Recording is not paused",
            ));
        }

        log::info!("[VideoRecordService] Resuming recording - starting new segment");

        // 开始新片段的录制
        self.start_segment()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_live_progress_across_ffmpeg_versions() {
        assert!(is_live_progress_line(
            "[info] frame=   16 fps=0.0 q=16.0 size=       0KiB time=00:00:00.66 bitrate=   0.6kbits/s speed= 1.3x elapsed=0:00:00.51"
        ));
        assert!(is_live_progress_line(
            "frame=   24 fps=24.0 q=28.0 size=     256kB time=00:00:01.00 bitrate=2097.2kbits/s speed=1.00x"
        ));
        assert!(is_live_progress_line(
            "[info] frame=  120 fps=30.0 q=23.0 size=       2MiB time=00:00:04.00 bitrate=4194.3kbits/s speed=1.00x"
        ));
        assert!(is_live_progress_line(
            "[info] frame=    1 fps=0.0 q=0.0 size=       0B time=00:00:00.04 bitrate=N/A speed=N/A"
        ));
        assert!(!is_live_progress_line(
            "frame=    0 fps=0.0 q=0.0 Lsize=       0KiB time=N/A bitrate=N/A speed=N/A elapsed=0:00:00.00"
        ));
        assert!(!is_live_progress_line(
            "[in#0/gdigrab @ 000001] Failed to capture image (error 5)"
        ));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn selects_encoder_specific_quality_flags_on_windows() {
        let mut x264 = FfmpegCommand::new_with_path("ffmpeg.exe");
        append_windows_encoder_quality_args(&mut x264, "libx264");
        let x264_args: Vec<String> = x264
            .get_args()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        assert!(x264_args.contains(&"-crf".to_string()));
        assert!(!x264_args.contains(&"-cq".to_string()));

        let mut nvenc = FfmpegCommand::new_with_path("ffmpeg.exe");
        append_windows_encoder_quality_args(&mut nvenc, "h264_nvenc");
        let nvenc_args: Vec<String> = nvenc
            .get_args()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        assert!(nvenc_args.contains(&"-cq".to_string()));
        assert!(!nvenc_args.contains(&"-crf".to_string()));

        let mut amf = FfmpegCommand::new_with_path("ffmpeg.exe");
        append_windows_encoder_quality_args(&mut amf, "h264_amf");
        let amf_args: Vec<String> = amf
            .get_args()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        assert!(amf_args.contains(&"-qp_i".to_string()));
        assert!(!amf_args.contains(&"-crf".to_string()));
    }

    #[test]
    fn init_updates_configured_path_on_reinstall() {
        let mut service = VideoRecordService::new();
        service.init(Path::new("/first/dir"));
        let first = service.ffmpeg_path.clone().unwrap();
        service.init(Path::new("/second/dir"));
        let second = service.ffmpeg_path.clone().unwrap();
        assert_ne!(first, second);
        assert!(second.starts_with(Path::new("/second/dir")));
    }

    #[test]
    fn summarizes_ffmpeg_error_lines() {
        let mut logs = VecDeque::new();
        logs.push_back("[info] Input #0, gdigrab".to_string());
        logs.push_back("[in#0/gdigrab] Failed to capture image (error 5)".to_string());
        logs.push_back("[out#0/mp4] Nothing was written into output file".to_string());
        let summary = summarize_ffmpeg_errors(&logs);
        assert!(summary.contains("Failed to capture image"));
    }
}
