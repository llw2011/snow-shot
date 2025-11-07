use std::{
    path::{Path, PathBuf},
    sync::Arc,
};

use async_zip::tokio::read::seek::ZipFileReader;
use futures_util::StreamExt;
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
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
     * 插件下载服务 URL
     */
    plugin_download_service_url: Url,
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

    fn get_plugin_download_url(&self) -> Url {
        let os_dir_name;
        #[cfg(target_os = "windows")]
        {
            os_dir_name = "windows_x64";
        }
        #[cfg(target_os = "macos")]
        {
            os_dir_name = "macos_aarch64";
        }

        self.plugin_download_service_url
            .join(&format!(
                "{}/{}/{}.zip",
                self.version, os_dir_name, self.name
            ))
            .unwrap()
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
        plugin_download_service_url: Url,
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
            plugin_download_service_url,
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

    /// 将指定的 ZIP 文件解压到指定目录
    ///
    /// # 参数
    /// * `zip_path` - ZIP 文件的路径
    /// * `extract_to` - 解压目标目录的路径
    ///
    /// # 返回值
    /// 如果解压成功返回 `Ok(())`，否则返回错误
    pub async fn extract_zip_to_dir(zip_path: &Path, extract_to: &Path) -> Result<(), String> {
        let file = match fs::File::open(zip_path).await {
            Ok(file) => file,
            Err(e) => {
                return Err(format!(
                    "[Plugin::extract_zip_to_dir] Failed to open zip file: {}",
                    e
                ));
            }
        };

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
            let path = extract_to.join(entry.filename().as_str().unwrap());

            let is_dir = entry.dir().unwrap();

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
                    match tokio::fs::create_dir_all(&path).await {
                        Ok(_) => (),
                        Err(e) => {
                            return Err(format!(
                                "[Plugin::extract_zip_to_dir] Failed to create extracted directory: {}",
                                e
                            ));
                        }
                    }
                }
            } else {
                let parent = match path.parent() {
                    Some(parent) => parent,
                    None => {
                        return Err(format!(
                            "[Plugin::extract_zip_to_dir] Failed to get parent directory: {}",
                            path.display()
                        ));
                    }
                };
                if !parent.is_dir() {
                    match tokio::fs::create_dir_all(parent).await {
                        Ok(_) => (),
                        Err(e) => {
                            return Err(format!(
                                "[Plugin::extract_zip_to_dir] Failed to create parent directories: {}",
                                e
                            ));
                        }
                    }
                }
                let writer = match tokio::fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(&path)
                    .await
                {
                    Ok(writer) => writer,
                    Err(e) => {
                        return Err(format!(
                            "[Plugin::extract_zip_to_dir] Failed to create extracted file: {}",
                            e
                        ));
                    }
                };

                match futures_lite::io::copy(&mut entry_reader, &mut writer.compat_write()).await {
                    Ok(_) => (),
                    Err(e) => {
                        return Err(format!(
                            "[Plugin::extract_zip_to_dir] Failed to copy to extracted file: {}",
                            e
                        ));
                    }
                }
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

        Self::extract_zip_to_dir(&zip_file_path, &self.get_plugin_dir().parent().unwrap()).await?;

        Ok(())
    }

    async fn download(&self) -> Result<(), String> {
        let download_url = self.get_plugin_download_url();

        // 获取下载文件路径
        let download_file_path = self.get_plugin_download_file_path();

        if download_file_path.exists() && download_file_path.is_file() {
            return Ok(());
        }

        // 确保下载目录存在
        let download_dir = download_file_path.parent().unwrap();
        if !download_dir.exists() {
            match tokio::fs::create_dir_all(download_dir).await {
                Ok(_) => (),
                Err(e) => {
                    return Err(format!(
                        "[Plugin::download] Failed to create download directory {}: {}",
                        download_dir.display(),
                        e
                    ));
                }
            }
        }

        // 创建 HTTP 客户端
        let client = Client::new();

        // 发送下载请求
        let response = match client.get(download_url.clone()).send().await {
            Ok(resp) => resp,
            Err(e) => {
                return Err(format!(
                    "[Plugin::download] Failed to send download request to {}: {}",
                    download_url, e
                ));
            }
        };

        // 检查响应状态
        if !response.status().is_success() {
            return Err(format!(
                "[Plugin::download] Download request failed with status {} for URL: {}",
                response.status(),
                download_url
            ));
        }

        // 创建目标文件
        let temp_file_path = download_file_path.with_extension("temp"); // 写入临时文件避免文件传输终端
        let mut file = match tokio::fs::File::create(&temp_file_path).await {
            Ok(file) => file,
            Err(e) => {
                return Err(format!(
                    "[Plugin::download] Failed to create download file {}: {}",
                    temp_file_path.display(),
                    e
                ));
            }
        };

        // 获取响应字节流并复制到文件
        use tokio::io::AsyncWriteExt;

        let mut stream = response.bytes_stream();
        while let Some(chunk_result) = stream.next().await {
            let chunk = match chunk_result {
                Ok(chunk) => chunk,
                Err(e) => {
                    return Err(format!(
                        "[Plugin::download] Failed to read chunk from download stream: {}",
                        e
                    ));
                }
            };

            if let Err(e) = file.write_all(&chunk).await {
                return Err(format!(
                    "[Plugin::download] Failed to write chunk to file {}: {}",
                    temp_file_path.display(),
                    e
                ));
            }
        }

        // 确保文件写入完成
        if let Err(e) = file.flush().await {
            return Err(format!(
                "[Plugin::download] Failed to flush download file {}: {}",
                temp_file_path.display(),
                e
            ));
        }

        match tokio::fs::rename(&temp_file_path, &download_file_path).await {
            Ok(_) => (),
            Err(e) => {
                return Err(format!(
                    "[Plugin::download] Failed to rename download file {} to {}: {}",
                    temp_file_path.display(),
                    download_file_path.display(),
                    e
                ));
            }
        }

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
            "[Plugin::install] download: {:?}",
            self.get_plugin_download_url()
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
