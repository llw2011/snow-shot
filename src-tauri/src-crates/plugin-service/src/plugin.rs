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
    file_source_list: Vec<PluginFileSource>,
    /**
     * 应用句柄
     */
    app_handle: Arc<RwLock<Option<AppHandle>>>,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
pub struct PluginFileSource {
    pub path: PathBuf,
    pub url: String,
    pub sha256: Option<String>,
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

    fn get_plugin_file_download_dir(&self) -> PathBuf {
        self.get_plugin_download_dir().join(&self.name)
    }

    async fn set_status(&self, status: PluginStatus) {
        let should_emit = {
            let mut current_status = self.status.write().await;
            if *current_status == status {
                false
            } else {
                *current_status = status;
                true
            }
        };

        if !should_emit {
            return;
        }

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

    /**
     * 刷新插件状态
     */
    pub async fn refresh_status(&self) {
        let current_status = self.get_status().await;
        if matches!(
            current_status,
            PluginStatus::Downloading | PluginStatus::Unzipping | PluginStatus::Uninstalling
        ) {
            return;
        }

        self.refresh_status_from_disk().await;
    }

    async fn refresh_status_from_disk(&self) {
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
        file_source_list: Vec<PluginFileSource>,
        version: String,
        app_handle: Arc<RwLock<Option<AppHandle>>>,
    ) -> Self {
        let relative_path = PathBuf::from(&version).join(&name);

        let instance = Self {
            status: Arc::new(RwLock::new(PluginStatus::NotInstalled)),
            version,
            name,
            file_list,
            file_source_list,
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

    fn normalize_plugin_file_path(file_path: &Path) -> Result<PathBuf, String> {
        let mut normalized = PathBuf::new();
        for component in file_path.components() {
            match component {
                Component::Normal(part) => normalized.push(part),
                Component::CurDir => {}
                Component::ParentDir | Component::Prefix(_) | Component::RootDir => {
                    return Err(format!(
                        "unsafe plugin file path rejected: {}",
                        file_path.display()
                    ));
                }
            }
        }

        if normalized.as_os_str().is_empty() {
            return Err(format!(
                "empty plugin file path rejected: {}",
                file_path.display()
            ));
        }

        Ok(normalized)
    }

    fn normalize_sha256(sha256: &str) -> Result<String, String> {
        let normalized = sha256.trim().to_lowercase();
        if normalized.len() != 64 || !normalized.chars().all(|ch| ch.is_ascii_hexdigit()) {
            return Err(format!("invalid SHA256 value: {}", sha256));
        }

        Ok(normalized)
    }

    async fn calculate_file_sha256(file_path: &Path) -> Result<String, String> {
        let file_bytes = tokio::fs::read(file_path).await.map_err(|e| {
            format!(
                "[Plugin::calculate_file_sha256] Failed to read file for hash: {}",
                e
            )
        })?;
        let mut hasher = Sha256::new();
        hasher.update(&file_bytes);
        Ok(hex::encode(hasher.finalize()))
    }

    async fn verify_path_sha256(file_path: &Path, expected: &str) -> Result<(), String> {
        let expected = Self::normalize_sha256(expected)?;
        let actual = Self::calculate_file_sha256(file_path).await?;

        if actual != expected {
            return Err(format!(
                "[Plugin::verify_path_sha256] SHA256 mismatch for {}. Expected: {}, Got: {}",
                file_path.display(),
                expected,
                actual
            ));
        }

        Ok(())
    }

    fn find_local_source_file(source_dir: &Path, required_file: &Path) -> Option<PathBuf> {
        let source_root = source_dir.canonicalize().ok()?;
        let candidates = [
            source_dir.join(required_file),
            source_dir.join("bin").join(required_file),
        ];

        for candidate in candidates {
            if !candidate.is_file() {
                continue;
            }

            let candidate_real = match candidate.canonicalize() {
                Ok(path) => path,
                Err(_) => continue,
            };
            if candidate_real.starts_with(&source_root) {
                return Some(candidate);
            }
        }

        None
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
            let entry = zip_reader.file().entries().get(index).ok_or_else(|| {
                format!(
                    "[Plugin::extract_zip_to_dir] Missing zip entry at index: {}",
                    index
                )
            })?;
            let entry_name = entry
                .filename()
                .as_str()
                .map_err(|e| {
                    format!(
                        "[Plugin::extract_zip_to_dir] Invalid zip entry filename at index {}: {}",
                        index, e
                    )
                })?
                .to_string();
            let is_dir = entry.dir().map_err(|e| {
                format!(
                    "[Plugin::extract_zip_to_dir] Failed to read zip entry type at index {}: {}",
                    index, e
                )
            })?;

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

    async fn install_from_dir_inner(&self, source_dir: &Path, force: bool) -> Result<(), String> {
        log::info!(
            "[Plugin::install_from_dir] Installing local plugin: {}, source: {}",
            self.name,
            source_dir.display()
        );

        self.refresh_status().await;

        let status = self.get_status().await;
        if !(status == PluginStatus::NotInstalled || (force && status == PluginStatus::Installed)) {
            return Ok(());
        }

        if !source_dir.is_dir() {
            return Err(format!(
                "[Plugin::install_from_dir] Local plugin source directory not found: {}",
                source_dir.display()
            ));
        }

        if self.file_list.len() == 0 {
            match fs::create_dir_all(&self.get_plugin_dir()).await {
                Ok(_) => (),
                Err(e) => {
                    return Err(format!(
                        "[Plugin::install_from_dir] Failed to create plugin directory: {}",
                        e
                    ));
                }
            }

            self.set_status(PluginStatus::Installed).await;

            return Ok(());
        }

        let mut copy_tasks = Vec::new();
        for file in &self.file_list {
            let normalized_file = Self::normalize_plugin_file_path(file)?;
            let source_file =
                Self::find_local_source_file(source_dir, &normalized_file).ok_or_else(|| {
                    format!(
                        "[Plugin::install_from_dir] Required plugin file not found in {} or {}/bin: {}",
                        source_dir.display(),
                        source_dir.display(),
                        normalized_file.display()
                    )
                })?;

            copy_tasks.push((source_file, normalized_file));
        }

        self.set_status(PluginStatus::Unzipping).await;

        if self.get_plugin_dir().exists() {
            match tokio::fs::remove_dir_all(&self.get_plugin_dir()).await {
                Ok(_) => (),
                Err(e) => {
                    return Err(format!(
                        "[Plugin::install_from_dir] Failed to clear plugin directory: {}",
                        e
                    ));
                }
            }
        }

        tokio::fs::create_dir_all(&self.get_plugin_dir())
            .await
            .map_err(|e| {
                format!(
                    "[Plugin::install_from_dir] Failed to create plugin directory: {}",
                    e
                )
            })?;

        for (source_file, relative_file) in copy_tasks {
            let target_file = self.get_plugin_dir().join(&relative_file);
            let target_parent = target_file.parent().ok_or_else(|| {
                format!(
                    "[Plugin::install_from_dir] Failed to get target parent directory: {}",
                    target_file.display()
                )
            })?;

            tokio::fs::create_dir_all(target_parent)
                .await
                .map_err(|e| {
                    format!(
                        "[Plugin::install_from_dir] Failed to create target directory: {}",
                        e
                    )
                })?;

            tokio::fs::copy(&source_file, &target_file)
                .await
                .map_err(|e| {
                    format!(
                        "[Plugin::install_from_dir] Failed to copy {} to {}: {}",
                        source_file.display(),
                        target_file.display(),
                        e
                    )
                })?;
        }

        self.set_status(PluginStatus::Installed).await;

        Ok(())
    }

    pub async fn install_from_dir(&self, source_dir: &Path, force: bool) -> Result<(), String> {
        let result = self.install_from_dir_inner(source_dir, force).await;
        if result.is_err() {
            self.refresh_status_from_disk().await;
        }

        result
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

        Self::verify_path_sha256(download_file_path, &expected).await
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

    async fn download_file_source(
        &self,
        source: &PluginFileSource,
        download_dir: &Path,
    ) -> Result<PathBuf, String> {
        let normalized_file = Self::normalize_plugin_file_path(&source.path)?;
        let download_file_path = download_dir.join(&normalized_file);

        if let Some(expected_sha256) = &source.sha256 {
            if download_file_path.is_file()
                && Self::verify_path_sha256(&download_file_path, expected_sha256)
                    .await
                    .is_ok()
            {
                log::info!(
                    "[Plugin::download_file_source] Cached file is valid: {}",
                    download_file_path.display()
                );
                return Ok(normalized_file);
            }
        } else if download_file_path.is_file() {
            return Ok(normalized_file);
        }

        let parent = download_file_path.parent().ok_or_else(|| {
            format!(
                "[Plugin::download_file_source] Failed to get download parent directory: {}",
                download_file_path.display()
            )
        })?;
        tokio::fs::create_dir_all(parent).await.map_err(|e| {
            format!(
                "[Plugin::download_file_source] Failed to create download directory: {}",
                e
            )
        })?;

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|e| {
                format!(
                    "[Plugin::download_file_source] Failed to create http client: {}",
                    e
                )
            })?;
        let response = client
            .get(&source.url)
            .header(reqwest::header::USER_AGENT, "Snow Shot Rapid OCR Installer")
            .send()
            .await
            .map_err(|e| {
                format!(
                    "[Plugin::download_file_source] Failed to download {}: {}",
                    source.url, e
                )
            })?;
        if !response.status().is_success() {
            return Err(format!(
                "[Plugin::download_file_source] Failed to download {}: HTTP {}",
                source.url,
                response.status()
            ));
        }

        let bytes = response.bytes().await.map_err(|e| {
            format!(
                "[Plugin::download_file_source] Failed to read response from {}: {}",
                source.url, e
            )
        })?;
        let file_name = download_file_path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| {
                format!(
                    "[Plugin::download_file_source] Invalid file name: {}",
                    download_file_path.display()
                )
            })?;
        let temp_file_path = download_file_path.with_file_name(format!("{}.download", file_name));

        if temp_file_path.exists() {
            tokio::fs::remove_file(&temp_file_path).await.map_err(|e| {
                format!(
                    "[Plugin::download_file_source] Failed to remove stale temp file: {}",
                    e
                )
            })?;
        }

        tokio::fs::write(&temp_file_path, &bytes).await.map_err(|e| {
            format!(
                "[Plugin::download_file_source] Failed to write downloaded file: {}",
                e
            )
        })?;

        if let Some(expected_sha256) = &source.sha256 {
            Self::verify_path_sha256(&temp_file_path, expected_sha256).await?;
        }

        if download_file_path.exists() {
            tokio::fs::remove_file(&download_file_path)
                .await
                .map_err(|e| {
                    format!(
                        "[Plugin::download_file_source] Failed to replace cached file: {}",
                        e
                    )
                })?;
        }
        tokio::fs::rename(&temp_file_path, &download_file_path)
            .await
            .map_err(|e| {
                format!(
                    "[Plugin::download_file_source] Failed to move downloaded file into cache: {}",
                    e
                )
            })?;

        Ok(normalized_file)
    }

    async fn install_from_file_sources(&self, force: bool) -> Result<(), String> {
        self.refresh_status().await;

        let status = self.get_status().await;
        if !(status == PluginStatus::NotInstalled || (force && status == PluginStatus::Installed)) {
            return Ok(());
        }

        let download_dir = self.get_plugin_file_download_dir();
        self.set_status(PluginStatus::Downloading).await;

        let mut downloaded_files = Vec::new();
        for source in &self.file_source_list {
            downloaded_files.push(self.download_file_source(source, &download_dir).await?);
        }

        self.set_status(PluginStatus::Unzipping).await;

        if self.get_plugin_dir().exists() {
            tokio::fs::remove_dir_all(&self.get_plugin_dir())
                .await
                .map_err(|e| {
                    format!(
                        "[Plugin::install_from_file_sources] Failed to clear plugin directory: {}",
                        e
                    )
                })?;
        }

        tokio::fs::create_dir_all(&self.get_plugin_dir())
            .await
            .map_err(|e| {
                format!(
                    "[Plugin::install_from_file_sources] Failed to create plugin directory: {}",
                    e
                )
            })?;

        for relative_file in downloaded_files {
            let source_file = download_dir.join(&relative_file);
            let target_file = self.get_plugin_dir().join(&relative_file);
            let target_parent = target_file.parent().ok_or_else(|| {
                format!(
                    "[Plugin::install_from_file_sources] Failed to get target parent directory: {}",
                    target_file.display()
                )
            })?;

            tokio::fs::create_dir_all(target_parent)
                .await
                .map_err(|e| {
                    format!(
                        "[Plugin::install_from_file_sources] Failed to create target directory: {}",
                        e
                    )
                })?;
            tokio::fs::copy(&source_file, &target_file)
                .await
                .map_err(|e| {
                    format!(
                        "[Plugin::install_from_file_sources] Failed to copy {} to {}: {}",
                        source_file.display(),
                        target_file.display(),
                        e
                    )
                })?;
        }

        self.set_status(PluginStatus::Installed).await;

        Ok(())
    }

    /**
     * 安装插件
     */
    async fn install_inner(&self, force: bool) -> Result<(), String> {
        log::info!("[Plugin::install] Installing plugin: {}", self.name);

        if !self.file_source_list.is_empty() {
            return self.install_from_file_sources(force).await;
        }

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

    pub async fn install(&self, force: bool) -> Result<(), String> {
        let result = self.install_inner(force).await;
        if result.is_err() {
            self.refresh_status_from_disk().await;
        }

        result
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

#[cfg(test)]
mod tests {
    use super::Plugin;

    #[test]
    fn normalize_plugin_file_path_rejects_path_escape() {
        assert!(Plugin::normalize_plugin_file_path("../model.onnx".as_ref()).is_err());
        assert!(Plugin::normalize_plugin_file_path("C:/model.onnx".as_ref()).is_err());
    }

    #[test]
    fn normalize_plugin_file_path_accepts_nested_relative_path() {
        assert_eq!(
            Plugin::normalize_plugin_file_path("models/model.onnx".as_ref()).unwrap(),
            std::path::PathBuf::from("models").join("model.onnx")
        );
    }

    #[test]
    fn normalize_sha256_validates_hash_format() {
        assert!(
            Plugin::normalize_sha256(
                "D2A7720D45A54257208B1E13E36A8479894CB74155A5EFE29462512D42F49DA9",
            )
            .is_ok()
        );
        assert!(Plugin::normalize_sha256("not-a-sha").is_err());
    }
}
