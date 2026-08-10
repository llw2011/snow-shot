use log;
use paddle_ocr_rs::ocr_result::TextBlock;
use serde::Deserialize;
use serde::Serialize;
use snow_shot_app_services::ocr_service::{OcrModel, OcrService};
use std::io::Cursor;
use std::path::PathBuf;
use tauri::command;
use tokio::sync::Mutex;

#[command]
pub async fn ocr_init(
    ocr_service: tauri::State<'_, Mutex<OcrService>>,
    orc_plugin_path: PathBuf,
    model: OcrModel,
    hot_start: bool,
    model_write_to_memory: bool,
) -> Result<(), String> {
    let mut ocr_service = ocr_service.lock().await;

    ocr_service
        .init_models(orc_plugin_path, model, hot_start, model_write_to_memory)
        .await?;

    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct OcrDetectResult {
    pub text_blocks: Vec<TextBlock>,
    pub scale_factor: f32,
}

fn convert_rgba_to_rgb(image: &[u8]) -> Vec<u8> {
    let pixel_count = image.len() / 4;
    let mut rgb_data = Vec::with_capacity(pixel_count * 3);

    // This already runs inside the single bounded OCR blocking worker. A
    // sequential safe copy avoids fanning every request out onto Rayon's
    // global pool and competing with the UI/native runtime for all cores.
    for pixel in image.chunks_exact(4) {
        rgb_data.extend_from_slice(&pixel[..3]);
    }

    rgb_data
}

pub async fn ocr_detect_core(
    ocr_service: tauri::State<'_, Mutex<OcrService>>,
    image: image::DynamicImage,
    scale_factor: f32,
    detect_angle: bool,
) -> Result<OcrDetectResult, String> {
    let execution = {
        // Clone the execution handle while holding the manager state mutex;
        // never hold that mutex while native OCR runs synchronously.
        let service = ocr_service.lock().await;
        service.execution_handle()
    };

    let (text_blocks, scale_factor) = execution
        .run_recognition(move |session| {
            let mut image = image;
            let mut scale_factor = scale_factor;

            // Very small screenshots are enlarged to an effective 1.5 scale.
            let target_scale_factor = 1.5;
            if scale_factor < target_scale_factor && scale_factor > 0.0 {
                let resize_factor = target_scale_factor / scale_factor;
                scale_factor = target_scale_factor;
                image = image.resize(
                    (image.width() as f32 * resize_factor) as u32,
                    (image.height() as f32 * resize_factor) as u32,
                    image::imageops::FilterType::Lanczos3,
                );
            }

            let image_buffer = match image {
                image::DynamicImage::ImageRgb8(image) => image,
                image::DynamicImage::ImageRgba8(image) => {
                    let rgb_data = convert_rgba_to_rgb(image.as_raw());
                    image::RgbImage::from_raw(image.width(), image.height(), rgb_data)
                        .ok_or_else(|| "[ocr_detect_core] Invalid RGBA image".to_string())?
                }
                _ => return Err("[ocr_detect_core] Invalid image".to_string()),
            };

            let max_size = image_buffer.height().max(image_buffer.width());
            let text_blocks = session
                .detect_angle_rollback(
                    &image_buffer,
                    50,
                    max_size,
                    0.5,
                    0.3,
                    1.6,
                    detect_angle,
                    false,
                    0.9,
                )
                .map(|result| result.text_blocks)
                .map_err(|error| format!("[ocr_detect_core] Failed to detect text: {}", error))?;

            Ok((text_blocks, scale_factor))
        })
        .await?;

    Ok(OcrDetectResult {
        text_blocks,
        scale_factor,
    })
}

#[command]
pub async fn ocr_detect(
    ocr_service: tauri::State<'_, Mutex<OcrService>>,
    request: tauri::ipc::Request<'_>,
) -> Result<OcrDetectResult, String> {
    log::info!("[ocr_detect] start detect");

    let image_data = match request.body() {
        tauri::ipc::InvokeBody::Raw(data) => data,
        _ => return Err("[ocr_detect] Invalid request body".to_string()),
    };

    let image = match image::load(Cursor::new(image_data), image::ImageFormat::Png) {
        Ok(image) => image,
        Err(_) => return Err("[ocr_detect] Invalid image".to_string()),
    };

    let scale_factor: f32 = match request.headers().get("x-scale-factor") {
        Some(header) => header
            .to_str()
            .map_err(|_| "[ocr_detect] Invalid scale factor".to_string())?
            .parse::<f32>()
            .map_err(|_| "[ocr_detect] Invalid scale factor".to_string())?,
        None => return Err("[ocr_detect] Missing scale factor".to_string()),
    };
    if !scale_factor.is_finite() || scale_factor <= 0.0 {
        return Err("[ocr_detect] Invalid scale factor".to_string());
    }

    let detect_angle = match request.headers().get("x-detect-angle") {
        Some(header) => header
            .to_str()
            .map_err(|_| "[ocr_detect] Invalid detect angle".to_string())?
            .parse::<bool>()
            .map_err(|_| "[ocr_detect] Invalid detect angle".to_string())?,
        None => return Err("[ocr_detect] Missing detect angle".to_string()),
    };

    ocr_detect_core(ocr_service, image, scale_factor, detect_angle).await
}

#[cfg(target_os = "windows")]
#[command]
pub async fn ocr_detect_with_shared_buffer(
    ocr_service: tauri::State<'_, Mutex<OcrService>>,
    shared_buffer_service: tauri::State<'_, std::sync::Arc<snow_shot_webview::SharedBufferService>>,
    webview: tauri::Webview,
    channel_id: String,
    scale_factor: f32,
    detect_angle: bool,
) -> Result<OcrDetectResult, String> {
    log::info!("[ocr_detect_with_shared_buffer] start detect");

    if !scale_factor.is_finite() || scale_factor <= 0.0 {
        return Err("[ocr_detect_with_shared_buffer] Invalid scale factor".to_string());
    }

    let image_data = match shared_buffer_service
        .receive_data(channel_id, webview)
        .await
    {
        Ok(image_data) => image_data,
        Err(error) => {
            return Err(format!(
                "[ocr_detect_with_shared_buffer] Failed to receive image data: {}",
                error
            ));
        }
    };

    if image_data.len() < 8 {
        return Err("[ocr_detect_with_shared_buffer] Invalid image metadata".to_string());
    }

    let metadata_offset = image_data.len() - 8;
    let image_width = u32::from_le_bytes(
        image_data[metadata_offset..metadata_offset + 4]
            .try_into()
            .map_err(|_| "[ocr_detect_with_shared_buffer] Invalid image width".to_string())?,
    );
    let image_height = u32::from_le_bytes(
        image_data[metadata_offset + 4..]
            .try_into()
            .map_err(|_| "[ocr_detect_with_shared_buffer] Invalid image height".to_string())?,
    );
    let expected_pixel_len = (image_width as usize)
        .checked_mul(image_height as usize)
        .and_then(|len| len.checked_mul(4))
        .ok_or_else(|| "[ocr_detect_with_shared_buffer] Invalid image size".to_string())?;
    if metadata_offset != expected_pixel_len {
        return Err("[ocr_detect_with_shared_buffer] Invalid image size".to_string());
    }
    let pixel_data = image_data[..metadata_offset].to_vec();

    ocr_detect_core(
        ocr_service,
        image::DynamicImage::ImageRgba8(
            match image::RgbaImage::from_raw(image_width, image_height, pixel_data) {
                Some(image) => image,
                None => return Err("[ocr_detect_with_shared_buffer] Invalid image".to_string()),
            },
        ),
        scale_factor,
        detect_angle,
    )
    .await
}

#[command]
pub async fn ocr_release(ocr_service: tauri::State<'_, Mutex<OcrService>>) -> Result<(), String> {
    let mut ocr_service = ocr_service.lock().await;

    ocr_service.release_session().await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::convert_rgba_to_rgb;

    #[test]
    fn rgba_conversion_preserves_rgb_order_and_discards_alpha() {
        let rgba = [1, 2, 3, 4, 10, 20, 30, 40];
        assert_eq!(convert_rgba_to_rgb(&rgba), vec![1, 2, 3, 10, 20, 30]);
    }

    #[test]
    fn rgba_conversion_ignores_incomplete_trailing_pixel() {
        let rgba_with_trailing_bytes = [1, 2, 3, 4, 5, 6];
        assert_eq!(
            convert_rgba_to_rgb(&rgba_with_trailing_bytes),
            vec![1, 2, 3]
        );
    }
}
