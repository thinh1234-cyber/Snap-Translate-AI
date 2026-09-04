"""
OCR Engine — RapidOCR (ONNX Runtime)
High performance offline OCR for Vietnamese, English, and symbols.
"""

import numpy as np
from rapidocr_onnxruntime import RapidOCR


class OCREngine:
    def __init__(self):
        print("[SnapDecode OCR] Initializing RapidOCR ONNX model...")
        self.ocr = RapidOCR()
        print("[SnapDecode OCR] RapidOCR model ready!")

    def extract_text(self, img_bgr: np.ndarray) -> dict:
        """
        Extracts text from BGR image.
        Returns: { "success": bool, "text": str, "lines": list, "confidence": float }
        """
        if img_bgr is None or img_bgr.size == 0:
            return {"success": False, "text": "", "error": "Empty image provided"}

        try:
            results, elapse = self.ocr(img_bgr)
            if not results:
                return {
                    "success": True,
                    "text": "",
                    "lines": [],
                    "confidence": 0.0,
                    "elapse": elapse
                }

            lines = []
            confidences = []
            for item in results:
                # item: [box_points, text, score]
                box, text, score = item
                text = text.strip()
                if text:
                    lines.append(text)
                    confidences.append(float(score))

            full_text = "\n".join(lines)
            avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

            return {
                "success": True,
                "text": full_text,
                "lines": lines,
                "confidence": round(avg_conf, 3),
                "elapse": elapse
            }
        except Exception as e:
            return {"success": False, "text": "", "error": str(e)}
