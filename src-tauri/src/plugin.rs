use snow_shot_plugin_service::plugin_service::PluginService;
use snow_shot_plugin_service::plugin_service::PluginStatusResult;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::command;
use tauri_plugin_http::reqwest;

#[command]
pub async fn plugin_init(
    app: tauri::AppHandle,
    plugin_service: tauri::State<'_, Arc<PluginService>>,
    version: String,
    plugin_install_dir: String,
    plugin_download_dir: String,
    plugin_download_service_url: String,
) -> Result<(), String> {
    log::info!("[plugin_init] init plugin service");

    plugin_service
        .init(
            version,
            Path::new(&plugin_install_dir),
            Path::new(&plugin_download_dir),
            reqwest::Url::parse(&plugin_download_service_url).unwrap(),
            app,
        )
        .await;

    Ok(())
}

#[command]
pub async fn plugin_get_plugins_status(
    plugin_service: tauri::State<'_, Arc<PluginService>>,
) -> Result<Vec<PluginStatusResult>, String> {
    plugin_service.get_plugins_status().await
}

#[command]
pub async fn plugin_register_plugin(
    plugin_service: tauri::State<'_, Arc<PluginService>>,
    name: String,
    file_list: Vec<PathBuf>,
) -> Result<(), String> {
    plugin_service
        .register_plugin(name.clone(), file_list)
        .await;

    Ok(())
}

#[command]
pub async fn plugin_install_plugin(
    plugin_service: tauri::State<'_, Arc<PluginService>>,
    name: String,
    force: bool,
) -> Result<(), String> {
    plugin_service.install_plugin(name.clone(), force).await
}

#[command]
pub async fn plugin_uninstall_plugin(
    plugin_service: tauri::State<'_, Arc<PluginService>>,
    name: String,
) -> Result<(), String> {
    plugin_service.uninstall_plugin(name.clone()).await
}
