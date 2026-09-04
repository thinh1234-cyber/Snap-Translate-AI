"""
Snap Decode — Dual-Engine Backend (Native Messaging On-Demand & HTTP Standalone)
Auto-launched by Chrome Native Messaging or run standalone on localhost:8765.
"""

import base64
import io
import json
import os
import struct
import sys
import time
import cv2
import numpy as np
from PIL import Image

from qr_engine import QREngine
from ocr_engine import OCREngine

# Initialize vision engines (shared instance)
qr_engine = QREngine()
ocr_engine = OCREngine()


def decode_base64_image(b64_str: str) -> np.ndarray:
    """Decodes a base64 data URL to an OpenCV BGR numpy array."""
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]

    img_bytes = base64.b64decode(b64_str)
    pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    rgb_arr = np.array(pil_img)
    bgr_arr = cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2BGR)
    return bgr_arr


def process_decode(mode: str, image_b64: str) -> dict:
    """Core decoding logic shared by both Native Messaging and HTTP API."""
    mode = (mode or "ocr").lower().strip()
    if not image_b64:
        return {"success": False, "error": "No image data provided"}

    try:
        img_bgr = decode_base64_image(image_b64)
    except Exception as e:
        return {"success": False, "error": f"Failed to decode image data: {str(e)}"}

    h, w = img_bgr.shape[:2]

    # Mode 1: QR Code
    if mode == "qr":
        t0 = time.time()
        qr_text = qr_engine.decode(img_bgr)
        elapsed_ms = round((time.time() - t0) * 1000, 1)

        if qr_text:
            return {
                "success": True,
                "mode": "qr",
                "text": qr_text,
                "dimensions": {"width": w, "height": h},
                "elapsedMs": elapsed_ms
            }
        else:
            return {
                "success": False,
                "mode": "qr",
                "error": "Không tìm thấy mã QR nào trong vùng chụp! Hãy căn chỉnh sát mã QR hơn.",
                "dimensions": {"width": w, "height": h},
                "elapsedMs": elapsed_ms
            }

    # Mode 2: OCR
    elif mode == "ocr":
        t0 = time.time()
        res = ocr_engine.extract_text(img_bgr)
        elapsed_ms = round((time.time() - t0) * 1000, 1)

        if not res.get("success"):
            return {
                "success": False,
                "mode": "ocr",
                "error": res.get("error", "Lỗi nhận diện OCR"),
                "elapsedMs": elapsed_ms
            }

        extracted_text = res.get("text", "").strip()
        if not extracted_text:
            return {
                "success": False,
                "mode": "ocr",
                "error": "OCR không nhận diện được chữ nào trong vùng ảnh!",
                "dimensions": {"width": w, "height": h},
                "elapsedMs": elapsed_ms
            }

        return {
            "success": True,
            "mode": "ocr",
            "text": extracted_text,
            "lines": res.get("lines", []),
            "confidence": res.get("confidence", 0.0),
            "dimensions": {"width": w, "height": h},
            "elapsedMs": elapsed_ms
        }

    return {"success": False, "error": f"Invalid mode: '{mode}'"}


# ═══════════════════════════════════════════════════════════════
# 1. Native Messaging Mode (Zero-touch Auto Start & Shutdown)
# ═══════════════════════════════════════════════════════════════

def run_native_messaging():
    """
    Standard Chrome Native Messaging Host protocol handler.
    Runs silently in background, processes requests from Chrome, and exits
    when Chrome disconnects or closes the stdin pipe.
    """
    # Windows binary mode for standard streams
    if sys.platform == "win32":
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)

    while True:
        try:
            # Read 4-byte message length
            raw_length = sys.stdin.buffer.read(4)
            if not raw_length or len(raw_length) < 4:
                # Pipe closed by Chrome -> Auto-shutdown!
                break

            msg_len = struct.unpack("@I", raw_length)[0]
            if msg_len == 0:
                break

            raw_msg = sys.stdin.buffer.read(msg_len).decode("utf-8")
            req_data = json.loads(raw_msg)

            mode = req_data.get("mode", "ocr")
            image_b64 = req_data.get("image", "")

            result = process_decode(mode, image_b64)

            # Send response back to Chrome
            resp_encoded = json.dumps(result).encode("utf-8")
            sys.stdout.buffer.write(struct.pack("@I", len(resp_encoded)))
            sys.stdout.buffer.write(resp_encoded)
            sys.stdout.buffer.flush()

        except Exception as e:
            err_resp = {"success": False, "error": f"Native host error: {str(e)}"}
            resp_encoded = json.dumps(err_resp).encode("utf-8")
            sys.stdout.buffer.write(struct.pack("@I", len(resp_encoded)))
            sys.stdout.buffer.write(resp_encoded)
            sys.stdout.buffer.flush()
            break


# ═══════════════════════════════════════════════════════════════
# 2. HTTP Server Mode (FastAPI Standalone on port 8765)
# ═══════════════════════════════════════════════════════════════

def create_fastapi_app():
    import uvicorn
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    app = FastAPI(
        title="Snap Decode Backend",
        description="High-performance Local Backend for QR Decoding and OCR",
        version="2.1.0"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class DecodeRequest(BaseModel):
        mode: str
        image: str

    @app.get("/health")
    def health_check():
        return {
            "status": "online",
            "service": "Snap Decode Backend",
            "version": "2.1.0",
            "timestamp": time.time()
        }

    @app.post("/api/decode")
    def decode_endpoint(req: DecodeRequest):
        res = process_decode(req.mode, req.image)
        return res

    return app


if __name__ == "__main__":
    # Check if launched by Chrome Native Messaging
    is_native = (
        "--native" in sys.argv or
        any(arg.startswith("chrome-extension://") for arg in sys.argv[1:])
    )

    if is_native:
        run_native_messaging()
    else:
        import uvicorn
        app = create_fastapi_app()
        print("\n=======================================================")
        print("  [*] Snap Decode Backend Server is running!")
        print("  [*] URL: http://127.0.0.1:8765")
        print("  [*] Health: http://127.0.0.1:8765/health")
        print("=======================================================\n")
        uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")
