use image::{ImageBuffer, Rgba, RgbaImage};
use std::f64::consts::PI;
use std::io::Cursor;

const SIZE: u32 = 44;
const CENTER: f64 = SIZE as f64 / 2.0;
const OUTER_R: f64 = 20.0;
const STROKE: f64 = 8.0;
const INNER_R: f64 = OUTER_R - STROKE;

const BLUE: Rgba<u8> = Rgba([50, 170, 255, 255]);
const RED: Rgba<u8> = Rgba([255, 100, 100, 255]);
const TRACK: Rgba<u8> = Rgba([255, 255, 255, 200]);

pub fn generate_ring_png(percent: f64) -> Vec<u8> {
    let clamped = percent.clamp(0.0, 100.0);
    let fill_color = if clamped > 80.0 { RED } else { BLUE };
    let threshold = (clamped / 100.0) * 2.0 * PI;

    let img: RgbaImage = ImageBuffer::from_fn(SIZE, SIZE, |x, y| {
        let dx = x as f64 - CENTER;
        let dy = y as f64 - CENTER;
        let dist = (dx * dx + dy * dy).sqrt();

        if dist < INNER_R - 0.5 || dist > OUTER_R + 0.5 {
            return Rgba([0, 0, 0, 0]);
        }

        // Anti-alias at edges
        let alpha_factor = if dist < INNER_R + 0.5 {
            dist - (INNER_R - 0.5)
        } else if dist > OUTER_R - 0.5 {
            (OUTER_R + 0.5) - dist
        } else {
            1.0
        }
        .clamp(0.0, 1.0);

        // Angle from 12 o'clock, clockwise: atan2(dx, -dy)
        let angle = dx.atan2(-dy);
        let normalized = if angle < 0.0 { angle + 2.0 * PI } else { angle };

        if clamped > 0.0 && normalized <= threshold {
            let mut c = fill_color;
            c.0[3] = (fill_color.0[3] as f64 * alpha_factor) as u8;
            c
        } else {
            let mut c = TRACK;
            c.0[3] = (TRACK.0[3] as f64 * alpha_factor) as u8;
            c
        }
    });

    let mut buf = Cursor::new(Vec::new());
    img.write_to(&mut buf, image::ImageFormat::Png)
        .expect("PNG encoding failed");
    buf.into_inner()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_valid_png_at_zero() {
        let data = generate_ring_png(0.0);
        assert!(data.len() > 8);
        // PNG magic bytes
        assert_eq!(&data[..4], &[0x89, 0x50, 0x4E, 0x47]);
    }

    #[test]
    fn generates_valid_png_at_fifty() {
        let data = generate_ring_png(50.0);
        assert!(data.len() > 8);
        assert_eq!(&data[..4], &[0x89, 0x50, 0x4E, 0x47]);
    }

    #[test]
    fn generates_valid_png_at_hundred() {
        let data = generate_ring_png(100.0);
        assert!(data.len() > 8);
        assert_eq!(&data[..4], &[0x89, 0x50, 0x4E, 0x47]);
    }

    #[test]
    fn correct_image_dimensions() {
        let data = generate_ring_png(50.0);
        let img = image::load_from_memory(&data).expect("load PNG");
        assert_eq!(img.width(), SIZE);
        assert_eq!(img.height(), SIZE);
    }

    #[test]
    fn center_pixel_is_transparent() {
        let data = generate_ring_png(50.0);
        let img = image::load_from_memory(&data).expect("load PNG").to_rgba8();
        let center = img.get_pixel(SIZE / 2, SIZE / 2);
        assert_eq!(center.0[3], 0, "center should be transparent");
    }

    #[test]
    fn clamps_out_of_range() {
        let below = generate_ring_png(-10.0);
        let above = generate_ring_png(200.0);
        assert!(below.len() > 8);
        assert!(above.len() > 8);
    }
}
