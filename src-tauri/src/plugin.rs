use snow_shot_app_services::video_record_service::probe_ffmpeg_binary;
use snow_shot_plugin_service::plugin::PluginFileSource;
use snow_shot_plugin_service::plugin_service::PluginService;
use snow_shot_plugin_service::plugin_service::PluginStatusResult;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::command;

async fn verify_installed_ffmpeg_plugin(
    plugin_service: &Arc<PluginService>,
    name: &str,
) -> Result<(), String> {
    if name != "ffmpeg" {
        return Ok(());
    }

    let Some(plugin_dir) = plugin_service.get_plugin_dir(name).await else {
        return Ok(());
    };
    let binary_name = if cfg!(target_os = "windows") {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };
    let binary_path = plugin_dir.join(binary_name);
    if !binary_path.is_file() {
        return Ok(());
    }

    let probe_result = tokio::task::spawn_blocking(move || probe_ffmpeg_binary(&binary_path))
        .await
        .map_err(|e| format!("FFmpeg verification task failed: {}", e))?;

    match probe_result {
        Ok(version_line) => {
            log::info!("[plugin] Verified installed FFmpeg: {}", version_line);
            Ok(())
        }
        Err(reason) => {
            log::error!("[plugin] Installed FFmpeg failed verification: {}", reason);
            let _ = plugin_service.uninstall_plugin(name.to_string()).await;
            Err(reason)
        }
    }
}

#[command]
pub async fn plugin_init(
    app: tauri::AppHandle,
    plugin_service: tauri::State<'_, Arc<PluginService>>,
    version: String,
    plugin_install_dir: String,
    plugin_download_dir: String,
) -> Result<(), String> {
    log::info!("[plugin_init] init plugin service");

    plugin_service
        .init(
            version,
            Path::new(&plugin_install_dir),
            Path::new(&plugin_download_dir),
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
    file_source_list: Option<Vec<PluginFileSource>>,
) -> Result<(), String> {
    plugin_service
        .register_plugin(
            name.clone(),
            file_list,
            file_source_list.unwrap_or_default(),
        )
        .await;

    Ok(())
}

#[command]
pub async fn plugin_install_plugin(
    plugin_service: tauri::State<'_, Arc<PluginService>>,
    name: String,
    force: bool,
) -> Result<(), String> {
    plugin_service.install_plugin(name.clone(), force).await?;
    verify_installed_ffmpeg_plugin(plugin_service.inner(), &name).await
}

#[command]
pub async fn plugin_install_local_plugin(
    plugin_service: tauri::State<'_, Arc<PluginService>>,
    name: String,
    source_dir: PathBuf,
    force: bool,
) -> Result<(), String> {
    plugin_service
        .install_local_plugin(name.clone(), &source_dir, force)
        .await?;
    verify_installed_ffmpeg_plugin(plugin_service.inner(), &name).await
}

#[command]
pub async fn plugin_uninstall_plugin(
    plugin_service: tauri::State<'_, Arc<PluginService>>,
    name: String,
) -> Result<(), String> {
    plugin_service.uninstall_plugin(name.clone()).await
}
