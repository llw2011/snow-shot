use fast_image_resize::{PixelType, Resizer, images::Image};
use fast_image_resize::{ResizeAlg, ResizeOptions};
use hora::core::ann_index::ANNIndex;
use hora::core::metrics::Metric;
use hora::index::{hnsw_idx::HNSWIndex, hnsw_params::HNSWParams};
use image::{DynamicImage, GenericImageView, GrayImage};
use imageproc::corners;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::sync::atomic::{AtomicUsize, Ordering};

/// Maximum output extent on either scroll axis. The value follows the upstream
/// 2160p x 32 safety boundary while applying it to horizontal captures too.
pub const MAX_SCROLL_SCREENSHOT_WIDTH: u32 = 2_160 * 32;
pub const MAX_SCROLL_SCREENSHOT_HEIGHT: u32 = 2_160 * 32;
/// A stitched RGBA image may contain at most 64 Mi pixels.
pub const MAX_SCROLL_SCREENSHOT_PIXELS: u64 = 64 * 1_024 * 1_024;
/// Keep the single contiguous export allocation at or below 256 MiB.
pub const MAX_SCROLL_SCREENSHOT_BYTES: usize = 256 * 1_024 * 1_024;
const RGBA_CHANNEL_COUNT: usize = 4;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ScrollScreenshotError {
    InvalidDimensions {
        width: u64,
        height: u64,
    },
    FrameDimensionsChanged {
        expected_width: u32,
        expected_height: u32,
        actual_width: u32,
        actual_height: u32,
    },
    InvalidExtent {
        top: i32,
        bottom: i32,
    },
    DimensionLimitExceeded {
        width: u64,
        height: u64,
        max_width: u32,
        max_height: u32,
    },
    PixelLimitExceeded {
        pixels: u64,
        max_pixels: u64,
    },
    ByteLimitExceeded {
        bytes: u64,
        max_bytes: usize,
    },
    ArithmeticOverflow {
        operation: &'static str,
    },
    InvalidScrollDelta {
        delta: i32,
        viewport_extent: u32,
    },
    UnsupportedPixelFormat {
        color_type: image::ColorType,
    },
    OutputBoundsExceeded {
        offset_x: i64,
        offset_y: i64,
        image_width: u32,
        image_height: u32,
        output_width: u32,
        output_height: u32,
    },
    AllocationFailed {
        bytes: usize,
    },
}

impl fmt::Display for ScrollScreenshotError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidDimensions { width, height } => {
                write!(
                    formatter,
                    "invalid scroll screenshot dimensions: {width}x{height}"
                )
            }
            Self::FrameDimensionsChanged {
                expected_width,
                expected_height,
                actual_width,
                actual_height,
            } => write!(
                formatter,
                "scroll screenshot frame size changed from {expected_width}x{expected_height} to {actual_width}x{actual_height}"
            ),
            Self::InvalidExtent { top, bottom } => write!(
                formatter,
                "invalid stitched scroll extents: top={top}, bottom={bottom}"
            ),
            Self::DimensionLimitExceeded {
                width,
                height,
                max_width,
                max_height,
            } => write!(
                formatter,
                "scroll screenshot dimensions {width}x{height} exceed the {max_width}x{max_height} limit"
            ),
            Self::PixelLimitExceeded { pixels, max_pixels } => write!(
                formatter,
                "scroll screenshot has {pixels} pixels, exceeding the {max_pixels} pixel limit"
            ),
            Self::ByteLimitExceeded { bytes, max_bytes } => write!(
                formatter,
                "scroll screenshot requires {bytes} RGBA bytes, exceeding the {max_bytes} byte limit"
            ),
            Self::ArithmeticOverflow { operation } => {
                write!(
                    formatter,
                    "scroll screenshot size overflow while {operation}"
                )
            }
            Self::InvalidScrollDelta {
                delta,
                viewport_extent,
            } => write!(
                formatter,
                "scroll delta {delta} exceeds the {viewport_extent} pixel viewport extent"
            ),
            Self::UnsupportedPixelFormat { color_type } => write!(
                formatter,
                "scroll screenshot requires RGBA8 input, received {color_type:?}"
            ),
            Self::OutputBoundsExceeded {
                offset_x,
                offset_y,
                image_width,
                image_height,
                output_width,
                output_height,
            } => write!(
                formatter,
                "scroll image {image_width}x{image_height} at ({offset_x}, {offset_y}) exceeds output bounds {output_width}x{output_height}"
            ),
            Self::AllocationFailed { bytes } => write!(
                formatter,
                "failed to reserve {bytes} bytes for the stitched scroll screenshot"
            ),
        }
    }
}

impl std::error::Error for ScrollScreenshotError {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct OutputLayout {
    width: u32,
    height: u32,
    pixel_count: usize,
    byte_len: usize,
}

fn checked_rgba_byte_len(pixel_count: u64) -> Result<usize, ScrollScreenshotError> {
    let bytes = pixel_count.checked_mul(RGBA_CHANNEL_COUNT as u64).ok_or(
        ScrollScreenshotError::ArithmeticOverflow {
            operation: "calculating RGBA byte length",
        },
    )?;

    if bytes > MAX_SCROLL_SCREENSHOT_BYTES as u64 {
        return Err(ScrollScreenshotError::ByteLimitExceeded {
            bytes,
            max_bytes: MAX_SCROLL_SCREENSHOT_BYTES,
        });
    }

    usize::try_from(bytes).map_err(|_| ScrollScreenshotError::ArithmeticOverflow {
        operation: "converting RGBA byte length to usize",
    })
}

fn checked_output_layout(width: u64, height: u64) -> Result<OutputLayout, ScrollScreenshotError> {
    if width == 0 || height == 0 {
        return Err(ScrollScreenshotError::InvalidDimensions { width, height });
    }

    if width > MAX_SCROLL_SCREENSHOT_WIDTH as u64 || height > MAX_SCROLL_SCREENSHOT_HEIGHT as u64 {
        return Err(ScrollScreenshotError::DimensionLimitExceeded {
            width,
            height,
            max_width: MAX_SCROLL_SCREENSHOT_WIDTH,
            max_height: MAX_SCROLL_SCREENSHOT_HEIGHT,
        });
    }

    let pixel_count =
        width
            .checked_mul(height)
            .ok_or(ScrollScreenshotError::ArithmeticOverflow {
                operation: "calculating total pixel count",
            })?;

    if pixel_count > MAX_SCROLL_SCREENSHOT_PIXELS {
        return Err(ScrollScreenshotError::PixelLimitExceeded {
            pixels: pixel_count,
            max_pixels: MAX_SCROLL_SCREENSHOT_PIXELS,
        });
    }

    let byte_len = checked_rgba_byte_len(pixel_count)?;

    Ok(OutputLayout {
        width: u32::try_from(width).map_err(|_| ScrollScreenshotError::ArithmeticOverflow {
            operation: "converting output width to u32",
        })?,
        height: u32::try_from(height).map_err(|_| ScrollScreenshotError::ArithmeticOverflow {
            operation: "converting output height to u32",
        })?,
        pixel_count: usize::try_from(pixel_count).map_err(|_| {
            ScrollScreenshotError::ArithmeticOverflow {
                operation: "converting pixel count to usize",
            }
        })?,
        byte_len,
    })
}

#[derive(PartialEq, Serialize, Deserialize, Debug, Clone, Copy)]
pub enum ScrollDirection {
    /// 垂直滚动
    Vertical = 0,
    /// 水平滚动
    Horizontal = 1,
}

#[derive(PartialEq, Serialize, Deserialize, Debug, Clone, Copy)]
pub enum ScrollImageList {
    /// 上图片列表
    Top = 0,
    /// 下图片列表
    Bottom = 1,
}

#[derive(Debug, Clone, Copy, Eq, Hash, PartialEq)]
pub struct ScrollOffset {
    pub x: i32,
    pub y: i32,
}

impl ScrollOffset {
    pub fn new(x: i32, y: i32) -> Self {
        Self { x, y }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct CropRegion {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

impl CropRegion {
    pub fn new(x: u32, y: u32, width: u32, height: u32) -> Self {
        Self {
            x,
            y,
            width,
            height,
        }
    }
}

#[derive(Debug)]
pub struct ScrollIndex {
    pub position: i32,
    pub ann_index: HNSWIndex<f32, usize>,
    pub corners: Vec<ScrollOffset>,
    pub descriptors: Vec<Vec<f32>>,
}

impl ScrollIndex {
    pub fn new(dimension: usize) -> Self {
        let mut index_params = HNSWParams::<f32>::default();
        index_params.ef_search = 24;
        index_params.ef_build = 12;

        Self {
            position: 0,
            ann_index: HNSWIndex::new(dimension, &index_params),
            corners: vec![],
            descriptors: vec![],
        }
    }
}

pub struct ScrollImage {
    pub image: image::DynamicImage,
    pub overlay_size: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RejectedFrameDecision {
    ProcessNew,
    RetryOnce,
    SkipDuplicate,
}

struct RejectedFrameCandidate {
    image: DynamicImage,
    scroll_image_list: ScrollImageList,
    retry_attempted: bool,
}

#[derive(Default)]
struct RejectedFrameRetry {
    candidate: Option<RejectedFrameCandidate>,
}

impl RejectedFrameRetry {
    fn begin(
        &mut self,
        image: &DynamicImage,
        scroll_image_list: ScrollImageList,
    ) -> RejectedFrameDecision {
        let Some(candidate) = self.candidate.as_mut() else {
            return RejectedFrameDecision::ProcessNew;
        };

        let exact_duplicate = candidate.scroll_image_list == scroll_image_list
            && candidate.image.dimensions() == image.dimensions()
            && candidate.image.color() == image.color()
            && candidate.image.as_bytes() == image.as_bytes();

        if !exact_duplicate {
            self.candidate = None;
            return RejectedFrameDecision::ProcessNew;
        }

        if candidate.retry_attempted {
            RejectedFrameDecision::SkipDuplicate
        } else {
            candidate.retry_attempted = true;
            RejectedFrameDecision::RetryOnce
        }
    }

    fn record_rejection(
        &mut self,
        image: DynamicImage,
        scroll_image_list: ScrollImageList,
        decision: RejectedFrameDecision,
    ) {
        if decision == RejectedFrameDecision::ProcessNew {
            self.candidate = Some(RejectedFrameCandidate {
                image,
                scroll_image_list,
                retry_attempted: false,
            });
        }
    }

    fn clear(&mut self) {
        self.candidate = None;
    }
}

pub struct ScrollScreenshotService {
    /// 滚动截图列表（上或左）
    pub top_image_list: Vec<ScrollImage>,
    /// 滚动截图列表（下或右）
    pub bottom_image_list: Vec<ScrollImage>,
    /// 当前方向
    pub current_direction: ScrollDirection,
    /// 图片宽度
    pub image_width: u32,
    /// 图片高度
    pub image_height: u32,
    /// 上图片尺寸（方向边）
    pub top_image_size: i32,
    /// 上图片索引尺寸（方向边）
    pub top_image_index_size: i32,
    /// 下图片尺寸（方向边）
    pub bottom_image_size: i32,
    /// 下图片索引尺寸（方向边）
    pub bottom_image_index_size: i32,
    /// 图片缩放
    pub image_scale: f32,
    /// 图片缩放器
    pub image_resizer: Resizer,
    /// 特征点阈值
    pub corner_threshold: u8,
    /// 描述符块大小
    pub descriptor_patch_size: usize,
    /// 特征点索引（上或右）
    pub top_image_ann_index: ScrollIndex,
    /// 特征点索引（下或左）
    pub bottom_image_ann_index: ScrollIndex,
    /// 最小变化量（高于该值才会建立索引）
    pub min_size_delta: i32,
    /// 缩放的图片宽度
    pub image_dst_width: u32,
    /// 缩放的图片高度
    pub image_dst_height: u32,
    /// 滚动方向的图片尺寸
    pub image_scroll_side_size: i32,
    /// 是否启用 fast12 算法进行角点检测
    pub enable_corner_fast12: Option<bool>,
    /// 是否尝试回滚
    pub try_rollback: bool,
    /// 采样率
    pub sample_rate: f32,
    /// 最小采样尺寸
    pub min_sample_size: u32,
    /// 最大采样尺寸
    pub max_sample_size: u32,
    /// A rejected candidate may be re-estimated only when the next raw frame
    /// is an exact duplicate. Further duplicates are treated as no movement.
    rejected_frame_retry: RejectedFrameRetry,
}

impl ScrollScreenshotService {
    fn checked_axis_size(&self) -> Result<i32, ScrollScreenshotError> {
        if self.top_image_size < 0 || self.bottom_image_size < 0 {
            return Err(ScrollScreenshotError::InvalidExtent {
                top: self.top_image_size,
                bottom: self.bottom_image_size,
            });
        }

        self.top_image_size
            .checked_add(self.bottom_image_size)
            .ok_or(ScrollScreenshotError::ArithmeticOverflow {
                operation: "adding stitched scroll extents",
            })
    }

    fn checked_layout_with_added_extent(
        &self,
        added_extent: i32,
    ) -> Result<OutputLayout, ScrollScreenshotError> {
        if added_extent < 0 {
            return Err(ScrollScreenshotError::InvalidScrollDelta {
                delta: added_extent,
                viewport_extent: self.image_scroll_side_size.max(0) as u32,
            });
        }

        let axis_size = self.checked_axis_size()?.checked_add(added_extent).ok_or(
            ScrollScreenshotError::ArithmeticOverflow {
                operation: "adding a captured scroll extent",
            },
        )?;

        let axis_size =
            u64::try_from(axis_size).map_err(|_| ScrollScreenshotError::ArithmeticOverflow {
                operation: "converting stitched scroll extent",
            })?;

        if self.current_direction == ScrollDirection::Vertical {
            checked_output_layout(self.image_width as u64, axis_size)
        } else {
            checked_output_layout(axis_size, self.image_height as u64)
        }
    }

    fn checked_current_layout(&self) -> Result<OutputLayout, ScrollScreenshotError> {
        self.checked_layout_with_added_extent(0)
    }

    fn overlay_checked(
        output: &mut Vec<u8>,
        layout: OutputLayout,
        image: &DynamicImage,
        offset_x: i64,
        offset_y: i64,
    ) -> Result<(), ScrollScreenshotError> {
        if image.color() != image::ColorType::Rgba8 {
            return Err(ScrollScreenshotError::UnsupportedPixelFormat {
                color_type: image.color(),
            });
        }

        let image_width = image.width();
        let image_height = image.height();
        let end_x = offset_x.checked_add(image_width as i64);
        let end_y = offset_y.checked_add(image_height as i64);
        let within_bounds = offset_x >= 0
            && offset_y >= 0
            && end_x.is_some_and(|value| value <= layout.width as i64)
            && end_y.is_some_and(|value| value <= layout.height as i64);

        if !within_bounds {
            return Err(ScrollScreenshotError::OutputBoundsExceeded {
                offset_x,
                offset_y,
                image_width,
                image_height,
                output_width: layout.width,
                output_height: layout.height,
            });
        }

        snow_shot_app_utils::overlay_image(
            output,
            layout.width as usize,
            image,
            offset_x as usize,
            offset_y as usize,
            RGBA_CHANNEL_COUNT,
        );

        Ok(())
    }

    fn get_descriptor_size(&self) -> usize {
        self.descriptor_patch_size & !1
    }

    fn compute_descriptor(&self, img: &image::GrayImage, corner: &ScrollOffset) -> Vec<f32> {
        let descriptor_size = self.descriptor_patch_size;
        let mut descriptor = Vec::with_capacity(self.get_descriptor_size());
        let half_size = descriptor_size as i32 / 2;

        let corner_x = corner.x;
        let corner_y = corner.y;
        let width = img.width() as i32;
        let height = img.height() as i32;

        // 计算行特征
        for row in 0..(descriptor_size / 2) {
            let y = corner_y + (-half_size + row as i32 * 2);
            let mut sum = 0.0;
            let mut valid_pixels = 0;

            for col in 0..(descriptor_size / 2) {
                let x = corner_x + (-half_size + col as i32 * 2);

                if x >= 0 && x < width && y >= 0 && y < height {
                    let pixel = unsafe { img.unsafe_get_pixel(x as u32, y as u32) };
                    sum += pixel[0] as f32 / 255.0;
                    valid_pixels += 1;
                }
            }

            descriptor.push(if valid_pixels > 0 {
                sum / valid_pixels as f32
            } else {
                0.0
            });
        }

        // 计算列特征
        for col in 0..(descriptor_size / 2) {
            let x = corner_x + (-half_size + col as i32 * 2);
            let mut sum = 0.0;
            let mut valid_pixels = 0;

            for row in 0..(descriptor_size / 2) {
                let y = corner_y + (-half_size + row as i32 * 2);

                if x >= 0 && x < width && y >= 0 && y < height {
                    let pixel = unsafe { img.unsafe_get_pixel(x as u32, y as u32) };
                    sum += pixel[0] as f32 / 255.0;
                    valid_pixels += 1;
                }
            }

            descriptor.push(if valid_pixels > 0 {
                sum / valid_pixels as f32
            } else {
                0.0
            });
        }

        descriptor
    }

    fn euclidean_distance(a: &[f32], b: &[f32]) -> f32 {
        a.iter()
            .zip(b.iter())
            .map(|(x, y)| (x - y).powi(2))
            .sum::<f32>()
            .sqrt()
    }

    pub fn new() -> Self {
        Self {
            top_image_list: vec![],
            bottom_image_list: vec![],
            current_direction: ScrollDirection::Vertical,
            image_width: 0,
            image_height: 0,
            top_image_size: 0,
            top_image_index_size: 0,
            bottom_image_size: 0,
            bottom_image_index_size: 0,
            image_scale: 1.0,
            image_resizer: Resizer::new(),
            corner_threshold: 64,
            descriptor_patch_size: 9,
            min_size_delta: 64,
            image_dst_width: 0,
            image_dst_height: 0,
            image_scroll_side_size: 0,
            top_image_ann_index: ScrollIndex::new(0),
            bottom_image_ann_index: ScrollIndex::new(0),
            enable_corner_fast12: None,
            try_rollback: false,
            sample_rate: 0.0,
            min_sample_size: 0,
            max_sample_size: 0,
            rejected_frame_retry: RejectedFrameRetry::default(),
        }
    }

    pub fn clear(&mut self) {
        self.top_image_list.clear();
        self.bottom_image_list.clear();
        self.top_image_ann_index = ScrollIndex::new(0);
        self.bottom_image_ann_index = ScrollIndex::new(0);
        self.rejected_frame_retry.clear();
    }

    pub fn init(
        &mut self,
        direction: ScrollDirection,
        sample_rate: f32,
        min_sample_size: u32,
        max_sample_size: u32,
        corner_threshold: u8,
        descriptor_patch_size: usize,
        min_size_delta: i32,
        try_rollback: bool,
    ) {
        self.top_image_list.clear();
        self.bottom_image_list.clear();
        self.current_direction = direction;
        self.image_width = 0;
        self.image_height = 0;
        self.top_image_size = 0;
        self.bottom_image_size = 0;
        self.corner_threshold = corner_threshold;
        self.descriptor_patch_size = descriptor_patch_size;
        self.min_size_delta = min_size_delta;
        self.top_image_index_size = 0;
        self.bottom_image_index_size = 0;
        self.top_image_ann_index = ScrollIndex::new(self.get_descriptor_size());
        self.bottom_image_ann_index = ScrollIndex::new(self.get_descriptor_size());
        self.try_rollback = try_rollback;
        self.enable_corner_fast12 = None;
        self.sample_rate = sample_rate;
        self.min_sample_size = min_sample_size;
        self.max_sample_size = max_sample_size;
        self.rejected_frame_retry.clear();
    }

    pub fn init_image_size(
        &mut self,
        image_width: u32,
        image_height: u32,
    ) -> Result<(), ScrollScreenshotError> {
        checked_output_layout(image_width as u64, image_height as u64)?;

        let image_scale_side_size;
        if self.current_direction == ScrollDirection::Vertical {
            image_scale_side_size = image_width as f32;
        } else {
            image_scale_side_size = image_height as f32;
        }

        let target_side_size = (image_scale_side_size * self.sample_rate)
            .min(self.max_sample_size as f32)
            .max(self.min_sample_size as f32);

        let image_scale = (target_side_size / image_scale_side_size).min(1.0);

        let (image_dst_width, image_dst_height) =
            if self.current_direction == ScrollDirection::Vertical {
                ((image_width as f32 * image_scale) as u32, image_height)
            } else {
                (image_width, (image_height as f32 * image_scale) as u32)
            };

        if image_dst_width == 0 || image_dst_height == 0 {
            return Err(ScrollScreenshotError::InvalidDimensions {
                width: image_dst_width as u64,
                height: image_dst_height as u64,
            });
        }

        let image_scroll_side_size = if self.current_direction == ScrollDirection::Vertical {
            i32::try_from(image_height).map_err(|_| ScrollScreenshotError::ArithmeticOverflow {
                operation: "converting vertical viewport extent to i32",
            })?
        } else {
            i32::try_from(image_width).map_err(|_| ScrollScreenshotError::ArithmeticOverflow {
                operation: "converting horizontal viewport extent to i32",
            })?
        };

        self.image_width = image_width;
        self.image_height = image_height;
        self.image_scale = image_scale;
        self.image_dst_width = image_dst_width;
        self.image_dst_height = image_dst_height;
        self.image_scroll_side_size = image_scroll_side_size;

        Ok(())
    }

    fn get_descriptors(
        &self,
        image: &image::ImageBuffer<image::Luma<u8>, Vec<u8>>,
        corners: &[ScrollOffset],
    ) -> Vec<Vec<f32>> {
        corners
            .par_iter()
            .map(|corner| self.compute_descriptor(image, corner))
            .collect()
    }

    fn get_gray_image(&mut self, image: &DynamicImage) -> GrayImage {
        let image_width = image.width();
        let image_height = image.height();

        // 先转为灰度图再缩放，效率更高
        let mut gray_image = image.to_luma8();

        if self.image_scale >= 1.0 {
            return gray_image;
        }

        let src_image = Image::from_slice_u8(
            image_width,
            image_height,
            gray_image.as_mut(),
            PixelType::U8,
        )
        .unwrap();

        let mut dst_image = Image::new(self.image_dst_width, self.image_dst_height, PixelType::U8);

        self.image_resizer
            .resize(
                &src_image,
                &mut dst_image,
                &ResizeOptions::new().resize_alg(ResizeAlg::Nearest),
            )
            .unwrap();

        GrayImage::from_vec(
            self.image_dst_width,
            self.image_dst_height,
            dst_image.into_vec(),
        )
        .unwrap()
    }

    fn get_crop_region(&self, delta_size: i32) -> Result<CropRegion, ScrollScreenshotError> {
        let image_width = self.image_width;
        let image_height = self.image_height;
        let delta_abs =
            delta_size
                .checked_abs()
                .ok_or(ScrollScreenshotError::ArithmeticOverflow {
                    operation: "taking the absolute scroll crop delta",
                })? as u32;

        if self.current_direction == ScrollDirection::Vertical {
            if delta_abs > image_height {
                return Err(ScrollScreenshotError::InvalidScrollDelta {
                    delta: delta_size,
                    viewport_extent: image_height,
                });
            }
            let start_position = image_height - delta_abs;
            if delta_size > 0 {
                Ok(CropRegion::new(
                    0,
                    start_position,
                    image_width,
                    image_height - start_position,
                ))
            } else {
                Ok(CropRegion::new(
                    0,
                    0,
                    image_width,
                    image_height - start_position,
                ))
            }
        } else {
            if delta_abs > image_width {
                return Err(ScrollScreenshotError::InvalidScrollDelta {
                    delta: delta_size,
                    viewport_extent: image_width,
                });
            }
            let start_position = image_width - delta_abs;
            if start_position > 0 {
                Ok(CropRegion::new(
                    start_position,
                    0,
                    image_width - start_position,
                    image_height,
                ))
            } else {
                Ok(CropRegion::new(
                    0,
                    0,
                    image_width - start_position,
                    image_height,
                ))
            }
        }
    }

    fn get_corners(&mut self, image: &image::GrayImage) -> Vec<ScrollOffset> {
        let corners;
        if self.enable_corner_fast12.is_none() {
            let fast12_corners = corners::corners_fast12(image, self.corner_threshold);

            if fast12_corners.len() > 200 {
                corners = fast12_corners;
                self.enable_corner_fast12 = Some(true);
            } else {
                corners = corners::corners_fast9(image, self.corner_threshold);
                self.enable_corner_fast12 = Some(false);
            }
        } else {
            if self.enable_corner_fast12.unwrap() {
                corners = corners::corners_fast12(image, self.corner_threshold);
            } else {
                corners = corners::corners_fast9(image, self.corner_threshold);
            }
        }

        corners
            .iter()
            .map(|corner| ScrollOffset {
                x: corner.x as i32,
                y: corner.y as i32,
            })
            .collect()
    }

    fn build_index(
        &mut self,
        gray_image: image::GrayImage,
        image_corners: &[ScrollOffset],
        edge_position: i32,
        index_edge_position_distance: i32,
    ) -> Result<(), ScrollScreenshotError> {
        let mut new_scroll_index = ScrollIndex::new(self.get_descriptor_size());

        new_scroll_index.descriptors = self.get_descriptors(&gray_image, &image_corners);

        new_scroll_index.corners = image_corners.to_vec();

        new_scroll_index
            .descriptors
            .iter()
            .enumerate()
            .for_each(|(i, descriptor)| {
                new_scroll_index.ann_index.add(descriptor, i).unwrap();
            });

        new_scroll_index.ann_index.build(Metric::Euclidean).unwrap();

        let index_position = if edge_position > 0 {
            self.bottom_image_index_size
                .checked_sub(index_edge_position_distance)
        } else {
            self.top_image_index_size
                .checked_sub(index_edge_position_distance)
                .and_then(|value| value.checked_neg())
        }
        .ok_or(ScrollScreenshotError::ArithmeticOverflow {
            operation: "calculating scroll index position",
        })?;

        new_scroll_index.position = index_position;

        if edge_position > 0 {
            self.bottom_image_ann_index = new_scroll_index;
        } else {
            self.top_image_ann_index = new_scroll_index;
        }

        Ok(())
    }

    fn add_index(
        &mut self,
        image: image::DynamicImage,
        gray_image: image::GrayImage,
        image_corners: Vec<ScrollOffset>,
        edge_position: i32,
        delta_size: i32,
    ) -> Result<(ScrollImage, i32), ScrollScreenshotError> {
        let mut index_delta_size = 0;

        let image_scroll_side_size = self.image_scroll_side_size;

        let index_edge_position_distance = if delta_size > 0 {
            edge_position
                .checked_sub(image_scroll_side_size)
                .and_then(|value| self.bottom_image_index_size.checked_sub(value))
        } else {
            self.top_image_index_size.checked_add(edge_position)
        }
        .ok_or(ScrollScreenshotError::ArithmeticOverflow {
            operation: "calculating scroll index distance",
        })?;

        if index_edge_position_distance <= self.min_size_delta {
            index_delta_size = image_scroll_side_size
                .checked_sub(index_edge_position_distance)
                .ok_or(ScrollScreenshotError::ArithmeticOverflow {
                    operation: "calculating scroll index extent",
                })?;
            self.build_index(
                gray_image,
                &image_corners,
                edge_position,
                index_edge_position_distance,
            )?;
        }

        // 一半的区域在拼接时允许
        let delta_abs =
            delta_size
                .checked_abs()
                .ok_or(ScrollScreenshotError::ArithmeticOverflow {
                    operation: "taking the absolute scroll delta",
                })?;
        if delta_abs > image_scroll_side_size {
            return Err(ScrollScreenshotError::InvalidScrollDelta {
                delta: delta_size,
                viewport_extent: image_scroll_side_size.max(0) as u32,
            });
        }
        let image_overlay_size = (image_scroll_side_size / 2 - delta_abs).max(0);
        let image_overlay_size = if delta_size > 0 {
            image_overlay_size
        } else {
            image_overlay_size
                .checked_neg()
                .ok_or(ScrollScreenshotError::ArithmeticOverflow {
                    operation: "calculating image overlay size",
                })?
        };

        let crop_delta = delta_size.checked_add(image_overlay_size).ok_or(
            ScrollScreenshotError::ArithmeticOverflow {
                operation: "calculating crop delta",
            },
        )?;
        let crop_region = self.get_crop_region(crop_delta)?;

        Ok((
            ScrollImage {
                image: image.crop_imm(
                    crop_region.x,
                    crop_region.y,
                    crop_region.width,
                    crop_region.height,
                ),
                overlay_size: image_overlay_size,
            },
            index_delta_size,
        ))
    }

    fn push_image(
        &mut self,
        image: image::DynamicImage,
        gray_image: image::GrayImage,
        image_corners: Vec<ScrollOffset>,
        index_position: i32,
        origin_position: ScrollOffset,
        new_position: ScrollOffset,
    ) -> Result<(i32, Option<ScrollImageList>), ScrollScreenshotError> {
        let image_scroll_side_size = if self.current_direction == ScrollDirection::Vertical {
            self.image_height
        } else {
            self.image_width
        };
        let image_scroll_side_size_i32 = i32::try_from(image_scroll_side_size).map_err(|_| {
            ScrollScreenshotError::ArithmeticOverflow {
                operation: "converting viewport extent to i32",
            }
        })?;

        let position_offset = if self.current_direction == ScrollDirection::Vertical {
            ScrollOffset {
                x: origin_position.x.checked_sub(new_position.x).ok_or(
                    ScrollScreenshotError::ArithmeticOverflow {
                        operation: "calculating vertical x offset",
                    },
                )?,
                y: origin_position
                    .y
                    .checked_sub(new_position.y)
                    .and_then(|value| value.checked_add(index_position))
                    .ok_or(ScrollScreenshotError::ArithmeticOverflow {
                        operation: "calculating vertical y offset",
                    })?,
            }
        } else {
            ScrollOffset {
                x: origin_position
                    .x
                    .checked_sub(new_position.x)
                    .and_then(|value| value.checked_add(index_position))
                    .ok_or(ScrollScreenshotError::ArithmeticOverflow {
                        operation: "calculating horizontal x offset",
                    })?,
                y: origin_position.y.checked_sub(new_position.y).ok_or(
                    ScrollScreenshotError::ArithmeticOverflow {
                        operation: "calculating horizontal y offset",
                    },
                )?,
            }
        };

        // 计算边缘位置
        let edge_position = if self.current_direction == ScrollDirection::Vertical {
            if position_offset.y >= 0 {
                position_offset
                    .y
                    .checked_add(image_scroll_side_size_i32)
                    .ok_or(ScrollScreenshotError::ArithmeticOverflow {
                        operation: "calculating vertical edge position",
                    })?
            } else {
                position_offset.y
            }
        } else {
            if position_offset.x >= 0 {
                position_offset
                    .x
                    .checked_add(image_scroll_side_size_i32)
                    .ok_or(ScrollScreenshotError::ArithmeticOverflow {
                        operation: "calculating horizontal edge position",
                    })?
            } else {
                position_offset.x
            }
        };

        // 处理新增区域
        let edge_position_abs =
            edge_position
                .checked_abs()
                .ok_or(ScrollScreenshotError::ArithmeticOverflow {
                    operation: "taking the absolute edge position",
                })?;
        let (delta_size, is_bottom) =
            if edge_position >= 0 && edge_position >= self.bottom_image_size {
                (
                    edge_position.checked_sub(self.bottom_image_size).ok_or(
                        ScrollScreenshotError::ArithmeticOverflow {
                            operation: "calculating bottom scroll delta",
                        },
                    )?,
                    true,
                )
            } else if edge_position < 0 && edge_position_abs >= self.top_image_size {
                (
                    edge_position.checked_add(self.top_image_size).ok_or(
                        ScrollScreenshotError::ArithmeticOverflow {
                            operation: "calculating top scroll delta",
                        },
                    )?,
                    false,
                )
            } else {
                return Ok((edge_position, None)); // 没有新增区域或变化太小
            };

        if delta_size == 0 {
            return Ok((edge_position, None));
        }

        let delta_abs =
            delta_size
                .checked_abs()
                .ok_or(ScrollScreenshotError::ArithmeticOverflow {
                    operation: "taking the absolute scroll delta",
                })?;
        if delta_abs as u32 > image_scroll_side_size {
            return Err(ScrollScreenshotError::InvalidScrollDelta {
                delta: delta_size,
                viewport_extent: image_scroll_side_size,
            });
        }
        self.checked_layout_with_added_extent(delta_abs)?;

        let (cropped_image, index_delta_size) =
            self.add_index(image, gray_image, image_corners, edge_position, delta_size)?;

        if is_bottom {
            let new_bottom_size = self.bottom_image_size.checked_add(delta_size).ok_or(
                ScrollScreenshotError::ArithmeticOverflow {
                    operation: "updating bottom scroll extent",
                },
            )?;
            let new_bottom_index_size = self
                .bottom_image_index_size
                .checked_add(index_delta_size)
                .ok_or(ScrollScreenshotError::ArithmeticOverflow {
                    operation: "updating bottom scroll index extent",
                })?;
            self.bottom_image_list.push(cropped_image);
            self.bottom_image_size = new_bottom_size;
            self.bottom_image_index_size = new_bottom_index_size;

            Ok((edge_position, Some(ScrollImageList::Bottom)))
        } else {
            let new_top_size = self.top_image_size.checked_sub(delta_size).ok_or(
                ScrollScreenshotError::ArithmeticOverflow {
                    operation: "updating top scroll extent",
                },
            )?;
            let new_top_index_size = self
                .top_image_index_size
                .checked_add(index_delta_size)
                .ok_or(ScrollScreenshotError::ArithmeticOverflow {
                    operation: "updating top scroll index extent",
                })?;
            self.top_image_list.push(cropped_image);
            self.top_image_size = new_top_size;
            self.top_image_index_size = new_top_index_size;

            Ok((edge_position, Some(ScrollImageList::Top)))
        }
    }

    pub fn get_offsets<'a>(
        &self,
        index: &'a ScrollIndex,
        image_descriptors: &[Vec<f32>],
        image_corners: &[ScrollOffset],
        scroll_image_list: ScrollImageList,
    ) -> (Option<(&'a ScrollIndex, usize, usize)>, bool) {
        let image_scroll_side_size = if self.current_direction == ScrollDirection::Vertical {
            self.image_height as i32
        } else {
            self.image_width as i32
        };
        let min_diff = if scroll_image_list == ScrollImageList::Bottom {
            -(self.bottom_image_size - image_scroll_side_size + 1) + index.position
        } else {
            (self.top_image_size + 1) + index.position
        };

        let min_diff_count = AtomicUsize::new(0);

        let offsets: Vec<(i32, &'a ScrollIndex, usize, usize)> = image_descriptors
            .par_iter()
            .enumerate()
            .filter_map(|(i, descriptor)| {
                let search_result = index.ann_index.search(descriptor, 1);
                if search_result.is_empty() {
                    return None;
                }

                let idx1 = search_result[0];
                let dist = Self::euclidean_distance(&index.descriptors[idx1], descriptor);

                let point1 = &index.corners[idx1];
                let point2 = &image_corners[i];
                let dy = point2.y - point1.y;
                let dx = point2.x - point1.x;

                let diff: i32 = if self.current_direction == ScrollDirection::Vertical {
                    if dx != 0 {
                        return None;
                    }

                    dy
                } else {
                    if dy != 0 {
                        return None;
                    }

                    dx
                };

                if min_diff < 0 && min_diff < diff {
                    min_diff_count.fetch_add(1, Ordering::Relaxed);
                    return None;
                }

                if min_diff > 0 && min_diff > diff {
                    min_diff_count.fetch_add(1, Ordering::Relaxed);
                    return None;
                }

                if dist < 0.1 {
                    Some((diff, index, idx1, i))
                } else {
                    None
                }
            })
            .collect();

        if min_diff_count.load(Ordering::Relaxed) > (image_corners.len() as f32 * 0.72) as usize {
            return (None, true);
        }

        if offsets.is_empty() {
            return (None, false);
        }

        // 寻找频率最高的偏移作为主要偏移模式
        let mut offset_counts: std::collections::HashMap<i32, (i32, &ScrollIndex, usize, usize)> =
            std::collections::HashMap::new();
        for (offset, scroll_index, origin_position_index, new_position_index) in offsets {
            if let Some(value) = offset_counts.get_mut(&offset) {
                value.0 += 1;
            } else {
                offset_counts.insert(
                    offset,
                    (1, scroll_index, origin_position_index, new_position_index),
                );
            }
        }

        // let mut sorted_offsets: Vec<_> = offset_counts.iter().collect();
        // sorted_offsets.sort_by_key(|(_, (count, _, _, _))| -count);
        // println!(
        //     "sorted_offsets: {:?}",
        //     sorted_offsets[..10.min(sorted_offsets.len())]
        //         .iter()
        //         .map(|(offset, (count, _, _, _))| (offset, count))
        //         .collect::<Vec<_>>()
        // );

        let mut max_count = 0;
        let mut second_max_count = 0;
        let mut max_offset = None;

        for (_, (count, scroll_index, origin_idx, new_idx)) in &offset_counts {
            if *count > max_count {
                second_max_count = max_count;
                max_count = *count;
                max_offset = Some((scroll_index, origin_idx, new_idx));
            } else if *count > second_max_count {
                second_max_count = *count;
            }
        }

        let max_offset = match max_offset {
            Some(offset) => offset,
            None => return (None, false),
        };

        if max_count < (image_corners.len() as i32 / 10) {
            return (None, false);
        }

        if max_count < second_max_count * 2 {
            return (None, false);
        }

        let (dominant_scroll_index, dominant_origin_position_index, dominant_new_position_index) =
            max_offset;

        (
            Some((
                dominant_scroll_index,
                *dominant_origin_position_index,
                *dominant_new_position_index,
            )),
            false,
        )
    }

    fn try_handle_image_once(
        &mut self,
        image: DynamicImage,
        scroll_image_list: ScrollImageList,
    ) -> Result<
        (
            Option<(i32, Option<ScrollImageList>)>,
            bool,
            ScrollImageList,
        ),
        ScrollScreenshotError,
    > {
        let image_width = image.width();
        let image_height = image.height();
        checked_output_layout(image_width as u64, image_height as u64)?;

        if image.color() != image::ColorType::Rgba8 {
            return Err(ScrollScreenshotError::UnsupportedPixelFormat {
                color_type: image.color(),
            });
        }

        if self.image_width == 0 || self.image_height == 0 {
            // 在首次处理图片时初始化图片尺寸
            // 因为在 macOS 下，截图使用的是逻辑像素，和物理像素不一样
            self.init_image_size(image_width, image_height)?;
        } else if image_width != self.image_width || image_height != self.image_height {
            return Err(ScrollScreenshotError::FrameDimensionsChanged {
                expected_width: self.image_width,
                expected_height: self.image_height,
                actual_width: image_width,
                actual_height: image_height,
            });
        }

        let gray_image = self.get_gray_image(&image);

        // 提取当前图片的特征点
        let image_corners = self.get_corners(&gray_image);

        if image_corners.is_empty() {
            return Ok((None, false, scroll_image_list));
        }

        let image_descriptors = self.get_descriptors(&gray_image, &image_corners);

        if self.top_image_list.is_empty() && self.bottom_image_list.is_empty() {
            let bottom_image = self.push_image(
                image,
                gray_image,
                image_corners.clone(),
                0,
                ScrollOffset { x: 0, y: 0 },
                ScrollOffset { x: 0, y: 0 },
            )?;

            let mut new_top_image_ann_index = ScrollIndex::new(self.get_descriptor_size());
            new_top_image_ann_index.descriptors = image_descriptors;
            new_top_image_ann_index.corners = image_corners;
            new_top_image_ann_index
                .descriptors
                .iter()
                .enumerate()
                .for_each(|(i, descriptor)| {
                    new_top_image_ann_index
                        .ann_index
                        .add(descriptor, i)
                        .unwrap();
                });

            new_top_image_ann_index
                .ann_index
                .build(Metric::Euclidean)
                .unwrap();

            self.top_image_ann_index = new_top_image_ann_index;

            return Ok((Some(bottom_image), false, ScrollImageList::Bottom));
        }

        // 优先从指定方向遍历，如果没有则再从另一个方向遍历
        let mut result_scroll_image_list;
        let first_index = if scroll_image_list == ScrollImageList::Top {
            result_scroll_image_list = ScrollImageList::Top;

            &self.top_image_ann_index
        } else {
            result_scroll_image_list = ScrollImageList::Bottom;

            &self.bottom_image_ann_index
        };

        // 从边缘遍历
        let mut offsets;
        let (first_offsets, is_origin) = self.get_offsets(
            first_index,
            &image_descriptors,
            &image_corners,
            scroll_image_list,
        );

        if is_origin {
            return Ok((None, true, result_scroll_image_list));
        }

        offsets = first_offsets;

        // 如果第一个方向没有找到匹配，尝试另一个方向
        if offsets.is_none() && self.try_rollback {
            let second_index = if scroll_image_list == ScrollImageList::Top {
                &self.bottom_image_ann_index
            } else {
                &self.top_image_ann_index
            };

            let second_scroll_image_list = if scroll_image_list == ScrollImageList::Top {
                ScrollImageList::Bottom
            } else {
                ScrollImageList::Top
            };

            let (second_offsets, is_origin) = self.get_offsets(
                second_index,
                &image_descriptors,
                &image_corners,
                second_scroll_image_list,
            );

            if is_origin {
                return Ok((None, true, result_scroll_image_list));
            }

            result_scroll_image_list = second_scroll_image_list;

            offsets = second_offsets;
        }

        if offsets.is_none() {
            return Ok((None, false, result_scroll_image_list));
        }

        let (dominant_scroll_index, dominant_origin_position_index, dominant_new_position_index) =
            match offsets {
                Some(offsets) => offsets,
                None => return Ok((None, false, scroll_image_list)),
            };

        let origin_position = dominant_scroll_index.corners[dominant_origin_position_index];
        let new_position = image_corners[dominant_new_position_index];

        // 将偏移的图片推到列表中
        Ok((
            Some(self.push_image(
                image,
                gray_image,
                image_corners,
                dominant_scroll_index.position,
                origin_position,
                new_position,
            )?),
            false,
            result_scroll_image_list,
        ))
    }

    pub fn try_handle_image(
        &mut self,
        image: DynamicImage,
        scroll_image_list: ScrollImageList,
    ) -> Result<
        (
            Option<(i32, Option<ScrollImageList>)>,
            bool,
            ScrollImageList,
        ),
        ScrollScreenshotError,
    > {
        let decision = self.rejected_frame_retry.begin(&image, scroll_image_list);

        if decision == RejectedFrameDecision::SkipDuplicate {
            return Ok((None, true, scroll_image_list));
        }

        // Keep one copy only for a newly rejected frame. Accepted frames and
        // explicit errors release it immediately; a repeated retry reuses the
        // candidate retained by the state machine.
        let rejected_image = (decision == RejectedFrameDecision::ProcessNew).then(|| image.clone());
        let result = self.try_handle_image_once(image, scroll_image_list);

        match result.as_ref() {
            Ok((Some(_), _, _)) | Ok((None, true, _)) | Err(_) => {
                self.rejected_frame_retry.clear();
            }
            Ok((None, false, _)) => {
                if let Some(rejected_image) = rejected_image {
                    self.rejected_frame_retry.record_rejection(
                        rejected_image,
                        scroll_image_list,
                        decision,
                    );
                }
            }
        }

        result
    }

    /// Compatibility wrapper for callers that only understand the historical
    /// no-data status. New call sites should use [`Self::try_handle_image`] so
    /// capacity and arithmetic errors remain visible.
    pub fn handle_image(
        &mut self,
        image: DynamicImage,
        scroll_image_list: ScrollImageList,
    ) -> (
        Option<(i32, Option<ScrollImageList>)>,
        bool,
        ScrollImageList,
    ) {
        self.try_handle_image(image, scroll_image_list)
            .unwrap_or((None, false, scroll_image_list))
    }

    pub fn try_export(&mut self) -> Result<Option<image::DynamicImage>, ScrollScreenshotError> {
        if self.top_image_list.is_empty() && self.bottom_image_list.is_empty() {
            return Ok(None);
        }

        let layout = self.checked_current_layout()?;

        // 创建最终大小的图片
        let mut final_image = Vec::new();
        final_image
            .try_reserve_exact(layout.byte_len)
            .map_err(|_| ScrollScreenshotError::AllocationFailed {
                bytes: layout.byte_len,
            })?;
        final_image.resize(layout.byte_len, 0);

        // 当前位置偏移量
        let mut offset_x: i64 = 0;
        let mut offset_y: i64 = 0;

        // top 会覆盖 bottom，优先从 bottom 开始
        if self.current_direction == ScrollDirection::Vertical {
            // 垂直方向，从顶部开始
            offset_y = self.top_image_size as i64;
        } else {
            // 水平方向，从左侧开始
            offset_x = self.top_image_size as i64;
        }

        for scroll_image in self.bottom_image_list.iter() {
            let img = &scroll_image.image;
            let overlay_size = scroll_image.overlay_size as i64;

            if self.current_direction == ScrollDirection::Vertical {
                // 垂直拼接
                let draw_y = offset_y.checked_sub(overlay_size).ok_or(
                    ScrollScreenshotError::ArithmeticOverflow {
                        operation: "calculating bottom image y offset",
                    },
                )?;
                Self::overlay_checked(&mut final_image, layout, img, 0, draw_y)?;

                let advance = (img.height() as i64).checked_sub(overlay_size).ok_or(
                    ScrollScreenshotError::ArithmeticOverflow {
                        operation: "calculating bottom image vertical advance",
                    },
                )?;
                offset_y = offset_y.checked_add(advance).ok_or(
                    ScrollScreenshotError::ArithmeticOverflow {
                        operation: "advancing bottom image y offset",
                    },
                )?;
            } else {
                // 水平拼接
                let draw_x = offset_x.checked_sub(overlay_size).ok_or(
                    ScrollScreenshotError::ArithmeticOverflow {
                        operation: "calculating bottom image x offset",
                    },
                )?;
                Self::overlay_checked(&mut final_image, layout, img, draw_x, 0)?;
                let advance = (img.width() as i64).checked_sub(overlay_size).ok_or(
                    ScrollScreenshotError::ArithmeticOverflow {
                        operation: "calculating bottom image horizontal advance",
                    },
                )?;
                offset_x = offset_x.checked_add(advance).ok_or(
                    ScrollScreenshotError::ArithmeticOverflow {
                        operation: "advancing bottom image x offset",
                    },
                )?;
            }
        }

        // 最先推入的图片优先级最低，所以从尾部开始
        if self.current_direction == ScrollDirection::Vertical {
            offset_y = self.top_image_size as i64;
        } else {
            offset_x = self.top_image_size as i64;
        }

        for scroll_image in self.top_image_list.iter() {
            let img = &scroll_image.image;
            let overlay_size = scroll_image.overlay_size as i64;

            if self.current_direction == ScrollDirection::Vertical {
                // 垂直拼接
                let actual_height = (img.height() as i64).checked_add(overlay_size).ok_or(
                    ScrollScreenshotError::ArithmeticOverflow {
                        operation: "calculating top image height",
                    },
                )?;
                let draw_y = offset_y.checked_sub(actual_height).ok_or(
                    ScrollScreenshotError::ArithmeticOverflow {
                        operation: "calculating top image y offset",
                    },
                )?;

                Self::overlay_checked(&mut final_image, layout, img, 0, draw_y)?;

                offset_y = draw_y;
            } else {
                let actual_width = (img.width() as i64).checked_add(overlay_size).ok_or(
                    ScrollScreenshotError::ArithmeticOverflow {
                        operation: "calculating top image width",
                    },
                )?;
                let draw_x = offset_x.checked_sub(actual_width).ok_or(
                    ScrollScreenshotError::ArithmeticOverflow {
                        operation: "calculating top image x offset",
                    },
                )?;

                // 水平拼接
                Self::overlay_checked(&mut final_image, layout, img, draw_x, 0)?;
                offset_x = draw_x;
            }
        }

        let image = image::RgbaImage::from_raw(layout.width, layout.height, final_image).ok_or(
            ScrollScreenshotError::ArithmeticOverflow {
                operation: "constructing the stitched RGBA image",
            },
        )?;

        Ok(Some(image::DynamicImage::ImageRgba8(image)))
    }

    /// Compatibility wrapper for callers that cannot surface export failures.
    /// User-facing export paths should call [`Self::try_export`] instead.
    pub fn export(&mut self) -> Option<image::DynamicImage> {
        self.try_export().ok().flatten()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};

    fn rgba_image(width: u32, height: u32, value: u8) -> DynamicImage {
        DynamicImage::ImageRgba8(RgbaImage::from_pixel(
            width,
            height,
            Rgba([value, value, value, 255]),
        ))
    }

    fn single_image_service(
        direction: ScrollDirection,
        image: DynamicImage,
    ) -> ScrollScreenshotService {
        let mut service = ScrollScreenshotService::new();
        service.current_direction = direction;
        service.image_width = image.width();
        service.image_height = image.height();
        service.image_scroll_side_size = if direction == ScrollDirection::Vertical {
            image.height() as i32
        } else {
            image.width() as i32
        };
        service.bottom_image_size = service.image_scroll_side_size;
        service.bottom_image_list.push(ScrollImage {
            image,
            overlay_size: 0,
        });
        service
    }

    #[test]
    fn rejected_duplicate_is_retried_once_then_skipped() {
        let mut service = ScrollScreenshotService::new();
        service.init(ScrollDirection::Vertical, 1.0, 1, 64, 64, 9, 64, false);
        let frame = rgba_image(8, 8, 7);

        let first = service
            .try_handle_image(frame.clone(), ScrollImageList::Bottom)
            .unwrap();
        let retry = service
            .try_handle_image(frame.clone(), ScrollImageList::Bottom)
            .unwrap();
        let duplicate = service
            .try_handle_image(frame, ScrollImageList::Bottom)
            .unwrap();

        assert_eq!(first, (None, false, ScrollImageList::Bottom));
        assert_eq!(retry, (None, false, ScrollImageList::Bottom));
        assert_eq!(duplicate, (None, true, ScrollImageList::Bottom));
    }

    #[test]
    fn new_frame_and_direction_each_get_their_own_retry() {
        let first = rgba_image(2, 2, 1);
        let second = rgba_image(2, 2, 2);
        let mut retry = RejectedFrameRetry::default();

        let first_decision = retry.begin(&first, ScrollImageList::Bottom);
        retry.record_rejection(first.clone(), ScrollImageList::Bottom, first_decision);
        assert_eq!(
            retry.begin(&first, ScrollImageList::Bottom),
            RejectedFrameDecision::RetryOnce
        );

        let second_decision = retry.begin(&second, ScrollImageList::Bottom);
        assert_eq!(second_decision, RejectedFrameDecision::ProcessNew);
        retry.record_rejection(second.clone(), ScrollImageList::Bottom, second_decision);
        assert_eq!(
            retry.begin(&second, ScrollImageList::Top),
            RejectedFrameDecision::ProcessNew
        );
    }

    #[test]
    fn accepted_frame_clears_rejected_retry_state() {
        let frame = rgba_image(2, 2, 3);
        let mut retry = RejectedFrameRetry::default();
        let decision = retry.begin(&frame, ScrollImageList::Bottom);
        retry.record_rejection(frame.clone(), ScrollImageList::Bottom, decision);

        retry.clear();

        assert_eq!(
            retry.begin(&frame, ScrollImageList::Bottom),
            RejectedFrameDecision::ProcessNew
        );
    }

    #[test]
    fn exports_vertical_rgba_image() {
        let mut service = single_image_service(ScrollDirection::Vertical, rgba_image(2, 3, 17));

        let image = service.try_export().unwrap().unwrap();

        assert_eq!((image.width(), image.height()), (2, 3));
        assert!(
            image
                .as_bytes()
                .chunks_exact(4)
                .all(|pixel| pixel == [17, 17, 17, 255])
        );
    }

    #[test]
    fn exports_horizontal_rgba_image() {
        let mut service = single_image_service(ScrollDirection::Horizontal, rgba_image(3, 2, 23));

        let image = service.try_export().unwrap().unwrap();

        assert_eq!((image.width(), image.height()), (3, 2));
        assert!(
            image
                .as_bytes()
                .chunks_exact(4)
                .all(|pixel| pixel == [23, 23, 23, 255])
        );
    }

    #[test]
    fn accepts_axis_limits_and_rejects_one_pixel_over() {
        assert!(
            checked_output_layout(1, MAX_SCROLL_SCREENSHOT_HEIGHT as u64).is_ok(),
            "vertical height at the limit must remain exportable"
        );
        assert!(
            checked_output_layout(MAX_SCROLL_SCREENSHOT_WIDTH as u64, 1).is_ok(),
            "horizontal width at the limit must remain exportable"
        );

        assert!(matches!(
            checked_output_layout(1, MAX_SCROLL_SCREENSHOT_HEIGHT as u64 + 1),
            Err(ScrollScreenshotError::DimensionLimitExceeded { .. })
        ));
        assert!(matches!(
            checked_output_layout(MAX_SCROLL_SCREENSHOT_WIDTH as u64 + 1, 1),
            Err(ScrollScreenshotError::DimensionLimitExceeded { .. })
        ));
    }

    #[test]
    fn enforces_pixel_and_rgba_byte_thresholds() {
        let layout = checked_output_layout(8_192, 8_192).unwrap();
        assert_eq!(layout.pixel_count as u64, MAX_SCROLL_SCREENSHOT_PIXELS);
        assert_eq!(layout.byte_len, MAX_SCROLL_SCREENSHOT_BYTES);

        assert!(matches!(
            checked_output_layout(8_192, 8_193),
            Err(ScrollScreenshotError::PixelLimitExceeded {
                pixels,
                max_pixels: MAX_SCROLL_SCREENSHOT_PIXELS,
            }) if pixels > MAX_SCROLL_SCREENSHOT_PIXELS
        ));
        assert!(matches!(
            checked_rgba_byte_len(MAX_SCROLL_SCREENSHOT_PIXELS + 1),
            Err(ScrollScreenshotError::ByteLimitExceeded {
                max_bytes: MAX_SCROLL_SCREENSHOT_BYTES,
                ..
            })
        ));
    }

    #[test]
    fn reports_arithmetic_overflow_before_allocating() {
        assert!(matches!(
            checked_rgba_byte_len(u64::MAX),
            Err(ScrollScreenshotError::ArithmeticOverflow { .. })
        ));

        let mut service = single_image_service(ScrollDirection::Vertical, rgba_image(1, 1, 0));
        service.top_image_size = i32::MAX;
        service.bottom_image_size = 1;

        assert!(matches!(
            service.try_export(),
            Err(ScrollScreenshotError::ArithmeticOverflow { .. })
        ));
    }

    #[test]
    fn push_image_accepts_axis_limit_then_rejects_growth_without_mutation() {
        for (direction, axis_limit) in [
            (ScrollDirection::Vertical, MAX_SCROLL_SCREENSHOT_HEIGHT),
            (ScrollDirection::Horizontal, MAX_SCROLL_SCREENSHOT_WIDTH),
        ] {
            let mut service = ScrollScreenshotService::new();
            service.current_direction = direction;
            service.image_width = 1;
            service.image_height = 1;
            service.image_scroll_side_size = 1;
            service.bottom_image_size = axis_limit as i32 - 1;
            service.bottom_image_index_size = axis_limit as i32 + 100;

            let accepted = service.push_image(
                rgba_image(1, 1, 1),
                GrayImage::new(1, 1),
                Vec::new(),
                axis_limit as i32 - 1,
                ScrollOffset::new(0, 0),
                ScrollOffset::new(0, 0),
            );
            assert!(accepted.is_ok());
            assert_eq!(service.bottom_image_size, axis_limit as i32);
            assert_eq!(service.bottom_image_list.len(), 1);

            let rejected = service.push_image(
                rgba_image(1, 1, 2),
                GrayImage::new(1, 1),
                Vec::new(),
                axis_limit as i32,
                ScrollOffset::new(0, 0),
                ScrollOffset::new(0, 0),
            );
            assert!(matches!(
                rejected,
                Err(ScrollScreenshotError::DimensionLimitExceeded { .. })
            ));
            assert_eq!(service.bottom_image_size, axis_limit as i32);
            assert_eq!(service.bottom_image_list.len(), 1);
        }
    }
}
