use std::path::{Path, PathBuf};

use crate::plugin::{Plugin, PluginFileSource, PluginStatus};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::RwLock;

pub struct PluginService {
    version: RwLock<String>,
    plugin_install_dir: RwLock<PathBuf>,
    plugin_download_dir: RwLock<PathBuf>,
    plugins: DashMap<String, Arc<RwLock<Plugin>>>,
    app_handle: Arc<RwLock<Option<AppHandle>>>,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
pub struct PluginStatusResult {
    name: String,
    status: PluginStatus,
}

impl PluginService {
    pub fn new() -> Self {
        Self {
            version: RwLock::new("".to_string()),
            plugin_install_dir: RwLock::new(PathBuf::new()),
            plugin_download_dir: RwLock::new(PathBuf::new()),
            plugins: DashMap::new(),
            app_handle: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn init(
        &self,
        version: String,
        plugin_install_dir: &Path,
        plugin_download_dir: &Path,
        app_handle: AppHandle,
    ) {
        let mut version_guard = self.version.write().await;
        *version_guard = version;
        let mut plugin_install_dir_guard = self.plugin_install_dir.write().await;
        *plugin_install_dir_guard = plugin_install_dir.to_path_buf();
        let mut plugin_download_dir_guard = self.plugin_download_dir.write().await;
        *plugin_download_dir_guard = plugin_download_dir.to_path_buf();
        let mut app_handle_guard = self.app_handle.write().await;
        *app_handle_guard = Some(app_handle);
    }

    async fn create_plugin(
        &self,
        name: &str,
        file_list: Vec<PathBuf>,
        file_source_list: Vec<PluginFileSource>,
    ) -> Plugin {
        Plugin::new(
            &self.plugin_install_dir.read().await.as_path(),
            &self.plugin_download_dir.read().await.as_path(),
            name.to_string(),
            file_list,
            file_source_list,
            self.version.read().await.clone(),
            self.app_handle.clone(),
        )
    }

    pub async fn register_plugin(
        &self,
        name: String,
        file_list: Vec<PathBuf>,
        file_source_list: Vec<PluginFileSource>,
    ) -> &Self {
        let plugin = self.create_plugin(&name, file_list, file_source_list).await;

        let plugin = Arc::new(RwLock::new(plugin));
        self.plugins.insert(name, plugin.clone());

        plugin.read().await.refresh_status().await;

        self
    }

    pub async fn install_plugin(&self, name: String, force: bool) -> Result<(), String> {
        let plugin = match self.plugins.get(&name) {
            Some(plugin) => plugin,
            None => {
                return Err(format!(
                    "[PluginService::install_plugin] Plugin not found: {}",
                    name
                ));
            }
        };

        let plugin_guard = plugin.read().await;
        plugin_guard.install(force).await
    }

    pub async fn install_local_plugin(
        &self,
        name: String,
        source_dir: &Path,
        force: bool,
    ) -> Result<(), String> {
        let plugin = match self.plugins.get(&name) {
            Some(plugin) => plugin,
            None => {
                return Err(format!(
                    "[PluginService::install_local_plugin] Plugin not found: {}",
                    name
                ));
            }
        };

        let plugin_guard = plugin.read().await;
        plugin_guard.install_from_dir(source_dir, force).await
    }

    pub async fn uninstall_plugin(&self, name: String) -> Result<(), String> {
        let plugin = match self.plugins.get(&name) {
            Some(plugin) => plugin,
            None => {
                return Err(format!(
                    "[PluginService::uninstall_plugin] Plugin not found: {}",
                    name
                ));
            }
        };

        let plugin_guard = plugin.read().await;
        plugin_guard.uninstall().await
    }

    pub async fn get_plugins_status(&self) -> Result<Vec<PluginStatusResult>, String> {
        let mut plugins_status = Vec::new();
        for plugin in self.plugins.iter() {
            let plugin_guard = plugin.read().await;
            plugins_status.push(PluginStatusResult {
                name: plugin_guard.get_name(),
                status: plugin_guard.get_status().await,
            });
        }
        Ok(plugins_status)
    }

}
