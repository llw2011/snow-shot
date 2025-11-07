use snow_shot_app_services::hot_load_page_service::HotLoadPageService;
use std::sync::Arc;
use tauri::{AppHandle, command};

#[command]
pub async fn hot_load_page_init(
    app_handle: AppHandle,
    hot_load_page_service: tauri::State<'_, Arc<HotLoadPageService>>,
    page_limit: usize,
) -> Result<(), String> {
    hot_load_page_service.init(page_limit, app_handle).await;
    match hot_load_page_service.create_idle_windows().await {
        Ok(_) => (),
        Err(e) => {
            log::error!("[hot_load_page_init] Failed to create idle windows: {}", e);
        }
    }

    Ok(())
}

#[command]
pub async fn hot_load_page_add_page(
    hot_load_page_service: tauri::State<'_, Arc<HotLoadPageService>>,
    window: tauri::WebviewWindow,
) -> Result<(), String> {
    hot_load_page_service.add_page(window).await
}
