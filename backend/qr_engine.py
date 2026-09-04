"""
QR Engine — High-Precision Localized QR Code Decoder
Localizes candidate QR regions in large/cluttered screenshots before multi-pass decoding.
Combines OpenCV detectMulti, concentric contour hierarchy (finder patterns),
perspective rectification, and PyZbar with adaptive preprocessing.
"""

import cv2
import numpy as np
from pyzbar.pyzbar import decode as decode_zbar


class QREngine:
    def __init__(self):
        self.cv_detector = cv2.QRCodeDetector()

    def decode(self, img_bgr: np.ndarray) -> str | None:
        """
        Full QR decoding pipeline:
        1. Localize candidate QR regions (ROIs) if image is large/cluttered
        2. Decode candidate ROIs first (warp & crop)
        3. Fallback to full-image multi-pass decoding
        """
        if img_bgr is None or img_bgr.size == 0:
            return None

        h, w = img_bgr.shape[:2]

        # Step 1: Detect candidate QR regions (bounding boxes & corner points)
        candidates = self._find_qr_candidates(img_bgr)

        # Step 2: Try decoding each localized candidate
        for cand in candidates:
            # 2a. If 4-corner perspective points exist, try rectified warp
            pts = cand.get("pts")
            if pts is not None and len(pts) == 4:
                warped = self._warp_perspective(img_bgr, pts)
                if warped is not None:
                    res = self._multi_pass_decode(warped)
                    if res:
                        return res

            # 2b. Try cropped bounding box with quiet zone margin
            x, y, bw, bh = cand["bbox"]
            crop = img_bgr[y:y + bh, x:x + bw]
            if crop.size > 0:
                res = self._multi_pass_decode(crop)
                if res:
                    return res

        # Step 3: Fallback — decode full original image if candidates did not succeed
        return self._multi_pass_decode(img_bgr)

    # -------------------------------------------------------------------------
    # QR Localization & Region Proposal
    # -------------------------------------------------------------------------

    def _find_qr_candidates(self, img_bgr: np.ndarray) -> list[dict]:
        """
        Finds regions of interest (ROIs) likely containing a QR code:
        - OpenCV detectMulti corner polygons
        - Concentric square contour hierarchy (1:1:3:1:1 finder patterns)
        - Morphological edge density blobs
        """
        h_img, w_img = img_bgr.shape[:2]
        candidates = []

        # 1. OpenCV detectMulti
        try:
            ret, points = self.cv_detector.detectMulti(img_bgr)
            if ret and points is not None:
                for pts in points:
                    pts = pts.reshape(-1, 2)
                    x_min, y_min = np.min(pts, axis=0)
                    x_max, y_max = np.max(pts, axis=0)
                    bw, bh = x_max - x_min, y_max - y_min
                    if bw > 15 and bh > 15:
                        pad_x = int(bw * 0.25)
                        pad_y = int(bh * 0.25)
                        x1 = max(0, int(x_min - pad_x))
                        y1 = max(0, int(y_min - pad_y))
                        x2 = min(w_img, int(x_max + pad_x))
                        y2 = min(h_img, int(y_max + pad_y))
                        candidates.append({
                            "bbox": (x1, y1, x2 - x1, y2 - y1),
                            "pts": pts
                        })
        except Exception:
            pass

        # 2. Concentric Finder Pattern Contour Hierarchy (Normal & Inverted)
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        for g_img in [gray, cv2.bitwise_not(gray)]:
            for thresh_fn in [
                lambda img: cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1],
                lambda img: cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 25, 5)
            ]:
                try:
                    thresh = thresh_fn(g_img)
                    contours, hierarchy = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
                    if hierarchy is None or len(contours) == 0:
                        continue
                    hierarchy = hierarchy[0]
                    finders = []
                    for i, h in enumerate(hierarchy):
                        # Nested condition: outer box -> middle box -> inner box
                        child_idx = h[2]
                        if child_idx != -1 and hierarchy[child_idx][2] != -1:
                            bx, by, bw, bh = cv2.boundingRect(contours[i])
                            ar = bw / float(bh) if bh > 0 else 0
                            if 0.6 <= ar <= 1.6 and bw >= 8 and bh >= 8:
                                finders.append((bx, by, bw, bh))

                    if len(finders) >= 2:
                        min_x = min(f[0] for f in finders)
                        min_y = min(f[1] for f in finders)
                        max_x = max(f[0] + f[2] for f in finders)
                        max_y = max(f[1] + f[3] for f in finders)
                        avg_size = np.mean([max(f[2], f[3]) for f in finders])

                        # Expand outwards to capture the full QR code around the finder patterns
                        pad = int(avg_size * 2.2)
                        x1 = max(0, min_x - pad)
                        y1 = max(0, min_y - pad)
                        x2 = min(w_img, max_x + pad)
                        y2 = min(h_img, max_y + pad)
                        candidates.append({
                            "bbox": (x1, y1, x2 - x1, y2 - y1),
                            "pts": None
                        })
                except Exception:
                    pass

        # 3. Morphological Gradient Density (Sobel Edge Energy)
        try:
            grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
            grad_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
            grad = cv2.convertScaleAbs(cv2.magnitude(grad_x, grad_y))
            _, grad_thresh = cv2.threshold(grad, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            # Close gaps between QR code modules
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
            closed = cv2.morphologyEx(grad_thresh, cv2.MORPH_CLOSE, kernel)
            contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for c in contours:
                bx, by, bw, bh = cv2.boundingRect(c)
                ar = bw / float(bh) if bh > 0 else 0
                area = bw * bh
                if 0.65 <= ar <= 1.55 and 1600 <= area <= (w_img * h_img * 0.9):
                    pad = int(min(bw, bh) * 0.15)
                    x1 = max(0, bx - pad)
                    y1 = max(0, by - pad)
                    x2 = min(w_img, bx + bw + pad)
                    y2 = min(h_img, by + bh + pad)
                    candidates.append({
                        "bbox": (x1, y1, x2 - x1, y2 - y1),
                        "pts": None
                    })
        except Exception:
            pass

        # Deduplicate candidates using IoU (Intersection over Union)
        deduped = []
        for cand in candidates:
            cx, cy, cw, ch = cand["bbox"]
            keep = True
            for existing in deduped:
                ex, ey, ew, eh = existing["bbox"]
                ix1 = max(cx, ex)
                iy1 = max(cy, ey)
                ix2 = min(cx + cw, ex + ew)
                iy2 = min(cy + ch, ey + eh)
                if ix2 > ix1 and iy2 > iy1:
                    inter = (ix2 - ix1) * (iy2 - iy1)
                    union = (cw * ch) + (ew * eh) - inter
                    if union > 0 and (inter / union) > 0.4:
                        keep = False
                        break
            if keep:
                deduped.append(cand)

        return deduped

    def _warp_perspective(self, img: np.ndarray, pts: np.ndarray, out_size: int = 400) -> np.ndarray | None:
        """Rectifies a perspective-distorted QR code into an upright square."""
        try:
            rect = np.zeros((4, 2), dtype="float32")
            s = pts.sum(axis=1)
            rect[0] = pts[np.argmin(s)]       # Top-left
            rect[2] = pts[np.argmax(s)]       # Bottom-right
            diff = np.diff(pts, axis=1)
            rect[1] = pts[np.argmin(diff)]    # Top-right
            rect[3] = pts[np.argmax(diff)]    # Bottom-left

            dst = np.array([
                [0, 0],
                [out_size - 1, 0],
                [out_size - 1, out_size - 1],
                [0, out_size - 1]
            ], dtype="float32")

            M = cv2.getPerspectiveTransform(rect, dst)
            warped = cv2.warpPerspective(img, M, (out_size, out_size))
            return warped
        except Exception:
            return None

    # -------------------------------------------------------------------------
    # Multi-pass Decoding
    # -------------------------------------------------------------------------

    def _multi_pass_decode(self, img_bgr: np.ndarray) -> str | None:
        """
        Decodes a candidate image or full image across progressive passes:
        1. PyZbar direct
        2. OpenCV direct
        3. Quiet zone (white padding)
        4. Inverted colors (dark mode)
        5. CLAHE + Otsu binarization
        6. Bicubic upscaling (if < 300px)
        """
        if img_bgr is None or img_bgr.size == 0:
            return None

        # Pass 1: Direct PyZbar
        res = self._try_zbar(img_bgr)
        if res:
            return res

        # Pass 2: Direct OpenCV
        res = self._try_opencv(img_bgr)
        if res:
            return res

        # Pass 3: Quiet zone padding
        h, w = img_bgr.shape[:2]
        pad = max(24, int(min(h, w) * 0.12))
        padded = cv2.copyMakeBorder(
            img_bgr, pad, pad, pad, pad,
            cv2.BORDER_CONSTANT, value=[255, 255, 255]
        )

        res = self._try_zbar(padded) or self._try_opencv(padded)
        if res:
            return res

        # Pass 4: Inverted colors (Dark mode QR)
        gray = cv2.cvtColor(padded, cv2.COLOR_BGR2GRAY)
        inverted = cv2.bitwise_not(gray)
        res = self._try_zbar(inverted) or self._try_opencv(inverted)
        if res:
            return res

        # Pass 5: Contrast enhancement (CLAHE) + Otsu
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        _, thresh = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        res = self._try_zbar(thresh) or self._try_opencv(thresh)
        if res:
            return res

        # Pass 6: Bicubic upscaling for small crops
        if w < 300 or h < 300:
            scale = 2.0
            resized = cv2.resize(padded, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
            res = self._try_zbar(resized) or self._try_opencv(resized)
            if res:
                return res

        return None

    def _try_zbar(self, img: np.ndarray) -> str | None:
        try:
            barcodes = decode_zbar(img)
            for barcode in barcodes:
                data = barcode.data.decode("utf-8", errors="ignore").strip()
                if data:
                    return data
        except Exception:
            pass
        return None

    def _try_opencv(self, img: np.ndarray) -> str | None:
        try:
            if len(img.shape) == 2:
                img_for_cv = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
            else:
                img_for_cv = img
            val, pts, _ = self.cv_detector.detectAndDecode(img_for_cv)
            if val and val.strip():
                return val.strip()
        except Exception:
            pass
        return None
