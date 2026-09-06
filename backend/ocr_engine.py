"""
OCR Engine — Hybrid RapidOCR Detector + Fine-tuned Vietnamese Recognizer
Accurate offline OCR with full diacritics, tone marks, and symbols.
"""

import os
import sys
import time
import cv2
import numpy as np
from rapidocr_onnxruntime import RapidOCR
from rapidocr_onnxruntime.ch_ppocr_rec.utils import CTCLabelDecode


class OCREngine:
    def __init__(self):
        print("[SnapDecode OCR] Initializing RapidOCR ONNX model...")
        self.ocr = RapidOCR()
        
        self.vi_rec_model = None
        self.vi_decoder = None
        
        # Load specialized Vietnamese recognition model if available
        if getattr(sys, "frozen", False):
            base_dir = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
            if not os.path.exists(os.path.join(base_dir, "models")):
                candidate = os.path.join(os.path.dirname(sys.executable), "_internal")
                if os.path.exists(os.path.join(candidate, "models")):
                    base_dir = candidate
        else:
            base_dir = os.path.dirname(os.path.abspath(__file__))

        vi_model_dir = os.path.join(base_dir, "models", "vietnamese_rec")
        vi_model_prefix = os.path.join(vi_model_dir, "inference")
        vi_keys_path = os.path.join(vi_model_dir, "ppocr_keys.txt")

        if os.path.exists(vi_keys_path) and (
            os.path.exists(vi_model_prefix + ".json") or os.path.exists(vi_model_prefix + ".pdmodel")
        ):
            try:
                import paddle
                print(f"[SnapDecode OCR] Loading Vietnamese recognition model from {vi_model_dir}...")
                self.vi_rec_model = paddle.jit.load(vi_model_prefix)
                self.vi_decoder = CTCLabelDecode(character_path=vi_keys_path)
                
                # Warmup inference
                dummy_in = paddle.randn([1, 3, 48, 160])
                _ = self.vi_rec_model(dummy_in)
                print("[SnapDecode OCR] Vietnamese recognition model ready with full diacritics!")
            except Exception as e:
                print(f"[SnapDecode OCR] Warning: Failed to load Vietnamese recognizer ({e}). Falling back to default.")
                self.vi_rec_model = None
                self.vi_decoder = None
        else:
            print("[SnapDecode OCR] Vietnamese model files not found. Using default RapidOCR recognition.")

    def extract_text(self, img_bgr: np.ndarray) -> dict:
        """
        Extracts text from BGR image.
        Returns: { "success": bool, "text": str, "lines": list, "confidence": float, "elapse": float }
        """
        if img_bgr is None or img_bgr.size == 0:
            return {"success": False, "text": "", "error": "Empty image provided"}

        start_time = time.perf_counter()

        try:
            # If Vietnamese recognizer is loaded, use hybrid pipeline
            if self.vi_rec_model is not None and self.vi_decoder is not None:
                return self._extract_vietnamese(img_bgr, start_time)

            # Fallback to default RapidOCR
            results, elapse = self.ocr(img_bgr)
            if not results:
                return {
                    "success": True,
                    "text": "",
                    "lines": [],
                    "confidence": 0.0,
                    "elapse": round(elapse, 3)
                }

            lines = []
            confidences = []
            for item in results:
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
                "elapse": round(time.perf_counter() - start_time, 3)
            }
        except Exception as e:
            return {"success": False, "text": "", "error": str(e)}

    def _extract_vietnamese(self, img_bgr: np.ndarray, start_time: float) -> dict:
        """
        Runs RapidOCR text detection + orientation classifier,
        followed by Vietnamese PP-OCRv6 CTC recognition.
        """
        import paddle

        # 1. Text detection
        boxes, _ = self.ocr.text_det(img_bgr)
        if boxes is None or len(boxes) == 0:
            return {
                "success": True,
                "text": "",
                "lines": [],
                "confidence": 0.0,
                "elapse": round(time.perf_counter() - start_time, 3)
            }

        sorted_boxes = self.ocr.sorted_boxes(boxes)
        lines = []
        confidences = []

        # 2. Crop, classify orientation, and recognize each text box
        for box in sorted_boxes:
            crop_list = self.ocr.get_crop_img_list(img_bgr, [box])
            if not crop_list:
                continue
            crop = crop_list[0]

            # Orientation classifier (0 or 180 degrees)
            cls_res = self.ocr.text_cls([crop])
            crop = cls_res[0][0]

            h, w = crop.shape[:2]
            if h <= 0 or w <= 0:
                continue

            # Standard height is 48 for PP-OCRv6
            target_h = 48
            target_w = max(16, int(w * (target_h / float(h))))
            resized = cv2.resize(crop, (target_w, target_h))

            # Normalize: (img / 255.0 - 0.5) / 0.5
            norm = (resized.astype("float32") / 255.0 - 0.5) / 0.5
            norm = norm.transpose((2, 0, 1)) # (3, H, W)
            tensor_in = paddle.to_tensor(np.expand_dims(norm, axis=0))

            preds = self.vi_rec_model(tensor_in).numpy()
            decoded = self.vi_decoder(preds)
            if decoded:
                line_text, line_score = decoded[0]
                line_text = line_text.strip()
                if line_text:
                    lines.append(line_text)
                    confidences.append(float(line_score))

        full_text = "\n".join(lines)
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

        return {
            "success": True,
            "text": full_text,
            "lines": lines,
            "confidence": round(avg_conf, 3),
            "elapse": round(time.perf_counter() - start_time, 3)
        }
