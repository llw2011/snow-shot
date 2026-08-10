use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use tauri::Manager;
use tokio::sync::oneshot;
use webview2_com::Microsoft::Web::WebView2::Win32::{
    COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_WRITE, ICoreWebView2_17, ICoreWebView2Environment12,
    ICoreWebView2SharedBuffer,
};
use windows_core::Interface;

// JavaScript stops listening after three seconds. Rust must expire first so a
// delayed UI callback cannot create a channel that JavaScript can no longer use.
const WEBVIEW_CALLBACK_TIMEOUT: Duration = Duration::from_millis(2500);
const SHARED_BUFFER_CHANNEL_RETENTION: Duration = Duration::from_secs(30);
const RECOVERY_LOG_TARGET: &str = "snow-shot-recovery";

struct CallbackCancellationGuard(Arc<AtomicBool>);

impl Drop for CallbackCancellationGuard {
    fn drop(&mut self) {
        self.0.store(true, Ordering::Release);
    }
}

fn callback_expired(cancelled: &AtomicBool, deadline: Instant) -> bool {
    cancelled.load(Ordering::Acquire) || Instant::now() >= deadline
}

async fn receive_async_callback<T>(
    receiver: oneshot::Receiver<Result<T, String>>,
    operation: &str,
    timeout: Duration,
    cancelled: &AtomicBool,
) -> Result<T, String> {
    let result = match tokio::time::timeout(timeout, receiver).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => {
            let error = format!("[{operation}] WebView callback was cancelled");
            log::warn!(target: RECOVERY_LOG_TARGET, "{error}");
            Err(error)
        }
        Err(_) => {
            let error = format!(
                "[{operation}] Timed out waiting for WebView callback after {} ms",
                timeout.as_millis()
            );
            log::warn!(target: RECOVERY_LOG_TARGET, "{error}");
            Err(error)
        }
    };
    cancelled.store(true, Ordering::Release);
    result
}

pub async fn create_shared_buffer(
    webview: tauri::Webview,
    data: &[u8],
    extra_data: &[u8],
    transfer_type: String,
) -> Result<(), String> {
    let (result_sender, result_receiver) = oneshot::channel();
    let callback_cancelled = Arc::new(AtomicBool::new(false));
    let _callback_cancellation_guard = CallbackCancellationGuard(Arc::clone(&callback_cancelled));
    let callback_cancelled_in_webview = Arc::clone(&callback_cancelled);
    let callback_deadline = Instant::now() + WEBVIEW_CALLBACK_TIMEOUT;
    // with_webview can execute after this async function yields, so the UI
    // callback must own every byte it reads.
    let data = data.to_vec();
    let extra_data = extra_data.to_vec();

    webview
        .with_webview(move |webview| {
            if callback_expired(&callback_cancelled_in_webview, callback_deadline) {
                let _ = result_sender.send(Err(
                    "[create_shared_buffer] callback deadline expired before execution".to_owned(),
                ));
                return;
            }

            let result = (|| -> Result<(), String> {
                let environment = webview.environment();
                let core_webview = unsafe { webview.controller().CoreWebView2() }.map_err(|error| {
                    format!("[create_shared_buffer] Failed to get core webview: {error:?}")
                })?;
                let environment_12 = environment
                    .cast::<ICoreWebView2Environment12>()
                    .map_err(|error| {
                        format!(
                            "[create_shared_buffer] Failed to get ICoreWebView2Environment12: {error:?}"
                        )
                    })?;
                let data_len = data.len().checked_add(extra_data.len()).ok_or_else(|| {
                    "[create_shared_buffer] Shared buffer size overflow".to_owned()
                })?;
                let shared_buffer = unsafe { environment_12.CreateSharedBuffer(data_len as u64) }
                    .map_err(|error| {
                        format!(
                            "[create_shared_buffer] Failed to create shared buffer: {error:?}"
                        )
                    })?;
                let mut shared_buffer_ptr = std::ptr::null_mut();
                unsafe { shared_buffer.Buffer(&mut shared_buffer_ptr) }.map_err(|error| {
                    format!("[create_shared_buffer] Failed to access shared buffer: {error:?}")
                })?;
                if data_len != 0 && shared_buffer_ptr.is_null() {
                    return Err(
                        "[create_shared_buffer] Shared buffer returned a null pointer".to_owned(),
                    );
                }

                let webview_17 = core_webview.cast::<ICoreWebView2_17>().map_err(|error| {
                    format!(
                        "[create_shared_buffer] Failed to cast to ICoreWebView2_17: {error:?}"
                    )
                })?;
                if data_len != 0 {
                    unsafe {
                        std::ptr::copy_nonoverlapping(
                            data.as_ptr(),
                            shared_buffer_ptr,
                            data.len(),
                        );
                        std::ptr::copy_nonoverlapping(
                            extra_data.as_ptr(),
                            shared_buffer_ptr.add(data.len()),
                            extra_data.len(),
                        );
                    }
                }

                let additional_data_string: Vec<u16> =
                    format!("{{\"transfer_type\":\"{transfer_type}\"}}")
                        .encode_utf16()
                        .chain(std::iter::once(0))
                        .collect();
                let additional_data =
                    windows::core::PCWSTR::from_raw(additional_data_string.as_ptr());
                if callback_expired(&callback_cancelled_in_webview, callback_deadline) {
                    return Err(
                        "[create_shared_buffer] callback deadline expired before post".to_owned(),
                    );
                }

                unsafe {
                    webview_17.PostSharedBufferToScript(
                        &shared_buffer,
                        COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_WRITE,
                        additional_data,
                    )
                }
                .map_err(|error| {
                    format!(
                        "[create_shared_buffer] Failed to post shared buffer to script: {error:?}"
                    )
                })?;
                Ok(())
            })();

            // A late send only drops owned Rust values and never panics.
            let _ = result_sender.send(result);
        })
        .map_err(|error| {
            format!("[create_shared_buffer] Failed to schedule WebView callback: {error:?}")
        })?;

    receive_async_callback(
        result_receiver,
        "create_shared_buffer",
        WEBVIEW_CALLBACK_TIMEOUT,
        &callback_cancelled,
    )
    .await
}

struct SharedBufferChannel {
    buffer: ICoreWebView2SharedBuffer,
    buffer_size: usize,
}

// WebView2 COM references are apartment-bound. This map is only accessed from
// with_webview/run_on_main_thread callbacks. Only owned Vec<u8> crosses back to
// an async command worker.
thread_local! {
    static SHARED_BUFFER_CHANNELS: RefCell<HashMap<String, SharedBufferChannel>> =
        RefCell::new(HashMap::new());
}

fn close_channel(channel: SharedBufferChannel, operation: &str) -> Result<(), String> {
    unsafe { channel.buffer.Close() }
        .map_err(|error| format!("[{operation}] Failed to close shared buffer: {error:?}"))
}

fn remove_and_close_channel(id: &str, operation: &str) -> Result<bool, String> {
    let channel = SHARED_BUFFER_CHANNELS.with(|channels| channels.borrow_mut().remove(id));
    let Some(channel) = channel else {
        return Ok(false);
    };
    close_channel(channel, operation)?;
    Ok(true)
}

fn insert_channel(id: String, channel: SharedBufferChannel) -> Result<(), String> {
    let replaced =
        SHARED_BUFFER_CHANNELS.with(|channels| channels.borrow_mut().insert(id, channel));
    if let Some(replaced) = replaced
        && let Err(error) = close_channel(replaced, "SharedBufferService::replace_channel")
    {
        // Channel ids should be unique. A stale channel failing to close
        // must not orphan the newly inserted replacement.
        log::warn!(target: RECOVERY_LOG_TARGET, "{error}");
    }
    Ok(())
}

fn take_channel_data(id: &str) -> Result<Vec<u8>, String> {
    let channel = SHARED_BUFFER_CHANNELS
        .with(|channels| channels.borrow_mut().remove(id))
        .ok_or_else(|| format!("[SharedBufferService::receive_data] Channel not found: {id}"))?;

    let copy_result = (|| -> Result<Vec<u8>, String> {
        let mut shared_buffer_ptr = std::ptr::null_mut();
        unsafe { channel.buffer.Buffer(&mut shared_buffer_ptr) }.map_err(|error| {
            format!("[SharedBufferService::receive_data] Failed to access shared buffer: {error:?}")
        })?;
        if channel.buffer_size != 0 && shared_buffer_ptr.is_null() {
            return Err(
                "[SharedBufferService::receive_data] Shared buffer returned a null pointer"
                    .to_owned(),
            );
        }

        let mut data = vec![0; channel.buffer_size];
        if channel.buffer_size != 0 {
            unsafe {
                std::ptr::copy_nonoverlapping(
                    shared_buffer_ptr,
                    data.as_mut_ptr(),
                    channel.buffer_size,
                );
            }
        }
        Ok(data)
    })();
    let close_result = close_channel(channel, "SharedBufferService::receive_data");
    match (copy_result, close_result) {
        (Ok(data), Ok(())) => Ok(data),
        (Err(error), Ok(())) => Err(error),
        (Ok(_), Err(error)) => Err(error),
        (Err(copy_error), Err(close_error)) => Err(format!("{copy_error}; {close_error}")),
    }
}

fn log_channel_cleanup(id: &str, operation: &str) {
    match remove_and_close_channel(id, operation) {
        Ok(true) => {
            log::warn!(target: RECOVERY_LOG_TARGET, "[SharedBufferService] removed unconsumed shared buffer channel {id}")
        }
        Ok(false) => {}
        Err(error) => log::warn!(target: RECOVERY_LOG_TARGET, "{error}"),
    }
}

fn schedule_channel_cleanup(webview: tauri::Webview, id: String) {
    let app = webview.app_handle().clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(SHARED_BUFFER_CHANNEL_RETENTION).await;
        let id_for_webview = id.clone();
        if webview
            .with_webview(move |_| {
                log_channel_cleanup(&id_for_webview, "SharedBufferService::retention_cleanup");
            })
            .is_ok()
        {
            return;
        }

        // A destroyed WebView can no longer schedule its callback. Tauri uses
        // the application UI thread for these Windows WebViews, so make one
        // final best-effort cleanup there instead of retaining the COM object.
        let id_for_main = id.clone();
        if let Err(error) = app.run_on_main_thread(move || {
            log_channel_cleanup(
                &id_for_main,
                "SharedBufferService::destroyed_webview_cleanup",
            );
        }) {
            log::warn!(target: RECOVERY_LOG_TARGET, "[SharedBufferService] failed to schedule cleanup for {id}: {error}");
        }
    });
}

/// Coordinates JavaScript shared-buffer channels without moving COM objects
/// away from the WebView UI apartment.
#[derive(Default)]
pub struct SharedBufferService;

impl SharedBufferService {
    pub const fn new() -> Self {
        Self
    }

    pub async fn create_channel(
        &self,
        id: String,
        webview: tauri::Webview,
        data_size: usize,
    ) -> Result<(), String> {
        let (result_sender, result_receiver) = oneshot::channel();
        let callback_cancelled = Arc::new(AtomicBool::new(false));
        let _callback_cancellation_guard =
            CallbackCancellationGuard(Arc::clone(&callback_cancelled));
        let callback_cancelled_in_webview = Arc::clone(&callback_cancelled);
        let callback_deadline = Instant::now() + WEBVIEW_CALLBACK_TIMEOUT;
        let id_for_callback = id.clone();

        webview
            .with_webview(move |webview| {
                if callback_expired(&callback_cancelled_in_webview, callback_deadline) {
                    let _ = result_sender.send(Err(
                        "[SharedBufferService::create_channel] callback deadline expired before execution"
                            .to_owned(),
                    ));
                    return;
                }

                let result = (|| -> Result<(), String> {
                    let environment = webview.environment();
                    let core_webview =
                        unsafe { webview.controller().CoreWebView2() }.map_err(|error| {
                            format!(
                                "[SharedBufferService::create_channel] Failed to get core webview: {error:?}"
                            )
                        })?;
                    let environment_12 = environment
                        .cast::<ICoreWebView2Environment12>()
                        .map_err(|error| {
                            format!(
                                "[SharedBufferService::create_channel] Failed to get ICoreWebView2Environment12: {error:?}"
                            )
                        })?;
                    let shared_buffer = unsafe {
                        environment_12.CreateSharedBuffer(data_size as u64)
                    }
                    .map_err(|error| {
                        format!(
                            "[SharedBufferService::create_channel] Failed to create shared buffer: {error:?}"
                        )
                    })?;
                    let webview_17 = core_webview.cast::<ICoreWebView2_17>().map_err(|error| {
                        format!(
                            "[SharedBufferService::create_channel] Failed to cast to ICoreWebView2_17: {error:?}"
                        )
                    })?;
                    let channel_info_string: Vec<u16> =
                        format!("{{\"id\":\"{id_for_callback}\"}}")
                            .encode_utf16()
                            .chain(std::iter::once(0))
                            .collect();
                    let channel_info =
                        windows::core::PCWSTR::from_raw(channel_info_string.as_ptr());

                    if callback_expired(&callback_cancelled_in_webview, callback_deadline) {
                        return Err(
                            "[SharedBufferService::create_channel] callback deadline expired before post"
                                .to_owned(),
                        );
                    }

                    insert_channel(
                        id_for_callback.clone(),
                        SharedBufferChannel {
                            buffer: shared_buffer.clone(),
                            buffer_size: data_size,
                        },
                    )?;
                    if let Err(error) = unsafe {
                        webview_17.PostSharedBufferToScript(
                            &shared_buffer,
                            COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_WRITE,
                            channel_info,
                        )
                    } {
                        let _ = remove_and_close_channel(
                            &id_for_callback,
                            "SharedBufferService::failed_post",
                        );
                        return Err(format!(
                            "[SharedBufferService::create_channel] Failed to post shared buffer to script: {error:?}"
                        ));
                    }
                    Ok(())
                })();

                if result_sender.send(result).is_err() {
                    let _ = remove_and_close_channel(
                        &id_for_callback,
                        "SharedBufferService::late_create_channel",
                    );
                }
            })
            .map_err(|error| {
                format!(
                    "[SharedBufferService::create_channel] Failed to schedule WebView callback: {error:?}"
                )
            })?;

        receive_async_callback(
            result_receiver,
            "SharedBufferService::create_channel",
            WEBVIEW_CALLBACK_TIMEOUT,
            &callback_cancelled,
        )
        .await?;
        schedule_channel_cleanup(webview, id);
        Ok(())
    }

    pub async fn receive_data(
        &self,
        id: String,
        webview: tauri::Webview,
    ) -> Result<Vec<u8>, String> {
        let (result_sender, result_receiver) = oneshot::channel();
        let callback_cancelled = Arc::new(AtomicBool::new(false));
        let _callback_cancellation_guard =
            CallbackCancellationGuard(Arc::clone(&callback_cancelled));
        let callback_cancelled_in_webview = Arc::clone(&callback_cancelled);
        let callback_deadline = Instant::now() + WEBVIEW_CALLBACK_TIMEOUT;

        webview
            .with_webview(move |_| {
                let result = if callback_expired(
                    &callback_cancelled_in_webview,
                    callback_deadline,
                ) {
                    let _ = remove_and_close_channel(
                        &id,
                        "SharedBufferService::late_receive_data",
                    );
                    Err(
                        "[SharedBufferService::receive_data] callback deadline expired"
                            .to_owned(),
                    )
                } else {
                    take_channel_data(&id)
                };
                let _ = result_sender.send(result);
            })
            .map_err(|error| {
                format!(
                    "[SharedBufferService::receive_data] Failed to schedule WebView callback: {error:?}"
                )
            })?;

        receive_async_callback(
            result_receiver,
            "SharedBufferService::receive_data",
            WEBVIEW_CALLBACK_TIMEOUT,
            &callback_cancelled,
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn async_callback_timeout_rejects_late_result() {
        let (sender, receiver) = oneshot::channel::<Result<(), String>>();
        let cancelled = AtomicBool::new(false);

        let error =
            receive_async_callback(receiver, "test_async_callback", Duration::ZERO, &cancelled)
                .await
                .unwrap_err();

        assert!(error.contains("Timed out waiting for WebView callback"));
        assert!(cancelled.load(Ordering::Acquire));
        assert!(sender.send(Ok(())).is_err());
    }
}
