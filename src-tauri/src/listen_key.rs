use tauri::{AppHandle, Window, command};

use snow_shot_app_services::listen_key_service::ListenKeyService;
use snow_shot_app_services::listen_mouse_service::ListenMouseService;
use tokio::sync::Mutex;

#[command]
pub async fn listen_key_start(
    app_handle: AppHandle,
    window: Window,
    listen_key_service: tauri::State<'_, Mutex<ListenKeyService>>,
) -> Result<(), String> {
    let mut listen_key_service = listen_key_service.lock().await;

    listen_key_service.start(app_handle, window)?;

    Ok(())
}

#[command]
pub async fn listen_key_stop(
    window: Window,
    listen_key_service: tauri::State<'_, Mutex<ListenKeyService>>,
) -> Result<(), String> {
    let mut listen_key_service = listen_key_service.lock().await;

    listen_key_service.stop_by_window_label(window.label())?;

    Ok(())
}

#[command]
pub async fn listen_key_stop_by_window_label(
    listen_key_service: tauri::State<'_, Mutex<ListenKeyService>>,
    window_label: String,
) -> Result<(), String> {
    let mut listen_key_service = listen_key_service.lock().await;

    listen_key_service.stop_by_window_label(&window_label)?;

    Ok(())
}

#[command]
pub async fn listen_mouse_start(
    app_handle: AppHandle,
    window: Window,
    listen_mouse_service: tauri::State<'_, Mutex<ListenMouseService>>,
) -> Result<(), String> {
    let mut listen_mouse_service = listen_mouse_service.lock().await;

    listen_mouse_service.start(app_handle, window)?;

    Ok(())
}

#[command]
pub async fn listen_mouse_stop(
    window: Window,
    listen_mouse_service: tauri::State<'_, Mutex<ListenMouseService>>,
) -> Result<(), String> {
    let mut listen_mouse_service = listen_mouse_service.lock().await;

    listen_mouse_service.stop_by_window_label(window.label())?;

    Ok(())
}

#[command]
pub async fn listen_mouse_stop_by_window_label(
    listen_mouse_service: tauri::State<'_, Mutex<ListenMouseService>>,
    window_label: String,
) -> Result<(), String> {
    let mut listen_mouse_service = listen_mouse_service.lock().await;

    listen_mouse_service.stop_by_window_label(&window_label)?;

    Ok(())
}
