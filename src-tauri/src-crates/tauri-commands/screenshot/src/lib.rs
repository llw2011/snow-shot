use image::DynamicImage;
use rayon::iter::{IntoParallelIterator, IntoParallelRefIterator, ParallelIterator};
use serde::Serialize;
use snow_shot_app_os::ui_automation::UIElements;
use snow_shot_app_shared::ElementRect;
use snow_shot_app_utils::monitor_info::{
    CaptureOption, ColorFormat, CorrectHdrColorAlgorithm, MonitorList,
};
use snow_shot_global_state::WebViewSharedBufferState;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::ipc::Response;
use tokio::sync::Mutex;

pub async fn capture_current_monitor(
    #[allow(unused_variables)] window: tauri::Window,
    encoder: String,
) -> Result<Response, String> {
    // 获取当前鼠标的位置
    let (_, _, monitor) = snow_shot_app_utils::get_target_monitor()?;

    let image_buffer = match snow_shot_app_utils::capture_target_monitor(
        &monitor,
        None,
        Some(&window),
        ColorFormat::Rgb8,
    ) {
        Some(image) => image,
        None => {
            log::error!("Failed to capture current monitor");
            return Ok(Response::new(Vec::new()));
        }
    };

    let image_buffer = snow_shot_app_utils::encode_image(
        &image_buffer,
        match encoder.as_str() {
            "webp" => snow_shot_app_utils::ImageEncoder::Webp,
            "png" => snow_shot_app_utils::ImageEncoder::Png,
            _ => snow_shot_app_utils::ImageEncoder::Webp,
        },
    );

    Ok(Response::new(image_buffer))
}

pub async fn capture_all_monitors(
    app_handle: tauri::AppHandle,
    window: tauri::Window,
    #[allow(unused_variables)] webview: tauri::Webview,
    #[allow(unused_variables)] webview_shared_buffer_state: tauri::State<
        '_,
        WebViewSharedBufferState,
    >,
    enable_multiple_monitor: bool,
    correct_hdr_color_algorithm: CorrectHdrColorAlgorithm,
    correct_color_filter: bool,
) -> Result<Response, String> {
    #[cfg(target_os = "macos")]
    {
        let image = snow_shot_app_utils::get_capture_monitor_list(
            &app_handle,
            None,
            enable_multiple_monitor,
            true,
        )?
        .capture(
            Some(&window),
            CaptureOption {
                color_format: ColorFormat::Rgb8,
                correct_hdr_color_algorithm,
                correct_color_filter,
            },
        )
        .await?;

        let image_buffer =
            snow_shot_app_utils::encode_image(&image, snow_shot_app_utils::ImageEncoder::Png);

        Ok(Response::new(image_buffer))
    }

    #[cfg(target_os = "windows")]
    {
        let image = snow_shot_app_utils::get_capture_monitor_list(
            &app_handle,
            None,
            enable_multiple_monitor,
            correct_hdr_color_algorithm == CorrectHdrColorAlgorithm::None,
        )?
        .capture(
            Some(&window),
            CaptureOption {
                color_format: ColorFormat::Rgba8,
                correct_hdr_color_algorithm,
                correct_color_filter,
            },
        )
        .await?;

        if *webview_shared_buffer_state.enable.read().await {
            let mut extra_data = vec![0; 8];
            unsafe {
                let image_width = image.width();
                let image_height = image.height();
                std::ptr::copy_nonoverlapping(
                    &image_width as *const u32 as *const u8,
                    extra_data.as_mut_ptr(),
                    4,
                );
                std::ptr::copy_nonoverlapping(
                    &image_height as *const u32 as *const u8,
                    extra_data.as_mut_ptr().add(4),
                    4,
                );
            }

            snow_shot_webview::create_shared_buffer(
                webview,
                image.as_bytes(),
                &extra_data,
                "screenshot".to_string(),
            )
            .await?;

            // 通过 SharedBuffer 传输的特殊标记
            Ok(Response::new(vec![1]))
        } else {
            let image_buffer =
                snow_shot_app_utils::encode_image(&image, snow_shot_app_utils::ImageEncoder::Png);

            Ok(Response::new(image_buffer))
        }
    }
}

pub async fn save_and_copy_image<F>(
    write_image_to_clipboard: F,
    image: image::DynamicImage,
    file_path: PathBuf,
    copy_to_clipboard: bool,
) -> Result<(), String>
where
    F: Fn(&image::DynamicImage) -> Result<(), String> + Send + 'static,
{
    let image = Arc::new(image);
    // 并行执行保存文件和写入剪贴板
    let save_file_future =
        snow_shot_app_utils::save_image_to_file(&image, PathBuf::from(file_path));
    let clipboard_future = if copy_to_clipboard {
        let image_clone = Arc::clone(&image);
        Some(tokio::task::spawn_blocking(
            move || match write_image_to_clipboard(&image_clone) {
                Ok(_) => Ok(()),
                Err(e) => {
                    log::error!(
                        "[save_and_copy_image] Failed to write image to clipboard: {}",
                        e
                    );

                    Err(e)
                }
            },
        ))
    } else {
        None
    };

    if let Some(clipboard_handle) = clipboard_future {
        let (save_result, clipboard_result) = tokio::join!(save_file_future, clipboard_handle);
        save_result?;
        clipboard_result.unwrap()?;
    } else {
        save_file_future.await?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
pub fn capture_window_hdr_image(window: &xcap::Window) -> Option<image::DynamicImage> {
    use snow_shot_app_utils::monitor_hdr_info::get_all_monitors_sdr_info;
    use snow_shot_app_utils::monitor_info::MonitorInfo;
    use snow_shot_app_utils::windows_capture_image;
    use windows::Win32::Foundation::HWND;

    // 获取 Windows 所属的显示
    let monitor = match window.current_monitor() {
        Ok(monitor) => monitor,
        Err(_) => return None,
    };

    let hdr_infos = match get_all_monitors_sdr_info() {
        Ok(hdr_infos) => hdr_infos,
        Err(e) => {
            log::error!(
                "[capture_window_hdr_image] Failed to get all monitors SDR info: {}",
                e
            );
            return None;
        }
    };

    let hdr_info = match hdr_infos.get(
        MonitorInfo::get_device_name(&monitor)
            .unwrap_or_default()
            .as_str(),
    ) {
        Some(hdr_info) => hdr_info,
        None => return None,
    };

    if !hdr_info.hdr_enabled {
        return None;
    }

    return match windows_capture_image::capture_monitor_image(
        &MonitorInfo::new(&monitor, Some(hdr_info.clone())),
        Some(HWND(window.hwnd().unwrap())),
        None,
        ColorFormat::Rgba8,
    ) {
        Ok(image) => Some(image),
        Err(error) => {
            log::error!(
                "[capture_window_hdr_image] Failed to capture HDR window image: {}",
                error
            );
            None
        }
    };
}

pub async fn capture_focused_window<F>(
    write_image_to_clipboard: F,
    file_path: String,
    copy_to_clipboard: bool,
    focus_window_app_name_variable_name: String,
    #[allow(unused_variables)] correct_hdr_color_algorithm: CorrectHdrColorAlgorithm,
) -> Result<(), String>
where
    F: Fn(&image::DynamicImage) -> Result<(), String> + Send + 'static,
{
    let image;

    // 截取窗口的应用名称
    let focused_window_app_name;

    #[cfg(target_os = "windows")]
    {
        let hwnd = snow_shot_app_os::utils::get_focused_window();

        let focused_window = xcap::Window::new(xcap::ImplWindow::new(hwnd));

        focused_window_app_name = focused_window.app_name().unwrap_or_default();

        let hdr_image = if correct_hdr_color_algorithm != CorrectHdrColorAlgorithm::None {
            capture_window_hdr_image(&focused_window)
        } else {
            None
        };

        image = match hdr_image {
            Some(image) => image,
            None => {
                match focused_window.capture_image() {
                    Ok(image) => DynamicImage::ImageRgba8(image),
                    Err(_) => {
                        log::warn!("[capture_focused_window] Failed to capture focused window");
                        // 改成捕获当前显示器

                        let (_, _, monitor) = snow_shot_app_utils::get_target_monitor()?;

                        match monitor.capture_image() {
                            Ok(image) => DynamicImage::ImageRgba8(image),
                            Err(_) => {
                                return Err(String::from(
                                    "[capture_focused_window] Failed to capture image",
                                ));
                            }
                        }
                    }
                }
            }
        };
    }

    #[cfg(target_os = "linux")]
    {
        let (_, _, monitor) = snow_shot_app_utils::get_target_monitor();

        image = match monitor.capture_image() {
            Ok(image) => image,
            Err(_) => {
                return Err(String::from(
                    "[capture_focused_window] Failed to capture image",
                ));
            }
        };
    }

    #[cfg(target_os = "macos")]
    {
        let window_list = xcap::Window::all().unwrap_or_default();
        let window = window_list.iter().find(|w| {
            w.is_focused().unwrap_or(false)
                // 排除某些托盘应用，托盘应用会捕获到托盘图标
                && w.y().unwrap_or(0) != 0
                && !w.title().unwrap_or_default().starts_with("Item-")
        });

        focused_window_app_name = match window {
            Some(window) => window.app_name().unwrap_or_default(),
            None => "".to_string(),
        };

        let window_image = match window {
            Some(window) => match window.capture_image() {
                Ok(image) => Some(image),
                Err(_) => None,
            },
            None => None,
        };

        image = match window_image {
            Some(image) => DynamicImage::ImageRgba8(image),
            None => {
                log::warn!("[capture_focused_window] Failed to capture focused window");
                // 改成捕获当前显示器

                let (_, _, monitor) = snow_shot_app_utils::get_target_monitor()?;

                match monitor.capture_image() {
                    Ok(image) => DynamicImage::ImageRgba8(image),
                    Err(_) => {
                        return Err(String::from(
                            "[capture_focused_window] Failed to capture image",
                        ));
                    }
                }
            }
        };
    }

    let focused_window_app_name = if focused_window_app_name == "" {
        "unknown".to_string()
    } else {
        focused_window_app_name
    };

    // 简单处理下 FOCUS_WINDOW_APP_NAME 的变量占位
    let file_path = PathBuf::from(file_path.replace(
        focus_window_app_name_variable_name.as_str(),
        &focused_window_app_name,
    ));

    save_and_copy_image(
        write_image_to_clipboard,
        image,
        file_path,
        copy_to_clipboard,
    )
    .await
}

pub async fn init_ui_elements(ui_elements: tauri::State<'_, Mutex<UIElements>>) -> Result<(), ()> {
    let mut ui_elements = ui_elements.lock().await;

    match ui_elements.init() {
        Ok(_) => Ok(()),
        Err(_) => Err(()),
    }
}

pub async fn init_ui_elements_cache(
    ui_elements: tauri::State<'_, Mutex<UIElements>>,
) -> Result<(), String> {
    let mut ui_elements = ui_elements.lock().await;

    match ui_elements.init_cache() {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("[init_ui_elements_cache] error: {:?}", e)),
    }
}

#[derive(PartialEq, Eq, Serialize, Clone, Debug, Copy, Hash)]
pub struct WindowElement {
    element_rect: ElementRect,
    window_id: u32,
}

pub async fn get_window_elements(
    #[allow(unused_variables)] window: tauri::Window,
) -> Result<Vec<WindowElement>, ()> {
    // 获取所有窗口，简单筛选下需要的窗口，然后获取窗口所有元素
    let windows = {
        #[cfg(target_os = "windows")]
        {
            xcap::Window::all()
                .unwrap_or_default()
                .iter()
                .map(|window| window.hwnd().unwrap() as usize)
                .collect::<Vec<usize>>()
        }
        #[cfg(target_os = "macos")]
        {
            xcap::Window::all()
                .unwrap_or_default()
                .iter()
                .map(|window| window.id().unwrap())
                .collect::<Vec<u32>>()
        }
    };

    #[cfg(target_os = "macos")]
    let window_size_scale: f32;
    #[cfg(not(target_os = "macos"))]
    let window_size_scale = 1.0f32;

    #[cfg(target_os = "macos")]
    {
        // macOS 下窗口基于逻辑像素，这里统一转为物理像素
        window_size_scale = window.scale_factor().unwrap_or(1.0) as f32;
    }

    let rect_list = windows
        .par_iter()
        .filter_map(|window_hwnd| {
            let window = {
                #[cfg(target_os = "windows")]
                {
                    use std::ffi::c_void;
                    use windows::Win32::Foundation::HWND;

                    xcap::ImplWindow::new(HWND(*window_hwnd as *mut c_void))
                }
                #[cfg(target_os = "macos")]
                {
                    xcap::ImplWindow::new(*window_hwnd)
                }
            };

            #[cfg(target_os = "macos")]
            let cf_dict = match window.window_cf_dictionary() {
                Ok(cf_dict) => cf_dict,
                Err(_) => return None,
            };

            #[cfg(target_os = "windows")]
            {
                if window.is_minimized().unwrap_or(true) {
                    return None;
                }
            }

            #[cfg(target_os = "macos")]
            {
                if xcap::ImplWindow::is_minimized_by_cf_dictionary(cf_dict.as_ref()).unwrap_or(true)
                {
                    return None;
                }
            }

            let window_title;
            #[cfg(target_os = "windows")]
            {
                window_title = window.title().unwrap_or_default();
            }
            #[cfg(target_os = "macos")]
            {
                window_title = match xcap::ImplWindow::title_by_cf_dictionary(cf_dict.as_ref()) {
                    Ok(title) => title,
                    Err(_) => return None,
                };

                if window_title.eq("Notification Center") || window_title.eq("Dock") {
                    return None;
                }

                if window_title.eq("Cursor") {
                    if window.app_name().unwrap_or_default().eq("Window Server") {
                        return None;
                    }
                }
            }

            let window_rect: ElementRect;
            let window_id: u32;
            let x: i32;
            let y: i32;
            let width: i32;
            let height: i32;

            #[cfg(target_os = "windows")]
            {
                if window_title.eq("Shell Handwriting Canvas") {
                    return None;
                }

                let window_info = match window.get_window_info() {
                    Ok(window_info) => window_info,
                    Err(_) => return None,
                };

                x = window_info.rcClient.left;
                y = window_info.rcClient.top;
                width = window_info.rcClient.right - window_info.rcClient.left;
                height = window_info.rcClient.bottom - window_info.rcClient.top;
            }

            #[cfg(target_os = "macos")]
            {
                let cg_rect = match xcap::ImplWindow::cg_rect_by_cf_dictionary(cf_dict.as_ref()) {
                    Ok(window_rect) => window_rect,
                    Err(_) => return None,
                };

                x = cg_rect.origin.x as i32;
                y = cg_rect.origin.y as i32;
                width = cg_rect.size.width as i32;
                height = cg_rect.size.height as i32;
            }

            window_id = match window.id() {
                Ok(id) => id,
                Err(_) => return None,
            };

            window_rect = ElementRect {
                min_x: x,
                min_y: y,
                max_x: x + width,
                max_y: y + height,
            };

            Some(WindowElement {
                element_rect: window_rect.scale(window_size_scale),
                window_id,
            })
        })
        .collect::<Vec<WindowElement>>();

    Ok(rect_list)
}

pub async fn switch_always_on_top(#[allow(unused_variables)] window_id: u32) -> bool {
    #[cfg(target_os = "windows")]
    {
        if window_id == 0 {
            return false;
        }

        let window_list = xcap::Window::all().unwrap_or_default();
        let window = window_list
            .iter()
            .find(|w| w.id().unwrap_or(0) == window_id);

        let window = match window {
            Some(window) => window,
            None => return false,
        };

        let window_hwnd = window.hwnd();

        let window_hwnd = match window_hwnd {
            Ok(hwnd) => hwnd,
            Err(_) => return false,
        };

        snow_shot_app_os::utils::switch_always_on_top(window_hwnd);
    }

    #[cfg(target_os = "linux")]
    {
        snow_shot_app_os::utils::switch_always_on_top();
    }

    #[cfg(target_os = "macos")]
    {
        snow_shot_app_os::utils::switch_always_on_top();
    }

    true
}

pub async fn get_element_from_position(
    ui_elements: tauri::State<'_, Mutex<UIElements>>,
    mouse_x: i32,
    mouse_y: i32,
) -> Result<Vec<ElementRect>, ()> {
    let mut ui_elements = ui_elements.lock().await;

    let element_rect_list = match ui_elements.get_element_from_point_walker(mouse_x, mouse_y) {
        Ok(element_rect) => element_rect,
        Err(_) => {
            return Err(());
        }
    };

    Ok(element_rect_list)
}

pub async fn get_mouse_position(app: tauri::AppHandle) -> Result<(i32, i32), String> {
    snow_shot_app_utils::get_mouse_position(&app)
}

pub async fn create_draw_window(app: tauri::AppHandle) {
    let window = tauri::WebviewWindowBuilder::new(
        &app,
        format!(
            "draw-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs()
        ),
        tauri::WebviewUrl::App(format!("/draw").into()),
    )
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .fullscreen(false)
    .title("Snow Shot - Draw")
    .decorations(false)
    .shadow(false)
    .transparent(true)
    .skip_taskbar(true)
    .inner_size(1.0, 1.0)
    .visible(false)
    .focused(false)
    .build()
    .unwrap();

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::Graphics::Dwm::{
            DWMWA_TRANSITIONS_FORCEDISABLED, DwmSetWindowAttribute,
        };

        let window_hwnd = window.hwnd().unwrap();

        // 禁用窗口动画
        unsafe {
            let disable_transitions: i32 = 1;
            match DwmSetWindowAttribute(
                HWND(window_hwnd.0),
                DWMWA_TRANSITIONS_FORCEDISABLED,
                &disable_transitions as *const _ as *const _,
                std::mem::size_of::<i32>() as u32,
            ) {
                Ok(_) => (),
                Err(_) => {
                    log::error!("[create_draw_window] Failed to disable window transitions");
                }
            }
        }
    }

    window.hide().unwrap();
}

pub async fn set_draw_window_style(window: tauri::Window) {
    snow_shot_app_os::utils::set_draw_window_style(window);
}

#[derive(Serialize, Clone)]
pub struct CaptureFullScreenResult {
    monitor_rect: ElementRect,
}

/**
 * 捕获全屏
 */
pub async fn capture_full_screen<F>(
    app_handle: tauri::AppHandle,
    write_image_to_clipboard: F,
    enable_multiple_monitor: bool,
    file_path: String,
    copy_to_clipboard: bool,
    capture_history_file_path: String,
    correct_hdr_color_algorithm: CorrectHdrColorAlgorithm,
    correct_color_filter: bool,
) -> Result<CaptureFullScreenResult, String>
where
    F: Fn(&image::DynamicImage) -> Result<(), String> + Send + 'static,
{
    // 激活的显示器
    let (mouse_x, mouse_y) = snow_shot_app_utils::get_mouse_position(&app_handle)?;
    let active_monitor = MonitorList::get_by_region(
        ElementRect {
            min_x: mouse_x,
            min_y: mouse_y,
            max_x: mouse_x,
            max_y: mouse_y,
        },
        correct_hdr_color_algorithm == CorrectHdrColorAlgorithm::None,
    );
    // 所有显示器
    let monitor_list = snow_shot_app_utils::get_capture_monitor_list(
        &app_handle,
        None,
        enable_multiple_monitor,
        correct_hdr_color_algorithm == CorrectHdrColorAlgorithm::None,
    )?;

    // 截取所有显示器的截图
    let all_monitors_image = monitor_list
        .capture(
            None,
            CaptureOption {
                color_format: ColorFormat::Rgb8,
                correct_hdr_color_algorithm,
                correct_color_filter,
            },
        )
        .await?;
    // 所有显示器的最小矩形
    let all_monitors_bounding_box = monitor_list.get_monitors_bounding_box();
    // 获取激活的显示器相对所有显示器的位置
    let active_monitor_rect = active_monitor.get_monitors_bounding_box();
    let active_monitor_crop_region = ElementRect {
        min_x: active_monitor_rect.min_x - all_monitors_bounding_box.min_x,
        min_y: active_monitor_rect.min_y - all_monitors_bounding_box.min_y,
        max_x: active_monitor_rect.max_x - all_monitors_bounding_box.min_x,
        max_y: active_monitor_rect.max_y - all_monitors_bounding_box.min_y,
    };

    let active_monitor_crop_region_x = active_monitor_crop_region.min_x as usize;
    let active_monitor_crop_region_y = active_monitor_crop_region.min_y as usize;
    let active_monitor_crop_region_width =
        (active_monitor_crop_region.max_x - active_monitor_crop_region.min_x) as usize;
    let active_monitor_crop_region_height =
        (active_monitor_crop_region.max_y - active_monitor_crop_region.min_y) as usize;

    let mut active_monitor_image_bytes = unsafe {
        let mut bytes = Vec::with_capacity(
            active_monitor_crop_region_width * active_monitor_crop_region_height * 3,
        );
        bytes.set_len(active_monitor_crop_region_width * active_monitor_crop_region_height * 3);
        bytes
    };

    let all_monitor_image_width = all_monitors_image.width() as usize;
    let base_index =
        (active_monitor_crop_region_y * all_monitor_image_width + active_monitor_crop_region_x) * 3;

    let active_monitor_image_bytes_ptr = active_monitor_image_bytes.as_mut_ptr() as usize;
    let all_monitor_image_bytes_ptr = all_monitors_image.as_bytes().as_ptr() as usize;
    (0..active_monitor_crop_region_height)
        .into_par_iter()
        .for_each(|y| unsafe {
            let active_monitor_image_row_ptr = (active_monitor_image_bytes_ptr as *mut u8)
                .add(y * active_monitor_crop_region_width * 3);
            let all_monitor_image_row_ptr = (all_monitor_image_bytes_ptr as *mut u8)
                .add(base_index + y * all_monitor_image_width * 3);

            std::ptr::copy_nonoverlapping(
                all_monitor_image_row_ptr,
                active_monitor_image_row_ptr,
                active_monitor_crop_region_width * 3,
            );
        });

    let active_monitor_image = match image::RgbImage::from_raw(
        active_monitor_crop_region_width as u32,
        active_monitor_crop_region_height as u32,
        active_monitor_image_bytes,
    ) {
        Some(image) => image::DynamicImage::ImageRgb8(image),
        None => {
            return Err(String::from(
                "[capture_full_screen] failed to create active monitor image",
            ));
        }
    };

    save_and_copy_image(
        write_image_to_clipboard,
        active_monitor_image,
        PathBuf::from(file_path),
        copy_to_clipboard,
    )
    .await?;

    // 写入到截图历史
    let capture_history_file_path = PathBuf::from(capture_history_file_path);
    match all_monitors_image.save(&capture_history_file_path) {
        Ok(_) => (),
        Err(e) => {
            return Err(format!(
                "[capture_full_screen] failed to save capture history image: {}",
                e
            ));
        }
    }

    Ok(CaptureFullScreenResult {
        monitor_rect: active_monitor_crop_region,
    })
}
