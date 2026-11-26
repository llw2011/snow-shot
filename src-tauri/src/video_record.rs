use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use tauri::{Manager, command};

use snow_shot_app_services::video_record_service::VideoFormat;
use snow_shot_app_services::video_record_service::VideoRecordService;

fn resolve_bundled_ffmpeg_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app
        .path()
        .resource_dir()
        .ok()?
        .join("bundled-plugins")
        .join("ffmpeg");
    dir.is_dir().then_some(dir)
}

#[command]
pub async fn video_record_init(
    app: tauri::AppHandle,
    video_service: tauri::State<'_, Arc<Mutex<VideoRecordService>>>,
    ffmpeg_plugin_dir: PathBuf,
) -> Result<(), String> {
    let bundled_dir = resolve_bundled_ffmpeg_dir(&app);
    let video_service = video_service.inner().clone();
    tokio::task::spawn_blocking(move || {
        let mut service = video_service
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        service.set_bundled_ffmpeg_dir(bundled_dir.as_deref());
        service.init(&ffmpeg_plugin_dir);
    })
    .await
    .map_err(|e| format!("Init video record failed: {}", e))
}

/// 开始视频录制
#[command]
pub async fn video_record_start(
    app: tauri::AppHandle,
    video_service: tauri::State<'_, Arc<Mutex<VideoRecordService>>>,
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
) -> Result<(), String> {
    log::info!(
        "[video_record_start] area=({},{}) to ({},{}), output={}, encoder={}, preset={}, fps={}",
        min_x,
        min_y,
        max_x,
        max_y,
        output_file,
        encoder,
        encoder_preset,
        frame_rate
    );

    let bundled_dir = resolve_bundled_ffmpeg_dir(&app);
    let video_service = video_service.inner().clone();

    tokio::task::spawn_blocking(move || {
        let mut service = video_service
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if bundled_dir.is_some() {
            service.set_bundled_ffmpeg_dir(bundled_dir.as_deref());
        }

        match service.start(
            min_x,
            min_y,
            max_x,
            max_y,
            output_file,
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
        ) {
            Ok(_) => {
                log::info!("[video_record_start] Video recording started successfully");
                Ok(())
            }
            Err(e) => {
                log::error!("[video_record_start] Video recording start failed: {}", e);
                Err(format!("Start recording failed: {}", e))
            }
        }
    })
    .await
    .map_err(|e| format!("Start recording task failed: {}", e))?
}

/// 停止视频录制
#[command]
pub async fn video_record_stop(
    video_service: tauri::State<'_, Arc<Mutex<VideoRecordService>>>,
    convert_to_gif: bool,
    gif_format: String,
    gif_frame_rate: u32,
    gif_max_width: i32,
    gif_max_height: i32,
) -> Result<Option<String>, String> {
    log::info!("[video_record_stop] Stopping video recording...");

    let video_service = video_service.inner().clone();
    tokio::task::spawn_blocking(move || {
        let mut service = video_service
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        match service.stop(
            convert_to_gif,
            &gif_format,
            gif_frame_rate,
            gif_max_width,
            gif_max_height,
        ) {
            Ok(final_filename) => {
                log::info!("[video_record_stop] Video recording stopped successfully");
                Ok(final_filename)
            }
            Err(e) => {
                log::error!("[video_record_stop] Video recording stop failed: {}", e);
                Err(format!("Stop recording failed: {}", e))
            }
        }
    })
    .await
    .map_err(|e| format!("Stop recording task failed: {}", e))?
}

/// 暂停视频录制
#[command]
pub async fn video_record_pause(
    video_service: tauri::State<'_, Arc<Mutex<VideoRecordService>>>,
) -> Result<(), String> {
    let video_service = video_service.inner().clone();
    tokio::task::spawn_blocking(move || {
        let mut service = video_service
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        match service.pause() {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Pause recording failed: {}", e)),
        }
    })
    .await
    .map_err(|e| format!("Pause recording task failed: {}", e))?
}

/// 恢复视频录制
#[command]
pub async fn video_record_resume(
    video_service: tauri::State<'_, Arc<Mutex<VideoRecordService>>>,
) -> Result<(), String> {
    let video_service = video_service.inner().clone();
    tokio::task::spawn_blocking(move || {
        let mut service = video_service
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        match service.resume() {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Resume recording failed: {}", e)),
        }
    })
    .await
    .map_err(|e| format!("Resume recording task failed: {}", e))?
}

#[command]
pub async fn video_record_get_microphone_device_names(
    app: tauri::AppHandle,
    video_service: tauri::State<'_, Arc<Mutex<VideoRecordService>>>,
) -> Result<Vec<String>, String> {
    let bundled_dir = resolve_bundled_ffmpeg_dir(&app);
    let video_service = video_service.inner().clone();
    tokio::task::spawn_blocking(move || {
        let mut service = video_service
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if bundled_dir.is_some() {
            service.set_bundled_ffmpeg_dir(bundled_dir.as_deref());
        }
        service.get_microphone_device_names()
    })
    .await
    .map_err(|e| format!("Get microphone devices task failed: {}", e))
}

#[command]
pub async fn video_record_kill(
    video_service: tauri::State<'_, Arc<Mutex<VideoRecordService>>>,
) -> Result<(), String> {
    let video_service = video_service.inner().clone();
    tokio::task::spawn_blocking(move || {
        let mut service = video_service
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        match service.kill() {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Kill recording failed: {}", e)),
        }
    })
    .await
    .map_err(|e| format!("Kill recording task failed: {}", e))?
}
