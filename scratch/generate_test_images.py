import os
import numpy as np
from PIL import Image, ImageDraw

output_dir = os.path.abspath("test_fixtures_images")
os.makedirs(output_dir, exist_ok=True)

# 1. Small square JPEG (~50-100KB, 500x500)
img_small = Image.new("RGB", (500, 500), color=(73, 109, 137))
d = ImageDraw.Draw(img_small)
d.rectangle([(100, 100), (400, 400)], fill=(240, 180, 50))
d.ellipse([(150, 150), (350, 350)], fill=(20, 120, 220))
small_jpg_path = os.path.join(output_dir, "small_square.jpg")
img_small.save(small_jpg_path, "JPEG", quality=85)
print(f"Created {small_jpg_path} ({os.path.getsize(small_jpg_path)/1024:.1f} KB)")

# 2. Large Landscape JPEG (> 3 MB, 3600x2400 with high noise/detail to simulate realistic phone camera)
rng = np.random.default_rng(42)
arr = rng.integers(0, 256, (2400, 3600, 3), dtype=np.uint8)
img_large_jpg = Image.fromarray(arr)
large_jpg_path = os.path.join(output_dir, "large_landscape_phone.jpg")
img_large_jpg.save(large_jpg_path, "JPEG", quality=95)
print(f"Created {large_jpg_path} ({os.path.getsize(large_jpg_path)/(1024*1024):.2f} MB)")

# 3. Large Portrait PNG (> 3 MB, 2400x3200)
arr_png = rng.integers(50, 220, (3200, 2400, 3), dtype=np.uint8)
img_large_png = Image.fromarray(arr_png)
large_png_path = os.path.join(output_dir, "large_portrait_camera.png")
img_large_png.save(large_png_path, "PNG")
print(f"Created {large_png_path} ({os.path.getsize(large_png_path)/(1024*1024):.2f} MB)")

# 4. WebP image (800x800)
img_webp = Image.new("RGB", (800, 800), color=(34, 139, 34))
d_webp = ImageDraw.Draw(img_webp)
d_webp.ellipse([(100, 100), (700, 700)], fill=(255, 215, 0))
webp_path = os.path.join(output_dir, "sample_avatar.webp")
img_webp.save(webp_path, "WEBP", quality=90)
print(f"Created {webp_path} ({os.path.getsize(webp_path)/1024:.1f} KB)")

# 5. Invalid file disguised as image or text
invalid_path = os.path.join(output_dir, "invalid_document.pdf")
with open(invalid_path, "wb") as f:
    f.write(b"%PDF-1.4 Fake PDF file content that is not an image")
print(f"Created {invalid_path}")

print("Test fixtures created successfully.")
