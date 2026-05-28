use std::{
    ffi::{OsStr, OsString},
    path::{Component, Path, PathBuf},
    sync::Arc,
};

use async_zip::tokio::read::seek::ZipFileReader;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};
use tokio::{fs, io::BufReader, sync::RwLock};
use tokio_util::compat::TokioAsyncWriteCompatExt;
/**
 * 插件状态
 */
#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
pub enum PluginStatus {
    /**
     * 未安装
     */
    NotInstalled,
    /**
     * 准备就绪
     */
    Installed,
    /**
     * 下载中
     */
    Downloading,
    /**
     * 解压中
     */
    Unzipping,
    /**
     * 卸载中
     */
    Uninstalling,
}

pub struct Plugin {
    /**
     * 状态
     */
    status: Arc<RwLock<PluginStatus>>,
    /**
     * 插件名
     */
    name: String,
    /**
     * 插件文件列表
     */
    file_list: Vec<PathBuf>,
    /**
     * 版本
     */
    version: String,
    /**
     * 插件相对路径
     */
    relative_path: PathBuf,
    /**
     * 插件目录
     */
    plugin_install_dir: PathBuf,
    /**
     * 插件下载目录
     */
    plugin_download_dir: PathBuf,
    /**
     * 应用句柄
     */
    app_handle: Arc<RwLock<Option<AppHandle>>>,
}

impl Plugin {
    /**
     * 获取插件目录
     */
    pub fn get_plugin_dir(&self) -> PathBuf {
        self.plugin_install_dir.join(&self.relative_path)
    }

    fn get_plugin_download_dir(&self) -> PathBuf {
        self.plugin_download_dir.join(&self.version)
    }

    fn get_plugin_download_file_path(&self) -> PathBuf {
        self.get_plugin_download_dir()
            .join(&self.name)
            .with_extension("zip")
    }

    async fn set_status(&self, status: PluginStatus) {
        let current_status = self.get_status().await;
        if current_status != status {
            if let Some(app_handle) = &*self.app_handle.read().await {
                match app_handle.emit("plugin-status-change", ()) {
                    Ok(_) => (),
                    Err(e) => {
                        log::error!(
                            "[Plugin::set_status] Failed to emit plugin status change: {}",
                            e
                        );
                    }
                }
            }
        }

        *self.status.write().await = status;
    }

    /**
     * 刷新插件状态
     */
    pub async fn refresh_status(&self) {
        let current_status = self.get_status().await;
        if current_status != PluginStatus::NotInstalled {
            return;
        }

        let plugin_dir = self.get_plugin_dir();

        let status = if plugin_dir.exists()
            && plugin_dir.is_dir()
            && self
                .file_list
                .iter()
                .all(|file| plugin_dir.join(file).exists())
        {
            PluginStatus::Installed
        } else {
            PluginStatus::NotInstalled
        };

        self.set_status(status).await;
    }

    pub fn new(
        plugin_install_dir: &Path,
        plugin_download_dir: &Path,
        name: String,
        file_list: Vec<PathBuf>,
        version: String,
        app_handle: Arc<RwLock<Option<AppHandle>>>,
    ) -> Self {
        let relative_path = PathBuf::from(&version).join(&name);

        let instance = Self {
            status: Arc::new(RwLock::new(PluginStatus::NotInstalled)),
            version,
            name,
            file_list,
            relative_path,
            plugin_install_dir: plugin_install_dir.to_path_buf(),
            plugin_download_dir: plugin_download_dir.to_path_buf(),
            app_handle,
        };

        instance
    }

    #[allow(unused)]
    pub fn get_relative_path(&self) -> PathBuf {
        self.relative_path.clone()
    }

    #[allow(unused)]
    pub fn get_name(&self) -> String {
        self.name.clone()
    }

    #[allow(unused)]
    pub fn get_version(&self) -> String {
        self.version.clone()
    }

    #[allow(unused)]
    pub async fn get_status(&self) -> PluginStatus {
        self.status.read().await.clone()
    }

    fn normalize_zip_entry_path(
        entry_name: &str,
        plugin_name: &str,
    ) -> Result<Option<PathBuf>, String> {
        let mut parts: Vec<OsString> = Vec::new();
        for component in Path::new(entry_name).components() {
            match component {
                Component::Normal(part) => parts.push(part.to_os_string()),
                Component::CurDir => {}
                Component::ParentDir | Component::Prefix(_) | Component::RootDir => {
                    return Err(format!("unsafe zip entry path rejected: {}", entry_name));
                }
            }
        }

        if parts
            .first()
            .is_some_and(|part| part == OsStr::new(plugin_name))
        {
            parts.remove(0);
        }

        if parts.is_empty() {
            return Ok(None);
        }

        let mut normalized = PathBuf::new();
        for part in parts {
            normalized.push(part);
        }

        Ok(Some(normalized))
    }

    pub async fn extract_zip_to_dir(
        zip_path: &Path,
        extract_to: &Path,
        plugin_name: &str,
    ) -> Result<(), String> {
        let file = match fs::File::open(zip_path).await {
            Ok(file) => file,
            Err(e) => {
                return Err(format!(
                    "[Plugin::extract_zip_to_dir] Failed to open zip file: {}",
                    e
                ));
            }
        };

        // Ensure extract_to exists for canonicalize
        tokio::fs::create_dir_all(extract_to).await.map_err(|e| {
            format!(
                "[Plugin::extract_zip_to_dir] Failed to create extract dir: {}",
                e
            )
        })?;
        let root = extract_to.canonicalize().map_err(|e| {
            format!(
                "[Plugin::extract_zip_to_dir] Failed to canonicalize extract dir: {}",
                e
            )
        })?;

        let mut file = BufReader::new(file);
        let mut zip_reader = match ZipFileReader::with_tokio(&mut file).await {
            Ok(zip) => zip,
            Err(e) => {
                return Err(format!(
                    "[Plugin::extract_zip_to_dir] Failed to create zip file reader: {}",
                    e
                ));
            }
        };

        let entry_count = zip_reader.file().entries().len();
        for index in 0..entry_count {
            let entry = zip_reader.file().entries().get(index).unwrap();
            let entry_name = entry.filename().as_str().unwrap().to_string();
            let is_dir = entry.dir().unwrap();

            let normalized = match Self::normalize_zip_entry_path(&entry_name, plugin_name) {
                Ok(Some(path)) => path,
                Ok(None) => continue,
                Err(e) => return Err(format!("[Plugin::extract_zip_to_dir] {}", e)),
            };

            let path = extract_to.join(&normalized);

            let mut entry_reader = match zip_reader.reader_without_entry(index).await {
                Ok(reader) => reader,
                Err(e) => {
                    return Err(format!(
                        "[Plugin::extract_zip_to_dir] Failed to read ZipEntry: {}",
                        e
                    ));
                }
            };

            if is_dir {
                if !path.exists() {
                    tokio::fs::create_dir_all(&path).await.map_err(|e| {
                        format!(
                            "[Plugin::extract_zip_to_dir] Failed to create extracted directory: {}",
                            e
                        )
                    })?;
                }
            } else {
                let parent = path.parent().ok_or_else(|| {
                    format!(
                        "[Plugin::extract_zip_to_dir] Failed to get parent directory: {}",
                        path.display()
                    )
                })?;
                if !parent.is_dir() {
                    tokio::fs::create_dir_all(parent).await.map_err(|e| {
                        format!(
                            "[Plugin::extract_zip_to_dir] Failed to create parent directories: {}",
                            e
                        )
                    })?;
                }

                // Verify resolved path is within extract root
                let parent_real = parent.canonicalize().map_err(|e| {
                    format!(
                        "[Plugin::extract_zip_to_dir] Failed to canonicalize parent: {}",
                        e
                    )
                })?;
                if !parent_real.starts_with(&root) {
                    return Err(format!(
                        "[Plugin::extract_zip_to_dir] Zip entry escapes plugin directory: {}",
                        entry_name
                    ));
                }

                let writer = tokio::fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(&path)
                    .await
                    .map_err(|e| {
                        format!(
                            "[Plugin::extract_zip_to_dir] Failed to create extracted file: {}",
                            e
                        )
                    })?;

                futures_lite::io::copy(&mut entry_reader, &mut writer.compat_write())
                    .await
                    .map_err(|e| {
                        format!(
                            "[Plugin::extract_zip_to_dir] Failed to copy to extracted file: {}",
                            e
                        )
                    })?;
            }
        }

        Ok(())
    }

    /**
     * 解压插件源文件到插件目录
     */
    async fn unzip(&self) -> Result<(), String> {
        let zip_file_path = self.get_plugin_download_file_path();

        if !zip_file_path.exists() {
            return Err(format!(
                "[Plugin::unzip] Zip file not found: {}",
                zip_file_path.display()
            ));
        }

        Self::extract_zip_to_dir(&zip_file_path, &self.get_plugin_dir(), &self.name).await?;

        Ok(())
    }

    async fn verify_sha256(&self, download_file_path: &Path) -> Result<(), String> {
        let sha256_path = download_file_path.with_extension("zip.sha256");
        if !sha256_path.exists() || !sha256_path.is_file() {
            return Err(format!(
                "[Plugin::verify_sha256] SHA256 sidecar file is required: {}",
                sha256_path.display()
            ));
        }

        let expected_content = tokio::fs::read_to_string(&sha256_path)
            .await
            .map_err(|e| format!("[Plugin::verify_sha256] Failed to read sha256 file: {}", e))?;
        let expected = expected_content
            .split_whitespace()
            .next()
            .unwrap_or("")
            .trim()
            .to_lowercase();
        if expected.len() != 64 || !expected.chars().all(|ch| ch.is_ascii_hexdigit()) {
            return Err(format!(
                "[Plugin::verify_sha256] Invalid SHA256 file format: {}",
                sha256_path.display()
            ));
        }

        let file_bytes = tokio::fs::read(download_file_path)
            .await
            .map_err(|e| format!("[Plugin::verify_sha256] Failed to read zip for hash: {}", e))?;
        let mut hasher = Sha256::new();
        hasher.update(&file_bytes);
        let actual = hex::encode(hasher.finalize());

        if actual != expected {
            return Err(format!(
                "[Plugin::verify_sha256] SHA256 mismatch for {}. Expected: {}, Got: {}",
                download_file_path.display(),
                expected,
                actual
            ));
        }

        Ok(())
    }

    async fn download(&self) -> Result<(), String> {
        let download_file_path = self.get_plugin_download_file_path();

        if !download_file_path.exists() || !download_file_path.is_file() {
            return Err(format!(
                "[Plugin::download] Local plugin zip not found: {}. Remote download is disabled.",
                download_file_path.display()
            ));
        }

        self.verify_sha256(&download_file_path).await?;

        Ok(())
    }

    /**
     * 安装插件
     */
    pub async fn install(&self, force: bool) -> Result<(), String> {
        log::info!("[Plugin::install] Installing plugin: {}", self.name);

        self.refresh_status().await;

        let status = self.get_status().await;

        log::info!("[Plugin::install] Plugin status: {:?}", status);

        // 如果不是未安装状态
        // 如果要求强制安装并且是已安装状态
        if !(status == PluginStatus::NotInstalled || (force && status == PluginStatus::Installed)) {
            return Ok(());
        }

        // 如果插件文件列表为空，则创建插件目录，并设置为已安装状态，作为特殊情况处理
        if self.file_list.len() == 0 {
            match fs::create_dir_all(&self.get_plugin_dir()).await {
                Ok(_) => (),
                Err(e) => {
                    return Err(format!(
                        "[Plugin::install] Failed to create plugin directory: {}",
                        e
                    ));
                }
            }

            self.set_status(PluginStatus::Installed).await;

            return Ok(());
        }

        log::info!(
            "[Plugin::install] local plugin zip: {:?}",
            self.get_plugin_download_file_path()
        );

        // 下载插件
        self.set_status(PluginStatus::Downloading).await;
        self.download().await?;

        // 清除插件目录
        if self.get_plugin_dir().exists() {
            match tokio::fs::remove_dir_all(&self.get_plugin_dir()).await {
                Ok(_) => (),
                Err(e) => {
                    return Err(format!(
                        "[Plugin::install] Failed to clear plugin directory: {}",
                        e
                    ));
                }
            }
        }

        log::info!("[Plugin::install] unzip: {:?}", self.get_plugin_dir());

        self.set_status(PluginStatus::Unzipping).await;
        self.unzip().await?;

        self.set_status(PluginStatus::Installed).await;

        Ok(())
    }

    pub async fn uninstall(&self) -> Result<(), String> {
        self.set_status(PluginStatus::Uninstalling).await;

        if self.get_plugin_dir().exists() {
            match tokio::fs::remove_dir_all(&self.get_plugin_dir()).await {
                Ok(_) => (),
                Err(e) => {
                    return Err(format!(
                        "[Plugin::uninstall] Failed to remove plugin directory: {}",
                        e
                    ));
                }
            }
        }

        self.set_status(PluginStatus::NotInstalled).await;

        Ok(())
    }
}
