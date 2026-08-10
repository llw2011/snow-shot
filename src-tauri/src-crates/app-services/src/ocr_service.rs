use std::{
    borrow::Cow,
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex as StdMutex,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

use num_cpus;
use ort::session::builder::SessionBuilder;
use paddle_ocr_rs::ocr_lite::OcrLite;
use serde::{Deserialize, Serialize};
use tokio::{
    sync::{OwnedSemaphorePermit, Semaphore, TryAcquireError},
    task::JoinError,
};

/// Keep OCR work off the async runtime and avoid creating a second inference
/// session for every concurrent request. One active request and one queued
/// request are enough for the screenshot UI; additional bursts fail quickly
/// instead of accumulating unbounded image memory.
const OCR_MAX_OUTSTANDING_REQUESTS: usize = 2;
const OCR_QUEUE_WAIT_TIMEOUT: Duration = Duration::from_secs(15);
const OCR_INFERENCE_TIMEOUT: Duration = Duration::from_secs(90);
const OCR_MAX_INTRA_THREADS: usize = 4;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Copy, PartialOrd, Serialize, Deserialize)]
pub enum OcrModel {
    RapidOcrV4,
    RapidOcrV5,
}

#[derive(Clone)]
struct ModelFile {
    path: PathBuf,
    /// Keeping model bytes behind an Arc avoids copying all three models when
    /// an idle session is recreated.
    data: Option<Arc<Vec<u8>>>,
}

struct OcrRuntime {
    hot_start: bool,
    ocr_core: Option<OcrLite>,
    det_model: Option<ModelFile>,
    rec_model: Option<ModelFile>,
    cls_model: Option<ModelFile>,
}

impl OcrRuntime {
    fn new() -> Self {
        Self {
            hot_start: false,
            ocr_core: None,
            det_model: None,
            rec_model: None,
            cls_model: None,
        }
    }

    fn load_model_bytes(file: &ModelFile) -> Result<Cow<'_, [u8]>, String> {
        match file.data.as_ref() {
            Some(data) => Ok(Cow::Borrowed(data.as_slice())),
            None => std::fs::read(&file.path).map(Cow::Owned).map_err(|error| {
                format!(
                    "[OcrService::init_session] Failed to read model {}: {}",
                    file.path.display(),
                    error
                )
            }),
        }
    }

    fn init_session_sync(&mut self) -> Result<(), String> {
        let det_model = self
            .det_model
            .as_ref()
            .ok_or_else(|| "[OcrService::init_session] Det model is not loaded".to_string())?;
        let cls_model = self
            .cls_model
            .as_ref()
            .ok_or_else(|| "[OcrService::init_session] Cls model is not loaded".to_string())?;
        let rec_model = self
            .rec_model
            .as_ref()
            .ok_or_else(|| "[OcrService::init_session] Rec model is not loaded".to_string())?;

        let det_data = Self::load_model_bytes(det_model)?;
        let cls_data = Self::load_model_bytes(cls_model)?;
        let rec_data = Self::load_model_bytes(rec_model)?;

        let mut ocr_core = OcrLite::new();
        ocr_core
            .init_models_from_memory_custom(
                det_data.as_ref(),
                cls_data.as_ref(),
                rec_data.as_ref(),
                OcrService::build_session,
            )
            .map_err(|error| {
                format!(
                    "[OcrService::init_session] Failed to init models: {}",
                    error
                )
            })?;

        self.ocr_core = Some(ocr_core);
        Ok(())
    }
}

/// A cheap cloneable handle used by commands after they release the Tauri
/// state mutex. The state itself remains manager-owned, while this handle
/// keeps the runtime and queue lifetime independent of an individual invoke.
#[derive(Clone)]
pub struct OcrExecutionHandle {
    runtime: Arc<StdMutex<OcrRuntime>>,
    request_slots: Arc<Semaphore>,
    worker: Arc<Semaphore>,
}

impl OcrExecutionHandle {
    fn new() -> Self {
        Self {
            runtime: Arc::new(StdMutex::new(OcrRuntime::new())),
            request_slots: Arc::new(Semaphore::new(OCR_MAX_OUTSTANDING_REQUESTS)),
            worker: Arc::new(Semaphore::new(1)),
        }
    }

    /// Execute one synchronous OCR operation on Tokio's blocking pool.
    ///
    /// The closure receives the single reusable OCR session. A request may be
    /// cancelled while queued or timed out while running; an in-flight native
    /// inference cannot be forcefully interrupted, so its worker permit stays
    /// owned by the detached task until it naturally returns.
    pub async fn run_recognition<F, R>(&self, operation: F) -> Result<R, String>
    where
        F: FnOnce(&mut OcrLite) -> Result<R, String> + Send + 'static,
        R: Send + 'static,
    {
        let cancelled = Arc::new(AtomicBool::new(false));
        let cancellation = CancellationGuard(Arc::clone(&cancelled));

        // Do not enqueue outside the bounded slot count. Awaiting this
        // semaphore would allow unlimited futures (and their captured images)
        // to accumulate for the queue timeout.
        let request_permit = try_acquire_request_slot(Arc::clone(&self.request_slots))?;
        let worker_permit = acquire_with_timeout(
            Arc::clone(&self.worker),
            OCR_QUEUE_WAIT_TIMEOUT,
            "OCR worker is busy",
        )
        .await?;

        let runtime = Arc::clone(&self.runtime);
        let task = tokio::task::spawn_blocking(move || {
            // Keep both permits in the blocking task. If the caller times out
            // and the JoinHandle is detached, no later request can race this
            // native session.
            let _request_permit = request_permit;
            let _worker_permit = worker_permit;

            if cancelled.load(Ordering::Acquire) {
                return Err("OCR request was cancelled".to_string());
            }

            let mut runtime = runtime
                .lock()
                .map_err(|_| "OCR runtime lock is poisoned".to_string())?;
            if runtime.ocr_core.is_none() {
                runtime.init_session_sync()?;
            }
            if cancelled.load(Ordering::Acquire) {
                return Err("OCR request was cancelled".to_string());
            }

            let session = runtime
                .ocr_core
                .as_mut()
                .ok_or_else(|| "OCR session is unavailable".to_string())?;
            operation(session)
        });

        let result = tokio::time::timeout(OCR_INFERENCE_TIMEOUT, task).await;
        drop(cancellation);

        match result {
            Ok(join_result) => join_result.map_err(join_error)?,
            Err(_) => Err(format!(
                "OCR inference timed out after {} seconds",
                OCR_INFERENCE_TIMEOUT.as_secs()
            )),
        }
    }

    async fn run_admin<F>(&self, operation: F) -> Result<(), String>
    where
        F: FnOnce(&mut OcrRuntime) -> Result<(), String> + Send + 'static,
    {
        // Initialization and release use the same single worker as detection,
        // but are not counted against the user request queue.
        let worker_permit = acquire_with_timeout(
            Arc::clone(&self.worker),
            OCR_QUEUE_WAIT_TIMEOUT,
            "OCR worker is busy",
        )
        .await?;
        let runtime = Arc::clone(&self.runtime);
        let task = tokio::task::spawn_blocking(move || {
            let _worker_permit = worker_permit;
            let mut runtime = runtime
                .lock()
                .map_err(|_| "OCR runtime lock is poisoned".to_string())?;
            operation(&mut runtime)
        });

        match tokio::time::timeout(OCR_INFERENCE_TIMEOUT, task).await {
            Ok(result) => result.map_err(join_error)?,
            Err(_) => Err(format!(
                "OCR runtime operation timed out after {} seconds",
                OCR_INFERENCE_TIMEOUT.as_secs()
            )),
        }
    }
}

struct CancellationGuard(Arc<AtomicBool>);

impl Drop for CancellationGuard {
    fn drop(&mut self) {
        self.0.store(true, Ordering::Release);
    }
}

async fn acquire_with_timeout(
    semaphore: Arc<Semaphore>,
    timeout: Duration,
    busy_message: &'static str,
) -> Result<OwnedSemaphorePermit, String> {
    match tokio::time::timeout(timeout, semaphore.acquire_owned()).await {
        Ok(Ok(permit)) => Ok(permit),
        Ok(Err(_)) => Err("OCR worker is closed".to_string()),
        Err(_) => Err(format!(
            "{} (waited {} seconds)",
            busy_message,
            timeout.as_secs()
        )),
    }
}

fn try_acquire_request_slot(semaphore: Arc<Semaphore>) -> Result<OwnedSemaphorePermit, String> {
    semaphore.try_acquire_owned().map_err(|error| match error {
        TryAcquireError::NoPermits => "OCR request queue is full".to_string(),
        TryAcquireError::Closed => "OCR request queue is closed".to_string(),
    })
}

fn join_error(error: JoinError) -> String {
    if error.is_cancelled() {
        "OCR blocking task was cancelled".to_string()
    } else if error.is_panic() {
        "OCR blocking task panicked".to_string()
    } else {
        format!("OCR blocking task failed: {}", error)
    }
}

fn session_thread_budget(physical_cores: usize) -> (usize, usize) {
    (
        physical_cores.clamp(1, OCR_MAX_INTRA_THREADS),
        1, // Keep inter-op graph fan-out disabled for the single OCR worker.
    )
}

pub struct OcrService {
    execution: OcrExecutionHandle,
}

impl Default for OcrService {
    fn default() -> Self {
        Self::new()
    }
}

impl OcrService {
    pub fn new() -> Self {
        Self {
            execution: OcrExecutionHandle::new(),
        }
    }

    pub fn execution_handle(&self) -> OcrExecutionHandle {
        self.execution.clone()
    }

    async fn read_model_data(
        det_path: &Path,
        cls_path: &Path,
        rec_path: &Path,
    ) -> Result<(Vec<u8>, Vec<u8>, Vec<u8>), String> {
        let (det_result, cls_result, rec_result) = tokio::join!(
            tokio::fs::read(det_path),
            tokio::fs::read(cls_path),
            tokio::fs::read(rec_path)
        );

        Ok((
            det_result.map_err(|error| {
                format!(
                    "[OcrService::read_model_data] Failed to read det model data: {}",
                    error
                )
            })?,
            cls_result.map_err(|error| {
                format!(
                    "[OcrService::read_model_data] Failed to read cls model data: {}",
                    error
                )
            })?,
            rec_result.map_err(|error| {
                format!(
                    "[OcrService::read_model_data] Failed to read rec model data: {}",
                    error
                )
            })?,
        ))
    }

    fn build_session(builder: SessionBuilder) -> Result<SessionBuilder, ort::Error> {
        // One worker is active at a time. Capping intra-op parallelism and
        // disabling inter-op fan-out prevents a single OCR request from
        // consuming every logical/physical core and starving the tray/UI.
        let (intra_threads, inter_threads) = session_thread_budget(num_cpus::get_physical());
        builder
            .with_inter_threads(inter_threads)?
            .with_intra_threads(intra_threads)?
            .with_optimization_level(ort::session::builder::GraphOptimizationLevel::Level3)
    }

    pub async fn init_session(&mut self) -> Result<(), String> {
        self.execution
            .run_admin(|runtime| runtime.init_session_sync())
            .await
    }

    pub async fn init_models(
        &mut self,
        orc_plugin_path: PathBuf,
        model: OcrModel,
        hot_start: bool,
        ocr_model_write_to_memory: bool,
    ) -> Result<(), String> {
        log::info!(
            "[OcrService::init_models] orc_plugin_path: {:?}, model: {:?}, hot_start: {:?}, ocr_model_write_to_memory: {:?}",
            orc_plugin_path,
            model,
            hot_start,
            ocr_model_write_to_memory
        );

        let (det_path, cls_path, rec_path) = match model {
            OcrModel::RapidOcrV4 => (
                orc_plugin_path.join("ch_PP-OCRv4_det_infer.onnx"),
                orc_plugin_path.join("ch_ppocr_mobile_v2.0_cls_infer.onnx"),
                orc_plugin_path.join("ch_PP-OCRv4_rec_infer.onnx"),
            ),
            OcrModel::RapidOcrV5 => (
                orc_plugin_path.join("ch_PP-OCRv4_det_infer.onnx"),
                orc_plugin_path.join("ch_ppocr_mobile_v2.0_cls_infer.onnx"),
                orc_plugin_path.join("ch_PP-OCRv5_rec_mobile_infer.onnx"),
            ),
        };

        let model_data = if ocr_model_write_to_memory {
            let (det, cls, rec) = Self::read_model_data(&det_path, &cls_path, &rec_path).await?;
            Some((Arc::new(det), Arc::new(cls), Arc::new(rec)))
        } else {
            None
        };

        self.execution
            .run_admin(move |runtime| {
                runtime.det_model = Some(ModelFile {
                    path: det_path,
                    data: model_data.as_ref().map(|(det, _, _)| Arc::clone(det)),
                });
                runtime.cls_model = Some(ModelFile {
                    path: cls_path,
                    data: model_data.as_ref().map(|(_, cls, _)| Arc::clone(cls)),
                });
                runtime.rec_model = Some(ModelFile {
                    path: rec_path,
                    data: model_data.as_ref().map(|(_, _, rec)| Arc::clone(rec)),
                });
                runtime.hot_start = hot_start;
                if hot_start {
                    runtime.init_session_sync()
                } else {
                    runtime.ocr_core = None;
                    Ok(())
                }
            })
            .await
    }

    /// Release the native session. Hot-start mode recreates it on the same
    /// blocking worker so no model initialization runs on the async executor.
    pub async fn release_session(&mut self) -> Result<(), String> {
        self.execution
            .run_admin(|runtime| {
                if runtime.hot_start {
                    runtime.init_session_sync()
                } else {
                    runtime.ocr_core = None;
                    Ok(())
                }
            })
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn worker_thread_budget_is_bounded() {
        assert_eq!(session_thread_budget(0), (1, 1));
        assert_eq!(session_thread_budget(1), (1, 1));
        assert_eq!(session_thread_budget(2), (2, 1));
        assert_eq!(session_thread_budget(64), (OCR_MAX_INTRA_THREADS, 1));
    }

    #[tokio::test]
    async fn third_request_is_rejected_without_waiting_or_loading_a_session() {
        let handle = OcrExecutionHandle::new();

        let _worker = handle.worker.clone().try_acquire_owned().unwrap();
        assert!(handle.worker.clone().try_acquire_owned().is_err());

        let _active_slot = try_acquire_request_slot(Arc::clone(&handle.request_slots)).unwrap();
        let _queued_slot = try_acquire_request_slot(Arc::clone(&handle.request_slots)).unwrap();
        let error = try_acquire_request_slot(Arc::clone(&handle.request_slots)).unwrap_err();

        assert_eq!(error, "OCR request queue is full");
    }

    #[tokio::test]
    async fn busy_semaphore_wait_is_timed_out() {
        let semaphore = Arc::new(Semaphore::new(1));
        let _held = semaphore.clone().acquire_owned().await.unwrap();

        let error = acquire_with_timeout(
            Arc::clone(&semaphore),
            Duration::from_millis(10),
            "test worker busy",
        )
        .await
        .unwrap_err();

        assert!(error.contains("test worker busy"));
    }

    #[test]
    fn cancellation_guard_marks_dropped_requests() {
        let cancelled = Arc::new(AtomicBool::new(false));
        {
            let _guard = CancellationGuard(Arc::clone(&cancelled));
            assert!(!cancelled.load(Ordering::Acquire));
        }
        assert!(cancelled.load(Ordering::Acquire));
    }
}
