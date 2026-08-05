use snow_shot_app_scroll_screenshot_service::scroll_screenshot_service::ScrollScreenshotService;
use tauri::command;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tokio::sync::Mutex;

#[command]
pub async fn scroll_screenshot_save_to_clipboard(
    app: tauri::AppHandle,
    scroll_screenshot_service: tauri::State<'_, Mutex<ScrollScreenshotService>>,
) -> Result<(), String> {
    snow_shot_tauri_commands_scroll_screenshot::commands::scroll_screenshot_save_to_clipboard(
        |image| match app.clipboard().write_image(&tauri::image::Image::new(
            image.as_bytes(),
            image.width(),
            image.height(),
        )) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!(
                "[scroll_screenshot_save_to_clipboard] Failed to write image to clipboard: {}",
                e
            )),
        },
        scroll_screenshot_service,
    )
    .await
}
