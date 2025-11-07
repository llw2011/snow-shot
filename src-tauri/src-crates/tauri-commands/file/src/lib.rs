use base64::prelude::*;
use image::DynamicImage;
use std::path::PathBuf;
use tokio::fs;
use zune_core::bit_depth::BitDepth;
use zune_core::colorspace::ColorSpace;
use zune_core::options::EncoderOptions;
use zune_jpegxl::JxlSimpleEncoder;

pub async fn save_file(request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let file_data = match request.body() {
        tauri::ipc::InvokeBody::Raw(data) => data,
        _ => return Err(String::from("[save_file] Invalid request body")),
    };

    let file_path: PathBuf = match request.headers().get("x-file-path") {
        Some(header) => match BASE64_STANDARD.decode(header.to_str().unwrap()) {
            Ok(file_path) => PathBuf::from(String::from_utf8(file_path).unwrap()),
            Err(_) => return Err(String::from("[save_file] Invalid file path")),
        },
        None => return Err(String::from("[save_file] Missing file path")),
    };

    if let Some(parent_dir) = file_path.parent() {
        if !parent_dir.exists() {
            if let Err(e) = fs::create_dir_all(parent_dir).await {
                return Err(format!(
                    "[save_file] Failed to create directory: {}",
                    e.to_string()
                ));
            }
        }
    }

    let file_type: String = match request.headers().get("x-file-type") {
        Some(header) => match BASE64_STANDARD.decode(header.to_str().unwrap()) {
            Ok(file_type) => String::from_utf8(file_type).unwrap(),
            Err(_) => return Err(String::from("[save_file] Invalid file type")),
        },
        None => return Err(String::from("[save_file] Missing file type")),
    };

    // 如果是 avif 则重写解码写入
    if file_type == "image/avif" {
        let image = match image::load_from_memory_with_format(
            file_data.as_slice(),
            image::ImageFormat::WebP,
        ) {
            Ok(image) => image,
            Err(_) => return Err(String::from("[save_file] Invalid image")),
        };

        return match image.save_with_format(file_path, image::ImageFormat::Avif) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!(
                "[save_file] Failed to save image to file: {}",
                e.to_string()
            )),
        };
    } else if file_type == "image/jpeg-xl" {
        let image = match image::load_from_memory_with_format(
            file_data.as_slice(),
            image::ImageFormat::WebP,
        ) {
            Ok(image) => image,
            Err(_) => return Err(String::from("[save_file] Invalid image")),
        };
        let has_alpha = image.color().has_alpha();
        let image_data = if has_alpha {
            DynamicImage::ImageRgba8(image.to_rgba8())
        } else {
            DynamicImage::ImageRgb8(image.to_rgb8())
        };
        let encoder = JxlSimpleEncoder::new(
            image_data.as_bytes(),
            EncoderOptions::new(
                image.width() as usize,
                image.height() as usize,
                if has_alpha {
                    ColorSpace::RGBA
                } else {
                    ColorSpace::RGB
                },
                BitDepth::Eight,
            ),
        );
        let encoder_result = match encoder.encode() {
            Ok(encoder_result) => encoder_result,
            Err(_) => return Err(String::from("[save_file] Failed to encode image")),
        };
        return match fs::write(file_path, encoder_result).await {
            Ok(_) => Ok(()),
            Err(e) => Err(format!(
                "[save_file] Failed to save image to file: {}",
                e.to_string()
            )),
        };
    }

    match fs::write(file_path, file_data).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!(
            "[save_file] Failed to save image to file: {}",
            e.to_string()
        )),
    }
}

pub async fn write_file(request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let file_data = match request.body() {
        tauri::ipc::InvokeBody::Raw(data) => data,
        _ => return Err(String::from("[write_file] Invalid request body")),
    };

    let file_path: PathBuf = match request.headers().get("x-file-path") {
        Some(header) => match BASE64_STANDARD.decode(header.to_str().unwrap()) {
            Ok(file_path) => PathBuf::from(String::from_utf8(file_path).unwrap()),
            Err(_) => return Err(String::from("[write_file] Invalid file path")),
        },
        None => return Err(String::from("[write_file] Missing file path")),
    };

    if let Some(parent_dir) = file_path.parent() {
        if !parent_dir.exists() {
            if let Err(e) = fs::create_dir_all(parent_dir).await {
                return Err(format!(
                    "[write_file] Failed to create directory: {}",
                    e.to_string()
                ));
            }
        }
    }

    match fs::write(file_path, file_data).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!(
            "[write_file] Failed to save image to file: {}",
            e.to_string()
        )),
    }
}

pub async fn copy_file(from: PathBuf, to: PathBuf) -> Result<(), String> {
    match fs::copy(from, to).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!(
            "[copy_file] Failed to copy file: {}",
            e.to_string()
        )),
    }
}

pub async fn remove_file(file_path: PathBuf) -> Result<(), String> {
    match fs::remove_file(file_path).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!(
            "[remove_file] Failed to remove file: {}",
            e.to_string()
        )),
    }
}
