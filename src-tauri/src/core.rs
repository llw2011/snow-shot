use snow_shot_app_shared::ElementRect;
use snow_shot_global_state::WebViewSharedBufferState;
use snow_shot_tauri_commands_core::{MonitorsBoundingBox, VideoRecordWindowLabels};
use std::sync::Arc;
use tauri::{Manager, PhysicalPosition, PhysicalSize, command, ipc::Response};
use tauri_plugin_autostart::ManagerExt;
use tokio::sync::Mutex;

#[command]
pub async fn exit_app(handle: tauri::AppHandle) {
    #[cfg(feature = "dhat-heap")]
    drop(crate::PROFILER.lock().await.take());

    snow_shot_tauri_commands_core::commands::exit_app(handle).await;
}

#[command]
pub async fn get_selected_text() -> String {
    let mut text = snow_shot_tauri_commands_core::commands::get_selected_text().await;
    if text.is_empty() {
        tokio::time::sleep(tokio::time::Duration::from_millis(83)).await;
        text = snow_shot_tauri_commands_core::commands::get_selected_text().await;
    }

    text
}

#[command]
pub async fn read_image_from_clipboard(
    handle: tauri::AppHandle,
    #[allow(unused_variables)] webview_shared_buffer_state: tauri::State<
        '_,
        WebViewSharedBufferState,
    >,
    #[allow(unused_variables)] webview: tauri::Webview,
) -> Result<Response, String> {
    #[cfg(target_os = "windows")]
    {
        use tauri_plugin_clipboard_manager::ClipboardExt;

        if *webview_shared_buffer_state.enable.read().await {
            let image_data = match handle.clipboard().read_image() {
                Ok(image) => image,
                Err(_) => {
                    return Ok(Response::new(Vec::new()));
                }
            };

            let mut extra_data = vec![0; 8];
            unsafe {
                let image_width = image_data.width();
                let image_height = image_data.height();
                std::ptr::copy_nonoverlapping(
                    image_width.to_le_bytes().as_ptr(),
                    extra_data.as_mut_ptr(),
                    4,
                );
                std::ptr::copy_nonoverlapping(
                    image_height.to_le_bytes().as_ptr(),
                    extra_data.as_mut_ptr().add(4),
                    4,
                );
            }

            snow_shot_webview::create_shared_buffer(
                webview,
                image_data.rgba(),
                &extra_data,
                "read_image_from_clipboard".to_string(),
            )
            .await?;

            return Ok(Response::new(vec![1]));
        }
    }

    let clipboard = handle.state::<tauri_plugin_clipboard::Clipboard>();
    let image_data = match tauri_plugin_clipboard::Clipboard::read_image_binary(&clipboard) {
        Ok(image_data) => image_data,
        Err(_) => return Ok(Response::new(Vec::new())),
    };

    Ok(Response::new(image_data))
}

#[command]
pub async fn get_monitors_bounding_box(
    app: tauri::AppHandle,
    region: Option<ElementRect>,
    enable_multiple_monitor: bool,
) -> Result<MonitorsBoundingBox, String> {
    snow_shot_tauri_commands_core::commands::get_monitors_bounding_box(
        &app,
        region,
        enable_multiple_monitor,
    )
    .await
}

#[command]
pub async fn create_video_record_window(
    app: tauri::AppHandle,
    video_record_window_label: tauri::State<'_, Mutex<Option<VideoRecordWindowLabels>>>,
    hot_load_page_service: tauri::State<
        '_,
        Arc<snow_shot_app_services::hot_load_page_service::HotLoadPageService>,
    >,
    select_rect_min_x: i32,
    select_rect_min_y: i32,
    select_rect_max_x: i32,
    select_rect_max_y: i32,
) -> Result<(), String> {
    snow_shot_tauri_commands_core::commands::create_video_record_window(
        app,
        video_record_window_label,
        hot_load_page_service,
        select_rect_min_x,
        select_rect_min_y,
        select_rect_max_x,
        select_rect_max_y,
    )
    .await;
    Ok(())
}

#[command]
pub async fn auto_start_enable(app: tauri::AppHandle) -> Result<(), String> {
    let autostart_manager = app.autolaunch();

    #[cfg(not(target_os = "windows"))]
    {
        return match autostart_manager.enable() {
            Ok(_) => Ok(()),
            Err(e) => Err(format!(
                "[auto_start_enable] Failed to enable autostart: {}",
                e,
            )),
        };
    }

    #[cfg(target_os = "windows")]
    {
        let is_admin = match snow_shot_tauri_commands_core::commands::is_admin().await {
            Ok(is_admin) => is_admin,
            Err(_) => return Err(String::from("[auto_start_enable] Failed to check if admin")),
        };

        if !is_admin {
            match autostart_manager.enable() {
                Ok(_) => (),
                Err(e) => {
                    return Err(format!(
                        "[auto_start_enable] Failed to enable autostart: {}",
                        e,
                    ));
                }
            }

            return Ok(());
        }

        match autostart_manager.disable() {
            Ok(_) => (),
            Err(e) => {
                log::warn!("[auto_start_enable] Failed to disable autostart: {}", e);
            }
        }

        match snow_shot_tauri_commands_core::commands::create_admin_auto_start_task().await {
            Ok(_) => (),
            Err(e) => {
                return Err(format!(
                    "[auto_start_enable] Failed to create admin auto start task: {}",
                    e,
                ));
            }
        }

        Ok(())
    }
}

#[command]
pub async fn auto_start_disable(app: tauri::AppHandle) -> Result<(), String> {
    let autostart_manager = app.autolaunch();

    match autostart_manager.disable() {
        Ok(_) => (),
        Err(e) => {
            log::warn!("[auto_start_disable] Failed to disable autostart: {}", e);
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        let is_admin = match snow_shot_tauri_commands_core::commands::is_admin().await {
            Ok(is_admin) => is_admin,
            Err(_) => {
                return Err(String::from(
                    "[auto_start_disable] Failed to check if admin",
                ));
            }
        };

        if !is_admin {
            return Ok(());
        }

        match snow_shot_tauri_commands_core::commands::delete_admin_auto_start_task().await {
            Ok(_) => (),
            Err(e) => {
                return Err(format!(
                    "[auto_start_disable] Failed to delete admin auto start task: {}",
                    e,
                ));
            }
        }

        Ok(())
    }
}

#[command]
pub async fn set_run_log(
    enable_run_log: tauri::State<'_, std::sync::Arc<std::sync::atomic::AtomicBool>>,
    enable: bool,
) -> Result<(), String> {
    enable_run_log.store(enable, std::sync::atomic::Ordering::Relaxed);

    Ok(())
}

#[command]
pub async fn set_window_rect(
    window: tauri::Window,
    min_x: i32,
    min_y: i32,
    max_x: i32,
    max_y: i32,
) -> Result<(), String> {
    match window.set_size(PhysicalSize::new(max_x - min_x, max_y - min_y)) {
        Ok(_) => (),
        Err(e) => {
            return Err(format!(
                "[set_window_rect] Failed to set window size: {}",
                e
            ));
        }
    }
    match window.set_position(PhysicalPosition::new(min_x, min_y)) {
        Ok(_) => (),
        Err(e) => {
            return Err(format!(
                "[set_window_rect] Failed to set window position: {}",
                e
            ));
        }
    }

    Ok(())
}
