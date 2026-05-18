# Spec: Move OCR to Background Service Worker

**Date:** 2026-05-18
**Status:** Draft
**Goal:** Fix OCR failure on CSP-restricted sites (Facebook, GitHub)

---

## Problem

Current OCR runs in content script (page context), blocked by site CSP:
- Tesseract.js uses Web Workers → CSP blocks worker loading
- `eval()` usage in some code paths → CSP blocks
- Blob URLs for workers → CSP blocks

## Solution

Move OCR processing to background service worker - runs in extension context, immune to page CSP.

---

## Architecture

```
┌─────────────────────────┐     ┌───────────────────────────┐
│     Content Script      │     │   Background Service      │
│     (page context)      │     │   Worker (extension ctx)  │
│                         │     │                           │
│ cropImage() ──────────►│────►│ OCR_IMAGE handler         │
│   → dataUrl (base64)   │ msg │   → Tesseract (WASM)       │
│                         │     │   → return text           │
│ ◄───────────────────────│◄────│                           │
│   Display result       │     │                           │
└─────────────────────────┘     └───────────────────────────┘
```

---

## Changes

### 1. content.js - Remove local OCR

**Modify:** `cropImage()` function (lines ~117-220)

**Before:**
```javascript
// Tesseract chạy trong content script - BỊ CSP BLOCK
const worker = await Tesseract.createWorker("vie+eng", 1, {...});
const ret = await worker.recognize(croppedDataUrl);
```

**After:**
```javascript
// Gửi ảnh về background để OCR
chrome.runtime.sendMessage({
  action: "OCR_IMAGE",
  dataUrl: croppedDataUrl,
  mode: "translate"
}, (response) => {
  if (response.success) {
    // Display OCR text + enable translate
  } else {
    // Show error
  }
});
```

### 2. background.js - Add OCR handler

**Add new case in message listener:**
```javascript
case "OCR_IMAGE":
  handleOCR(request.dataUrl, request.mode, sendResponse);
  return true;
```

**New function:** `handleOCR(dataUrl, mode, callback)`

Implementation:
1. Receive base64 image data
2. Initialize Tesseract worker in service worker context
3. Run OCR recognition
4. Return extracted text
5. Cleanup worker

### 3. Keep QR in Content Script

QR scanning (jsQR) stays in content script:
- Requires `ctx.getImageData()` from canvas - only available in page context
- QR scanning is lightweight, less likely to hit CSP issues
- Can move to background later if needed (would need canvas data serialization)

---

## Data Flow

### Step 1: User selects region
```
User drags → selectionBox captures coordinates
```

### Step 2: Content script captures & crops
```javascript
// canvas.toDataURL() - works fine (no CSP issue here)
const croppedDataUrl = canvas.toDataURL("image/png");
```

### Step 3: Send to background
```javascript
chrome.runtime.sendMessage({
  action: "OCR_IMAGE",
  dataUrl: croppedDataUrl,
  mode: "translate"
});
```

### Step 4: Background processes OCR
```javascript
// Tesseract in extension context - NO CSP!
const worker = await Tesseract.createWorker("vie+eng");
const result = await worker.recognize(dataUrl);
return result.data.text;
```

### Step 5: Return result to content
```javascript
{ success: true, text: "extracted text here" }
```

### Step 6: Display in UI
```
Show OCR text → Enable translate button → Save to memory
```

---

## Error Handling

| Error | Message | Action |
|-------|---------|--------|
| OCR timeout | "OCR mất quá lâu, thử lại" | Retry or fallback |
| Worker init fail | "Khởi động OCR thất bại" | Show error |
| Empty result | "Không nhận diện được chữ" | Show message |
| CSP error (fallback) | "Lỗi bảo mật trang, chuyển sang AI Vision" | Fallback to AI |

---

## Memory Considerations

Service worker has ~8MB heap limit. Strategy:
- Load Tesseract only when needed
- Terminate worker after each OCR
- Use WASM (lighter than ASM.js)
- Clean up temp data promptly

---

## Testing Plan

1. Test on Facebook - verify OCR works
2. Test on GitHub - verify OCR works
3. Test on normal sites - ensure no regression
4. Test QR still works
5. Test memory save after OCR
6. Test error scenarios

---

## Files Modified

1. `js/content.js` - Remove local OCR, add message to background
2. `js/background.js` - Add OCR message handler
3. (No new files needed - reuse existing Tesseract files)

---

## Success Criteria

- ✅ OCR works on Facebook without CSP errors
- ✅ OCR works on GitHub without CSP errors
- ✅ No regression on normal sites
- ✅ QR scanning still functional
- ✅ Memory auto-save still works