use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

#[derive(Clone, Serialize, Deserialize)]
pub struct CaptureState {
    pub capturing: bool,
}

/// 是否支持 WebView SharedBuffer 传输
pub struct WebViewSharedBufferState {
    pub enable: RwLock<bool>,
}

impl WebViewSharedBufferState {
    pub fn new(value: bool) -> Self {
        Self {
            enable: RwLock::new(value),
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ReadClipboardState {
    pub reading: bool,
}

impl ReadClipboardState {
    pub fn new(value: bool) -> Self {
        Self { reading: value }
    }
}
