use snow_shot_app_utils::monitor_info::CorrectHdrColorAlgorithm;
use snow_shot_tauri_commands_screenshot::commands::CaptureFullScreenResult;
use tauri::command;
use tauri_plugin_clipboard_manager::ClipboardExt;

#[command]
pub async fn capture_focused_window(
    app: tauri::AppHandle,
    file_path: String,
    copy_to_clipboard: bool,
    focus_window_app_name_variable_name: String,
    correct_hdr_color_algorithm: CorrectHdrColorAlgorithm,
) -> Result<(), String> {
    snow_shot_tauri_commands_screenshot::commands::capture_focused_window(
        move |image| match app.clipboard().write_image(&tauri::image::Image::new(
            image.as_bytes(),
            image.width(),
            image.height(),
        )) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!(
                "[capture_focused_window] Failed to write image to clipboard: {}",
                e
            )),
        },
        file_path,
        copy_to_clipboard,
        focus_window_app_name_variable_name,
        correct_hdr_color_algorithm,
    )
    .await
}

#[command]
pub async fn capture_full_screen(
    app: tauri::AppHandle,
    enable_multiple_monitor: bool,
    file_path: String,
    copy_to_clipboard: bool,
    capture_history_file_path: String,
    correct_hdr_color_algorithm: CorrectHdrColorAlgorithm,
    correct_color_filter: bool,
) -> Result<CaptureFullScreenResult, String> {
    snow_shot_tauri_commands_screenshot::commands::capture_full_screen(
        app.clone(),
        move |image| match app.clipboard().write_image(&tauri::image::Image::new(
            image.to_rgba8().as_raw(),
            image.width(),
            image.height(),
        )) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!(
                "[capture_full_screen] Failed to write image to clipboard: {}",
                e
            )),
        },
        enable_multiple_monitor,
        file_path,
        copy_to_clipboard,
        capture_history_file_path,
        correct_hdr_color_algorithm,
        correct_color_filter,
    )
    .await
}
