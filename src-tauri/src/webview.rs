use snow_shot_global_state::WebViewSharedBufferState;
use snow_shot_webview::create_shared_buffer;
use tauri::command;

#[command]
pub async fn create_webview_shared_buffer(
    webview: tauri::Webview,
    data: Vec<u8>,
    transfer_type: String,
) -> Result<(), String> {
    create_shared_buffer(webview, &data, &[], transfer_type).await?;

    Ok(())
}

#[command]
pub async fn set_support_webview_shared_buffer(
    webview_shared_buffer_state: tauri::State<'_, WebViewSharedBufferState>,
    value: bool,
) -> Result<(), String> {
    *webview_shared_buffer_state.enable.write().await = value;

    Ok(())
}

#[cfg(target_os = "windows")]
#[command]
pub async fn create_webview_shared_buffer_channel(
    webview_shared_buffer_state: tauri::State<'_, WebViewSharedBufferState>,
    shared_buffer_service: tauri::State<'_, std::sync::Arc<snow_shot_webview::SharedBufferService>>,
    webview: tauri::Webview,
    channel_id: String,
    data_size: usize,
) -> Result<bool, String> {
    if !*webview_shared_buffer_state.enable.read().await {
        return Ok(false);
    }

    match shared_buffer_service.create_channel(channel_id, webview, data_size) {
        Ok(_) => Ok(true),
        Err(e) => Err(e),
    }
}
