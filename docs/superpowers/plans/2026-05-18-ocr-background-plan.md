# OCR Background Service Worker Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move OCR processing from content script to background service worker to bypass CSP restrictions on sites like Facebook and GitHub.

**Architecture:** Content script captures image and sends base64 to background service worker. Background runs Tesseract OCR in extension context (immune to page CSP), returns extracted text to content script for display.

**Tech Stack:** Chrome Extension, Tesseract.js (WASM), chrome.runtime.sendMessage

---

## Files Modified

- `js/content.js` - Remove local Tesseract OCR, send to background handler
- `js/background.js` - Add OCR message handler with Tesseract processing

---

## Task 1: Modify content.js to send OCR to background

**Files:**
- Modify: `js/content.js:158-201` (OCR section)
- Read: `js/content.js:117-156` (cropImage function structure)
- Read: `js/content.js:224-316` (showOcrResultWithTranslateBtn function)

- [ ] **Step 1: Read current OCR section in content.js**

Read lines 158-201 to understand current OCR implementation that needs replacement.

- [ ] **Step 2: Replace OCR section with background call**

Replace lines 158-201 with:

```javascript
// Send to background for OCR (bypasses CSP)
chrome.runtime.sendMessage({
  action: "OCR_IMAGE",
  dataUrl: croppedDataUrl,
  mode: "translate"
}, async (response) => {
  if (response && response.success) {
    const extractedText = response.text;
    
    if (!extractedText) {
      updatePopupError("OCR không nhận diện được chữ nào trong vùng ảnh!");
      return;
    }

    // Save to memory immediately after OCR
    chrome.runtime.sendMessage({
      action: "SAVE_SNAP",
      entry: { mode: "translate", ocrText: extractedText, translation: "", sourceUrl: window.location.href }
    });
    chrome.runtime.sendMessage({
      action: "SAVE_SNAP_FILES",
      dataUrl: croppedDataUrl,
      textContent: extractedText,
      mode: "translate"
    });

    // Display OCR result with translate button
    showOcrResultWithTranslateBtn(extractedText, croppedDataUrl);
  } else {
    const errorMsg = response?.error || "OCR thất bại";
    // Fallback: try AI Vision instead
    if (data.aiChannel === "web") {
      showOcrResultWithTranslateBtn(null, croppedDataUrl);
    } else {
      updatePopupError(errorMsg + ". Thử dùng AI Vision thay thế.");
    }
  }
});
```

- [ ] **Step 3: Verify the change compiles**

Check that the new code structure is valid JavaScript (no syntax errors).

- [ ] **Step 4: Commit**

```bash
git add js/content.js
git commit -m "feat: send OCR to background service worker - bypass CSP"
```

---

## Task 2: Add OCR handler in background.js

**Files:**
- Modify: `js/background.js:23-136` (message listener switch)
- Read: `js/background.js:1-22` (imports section)

- [ ] **Step 1: Add OCR_IMAGE case to message listener**

Add after line 41 (after TRANSLATE_IMAGE case):

```javascript
case "OCR_IMAGE":
  handleOCR(request.dataUrl, request.mode, sendResponse);
  return true;
```

- [ ] **Step 2: Add handleOCR function**

Add after imports section (around line 10):

```javascript
async function handleOCR(dataUrl, mode, callback) {
  try {
    // Dynamically load Tesseract if not already loaded
    let Tesseract;
    if (typeof require === 'undefined') {
      // Use import for ES module in service worker context
      Tesseract = await import(chrome.runtime.getURL('lib/tesseract.min.js'));
      Tesseract = Tesseract.default || Tesseract;
    } else {
      Tesseract = await import('./lib/tesseract.min.js');
    }

    const worker = await Tesseract.createWorker("vie+eng", 1, {
      workerPath: chrome.runtime.getURL('lib/worker.min.js'),
      corePath: chrome.runtime.getURL('lib/tesseract-core.wasm.js'),
      langPath: chrome.runtime.getURL('lib/lang-data'),
      logger: m => console.log("[OCR]", m.status, m.progress)
    });

    const result = await worker.recognize(dataUrl);
    await worker.terminate();

    const text = result.data.text.trim();
    callback({ success: true, text: text });
  } catch (err) {
    console.error("[OCR] Error:", err);
    callback({ success: false, error: err.message });
  }
}
```

**Wait** - Tesseract.js in service worker context might have issues with dynamic import. Let me check for better approach.

Actually, for service worker context, we need a different approach. Tesseract.js works differently in background. Let me revise:

- [ ] **Step 2 revised: Add handleOCR function (working approach)**

For service worker, we need to use Tesseract differently. Add this function:

```javascript
async function handleOCR(dataUrl, mode, callback) {
  try {
    // Tesseract.js in service worker - use global import
    const Tesseract = window.Tesseract;
    
    if (!Tesseract) {
      // Load Tesseract script dynamically
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('lib/tesseract.min.js');
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const worker = await Tesseract.createWorker("vie+eng", 1, {
      workerPath: chrome.runtime.getURL('lib/worker.min.js'),
      corePath: chrome.runtime.getURL('lib/tesseract-core.wasm.js'),
      langPath: chrome.runtime.getURL('lib/lang-data')
    });

    const result = await worker.recognize(dataUrl);
    await worker.terminate();

    const text = result.data.text.trim();
    callback({ success: true, text: text });
  } catch (err) {
    console.error("[OCR] Error:", err);
    callback({ success: false, error: err.message });
  }
}
```

- [ ] **Step 3: Test syntax**

Verify no JavaScript syntax errors.

- [ ] **Step 4: Commit**

```bash
git add js/background.js
git commit -m "feat: add OCR handler in background service worker"
```

---

## Task 3: Test on CSP-restricted sites

**Files:**
- Test: Load extension in Chrome
- Test: Facebook.com - use Snap & Translate
- Test: github.com - use Snap & Translate

- [ ] **Step 1: Reload extension**

In Chrome: Extensions → Snap & Translate → Reload

- [ ] **Step 2: Test on Facebook**

1. Open Facebook
2. Click extension → Snap Dịch
3. Select a region with text
4. Verify OCR works without CSP error

- [ ] **Step 3: Test on GitHub**

1. Open any GitHub page with text
2. Click extension → Snap Dịch
3. Select a region with text
4. Verify OCR works without CSP error

- [ ] **Step 4: Verify QR still works**

1. Click Snap Đọc QR
2. Select QR code region
3. Verify QR is detected

- [ ] **Step 5: Commit**

```bash
git commit -m "test: verify OCR works on Facebook and GitHub"
```

---

## Verification Checklist

- [ ] OCR runs on Facebook (no CSP error)
- [ ] OCR runs on GitHub (no CSP error)
- [ ] OCR still works on normal sites
- [ ] QR scanning still works
- [ ] Memory auto-save works (PNG + text saved after OCR)
- [ ] Extension loads without errors in console

---

## Expected Results

| Site | Before (CSP blocked) | After (Background) |
|------|---------------------|-------------------|
| Facebook | ❌ "Tesseract not defined" | ✅ OCR works |
| GitHub | ❌ CSP error | ✅ OCR works |
| Other sites | ✅ Works | ✅ Works (no change) |