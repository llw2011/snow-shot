use enigo::Enigo;
use enigo::Settings;
use serde::Deserialize;
use serde::Serialize;

pub struct EnigoManager {
    pub enigo: Option<Enigo>,
}

impl EnigoManager {
    pub fn new() -> Self {
        Self { enigo: None }
    }

    pub fn get_enigo(&mut self) -> Result<&mut Enigo, String> {
        if self.enigo.is_some() {
            return Ok(self.enigo.as_mut().unwrap());
        }

        let enigo = match Enigo::new(&Settings::default()) {
            Ok(enigo) => enigo,
            Err(e) => {
                return Err(format!("[EnigoManager] Could not get enigo: {}", e));
            }
        };

        self.enigo = Some(enigo);
        Ok(self.enigo.as_mut().unwrap())
    }
}

#[derive(PartialEq, Serialize, Clone, Debug)]
pub struct ElementInfo {
    pub rect_list: Vec<ElementRect>,
}

#[derive(PartialEq, Eq, Serialize, Clone, Debug, Copy, Hash, Deserialize)]
pub struct ElementRect {
    pub min_x: i32,
    pub min_y: i32,
    pub max_x: i32,
    pub max_y: i32,
}

impl ElementRect {
    pub fn equals(&self, min_x: i32, min_y: i32, max_x: i32, max_y: i32) -> bool {
        self.min_x == min_x && self.min_y == min_y && self.max_x == max_x && self.max_y == max_y
    }

    pub fn clip_rect(&self, rect: &ElementRect) -> ElementRect {
        ElementRect {
            min_x: self.min_x.max(rect.min_x),
            min_y: self.min_y.max(rect.min_y),
            max_x: self.max_x.min(rect.max_x),
            max_y: self.max_y.min(rect.max_y),
        }
    }

    /// 检查两个 ElementRect 是否有重叠部分
    pub fn overlaps(&self, other: &ElementRect) -> bool {
        // 检查是否有重叠：一个矩形在另一个矩形的左边、右边、上边或下边时，它们不重叠
        !(self.max_x <= other.min_x
            || self.min_x >= other.max_x
            || self.max_y <= other.min_y
            || self.min_y >= other.max_y)
    }

    pub fn scale(&self, scale: f32) -> ElementRect {
        ElementRect {
            min_x: (self.min_x as f32 * scale) as i32,
            min_y: (self.min_y as f32 * scale) as i32,
            max_x: (self.max_x as f32 * scale) as i32,
            max_y: (self.max_y as f32 * scale) as i32,
        }
    }
}

#[cfg(target_os = "windows")]
impl From<uiautomation::types::Rect> for ElementRect {
    fn from(rect: uiautomation::types::Rect) -> Self {
        ElementRect {
            min_x: rect.get_left(),
            min_y: rect.get_top(),
            max_x: rect.get_right(),
            max_y: rect.get_bottom(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_overlaps() {
        assert_eq!(
            ElementRect {
                min_x: 0,
                min_y: 0,
                max_x: 100,
                max_y: 100,
            }
            .overlaps(&ElementRect {
                min_x: 0,
                min_y: 0,
                max_x: 100,
                max_y: 100,
            }),
            true
        );

        assert_eq!(
            ElementRect {
                min_x: 0,
                min_y: 0,
                max_x: 100,
                max_y: 100,
            }
            .overlaps(&ElementRect {
                min_x: 101,
                min_y: 101,
                max_x: 200,
                max_y: 200,
            }),
            false
        );

        assert_eq!(
            ElementRect {
                min_x: 0,
                min_y: 0,
                max_x: 100,
                max_y: 100,
            }
            .overlaps(&ElementRect {
                min_x: 100,
                min_y: 100,
                max_x: 100,
                max_y: 100,
            }),
            false
        );
    }
}
