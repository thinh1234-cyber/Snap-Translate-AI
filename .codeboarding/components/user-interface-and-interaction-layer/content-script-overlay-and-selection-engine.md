---
component_id: 1.1
component_name: Content Script Overlay & Selection Engine
---

# Content Script Overlay & Selection Engine

## Component Description

Operates within the DOM of the active web page to provide a visual selection tool. It manages the lifecycle of the 'Snap' box, captures mouse coordinates for area selection, and injects a custom UI container to display OCR results and translation actions directly over the page content.

---

## Key References:

### d:\trans extension\js\content.js (lines 15-35)
```
  function initSnapOverlay() {
    if (document.getElementById("snap-translate-overlay")) return;

    const container = document.fullscreenElement || document.body;

    overlay = document.createElement("div");
    overlay.id = "snap-translate-overlay";

    selectionBox = document.createElement("div");
    selectionBox.id = "snap-translate-selection";
    selectionBox.style.display = "none";

    overlay.appendChild(selectionBox);
    container.appendChild(overlay);

    overlay.addEventListener("mousedown", onMouseDown);
    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mouseup", onMouseUp);

    document.addEventListener("keydown", onKeyDown);
  }
```

### d:\trans extension\js\content.js (lines 90-102)
```
  async function processSnap(rect) {
    showPopupLoading();

    setTimeout(() => {
      chrome.runtime.sendMessage({ action: "CAPTURE_SCREEN" }, (response) => {
        if (response && response.dataUrl) {
          cropImage(response.dataUrl, rect);
        } else {
          updatePopupError("Không thể chụp nền màn hình.");
        }
      });
    }, 50);
  }
```

### d:\trans extension\js\content.js (lines 194-236)
```
  function showOcrResultWithTranslateBtn(ocrText, croppedDataUrl) {
    const content = document.getElementById("snap-translate-content");
    if (!content) return;

    const displayText = ocrText || "(Không bóc được chữ - ảnh mờ hoặc không có text)";
    content.innerHTML = `
      <div class="snap-translate-section">
        <div class="snap-translate-label">VĂN BẢN TRÍCH XUẤT (OCR)</div>
        <div class="snap-translate-text" style="white-space: pre-wrap;">${escapeHtml(displayText)}</div>
      </div>
      <div style="text-align:center; margin-top:12px;">
        <button id="snap-chatgpt-translate-btn" style="
          background: linear-gradient(135deg, #10a37f, #1a7f5a);
          color: white; border: none; padding: 9px 20px;
          border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;
          display: inline-flex; align-items: center; gap: 7px;
          transition: 0.2s; box-shadow: 0 2px 8px rgba(16,163,127,0.35);
        ">
          <span>💬</span> Dịch bằng ChatGPT
        </button>
      </div>
    `;

    const btn = document.getElementById("snap-chatgpt-translate-btn");
    btn.addEventListener("mouseover", () => { btn.style.opacity = "0.85"; btn.style.transform = "translateY(-1px)"; });
    btn.addEventListener("mouseout",  () => { btn.style.opacity = "1";    btn.style.transform = "translateY(0)"; });

    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.innerHTML = "<span>⏳</span> Đang chuẩn bị...";

      // Bước 1: Re-set cookies chatgpt.com → SameSite=None để iframe nhận session
      chrome.runtime.sendMessage({ action: "PREP_CHATGPT_IFRAME" }, (res) => {
        if (res && !res.success) {
          // Không tìm thấy cookie → hiển thị cảnh báo nhưng vẫn thử load (user tự đăng nhập trong iframe)
          console.warn("[SnapTranslate] Cookie prep:", res.error);
        }
        btn.innerHTML = "<span>⏳</span> Đang tải ChatGPT...";
        // Bước 2: Tạo iframe (cookies đã được inject vào store)
        embedChatGPTIframe(ocrText, croppedDataUrl, btn);
      });
    });
  }
```


## Source Files:

- `js\architecture.js`
- `js\config.js`
- `js\content.js`
- `js\options.js`
- `js\popup.js`

