"""
Utility to download Vietnamese OCR recognition weights from Hugging Face.
"""
import os
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TARGET_DIR = os.path.join(BASE_DIR, "models", "vietnamese_rec")
os.makedirs(TARGET_DIR, exist_ok=True)

BASE_URL = "https://huggingface.co/tieubaoca/pp-ocrv6-medium-rec-vietnamese/resolve/main"
FILES = ["inference.json", "inference.pdiparams", "ppocr_keys.txt"]

def download_vietnamese_model():
    print(f"Checking Vietnamese recognition model files in: {TARGET_DIR}")
    for fname in FILES:
        dest = os.path.join(TARGET_DIR, fname)
        if not os.path.exists(dest) or os.path.getsize(dest) == 0:
            url = f"{BASE_URL}/{fname}"
            print(f"Downloading {fname} from {url}...")
            urllib.request.urlretrieve(url, dest)
            print(f"Saved {fname} ({os.path.getsize(dest)} bytes)")
        else:
            print(f"  [OK] {fname} ({os.path.getsize(dest)} bytes)")
    print("All Vietnamese OCR model files ready!")

if __name__ == "__main__":
    download_vietnamese_model()
