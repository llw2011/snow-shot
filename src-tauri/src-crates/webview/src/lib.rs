#[cfg(target_os = "macos")]
#[path = "macos/mod.rs"]
mod macos;

#[cfg(target_os = "windows")]
#[path = "windows/mod.rs"]
mod windows;

#[cfg(target_os = "windows")]
pub use windows::SharedBufferService;

pub async fn create_shared_buffer(
    #[allow(unused_variables)] webview: tauri::Webview,
    #[allow(unused_variables)] data: &[u8],
    #[allow(unused_variables)] extra_data: &[u8],
    #[allow(unused_variables)] transfer_type: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        macos::create_shared_buffer()
    }
    #[cfg(target_os = "windows")]
    {
        windows::create_shared_buffer(webview, data, extra_data, transfer_type).await
    }
}
