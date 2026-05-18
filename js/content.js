// Ensure script run only once
if (typeof window.snapTranslateInjected === 'undefined') {
  window.snapTranslateInjected = true;

  let startX, startY;
  let isSnapping = false;
  let overlay, selectionBox;
  let currentSnapMode = "translate";

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_SNAP") {
      currentSnapMode = request.mode || "translate";
      initSnapOverlay();
    }
    if (request.action === "THEME_CHANGED") {
      applyTheme(request.theme);
    }
  });

  chrome.storage.sync.get({ theme: "light" }, (data) => {
    applyTheme(data.theme);
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

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

  function onKeyDown(e) {
    if (e.key === "Escape") {
      removeOverlay();
    }
  }

  function onMouseDown(e) {
    isSnapping = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = startX + "px";
    selectionBox.style.top = startY + "px";
    selectionBox.style.width = "0px";
    selectionBox.style.height = "0px";
    selectionBox.style.display = "block";
  }

  function onMouseMove(e) {
    if (!isSnapping) return;
    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);

    selectionBox.style.left = left + "px";
    selectionBox.style.top = top + "px";
    selectionBox.style.width = width + "px";
    selectionBox.style.height = height + "px";
  }

  function onMouseUp(e) {
    if (!isSnapping) return;
    isSnapping = false;

    const rect = selectionBox.getBoundingClientRect();
    removeOverlay();

    if (rect.width > 20 && rect.height > 20) {
      processSnap(rect);
    }
  }

  function removeOverlay() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    document.removeEventListener("keydown", onKeyDown);
  }

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

  function cropImage(dataUrl, rect) {
    const img = new Image();
    img.onload = async () => {
      chrome.storage.sync.get({ useOcr: true, aiChannel: "web" }, async (data) => {
        const dpr = window.devicePixelRatio || 1;
        const canvasWidth = rect.width * dpr;
        const canvasHeight = rect.height * dpr;

        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, rect.left * dpr, rect.top * dpr, canvasWidth, canvasHeight, 0, 0, canvasWidth, canvasHeight);

        const croppedDataUrl = canvas.toDataURL("image/png");

        if (currentSnapMode === "qr") {
          try {
            const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
              updatePopupResult("Tìm thấy Mã QR:", code.data);
              chrome.runtime.sendMessage({
                action: "SAVE_SNAP",
                entry: { mode: "qr", ocrText: "", translation: code.data, sourceUrl: window.location.href }
              });
              chrome.runtime.sendMessage({
                action: "SAVE_SNAP_FILES",
                dataUrl: croppedDataUrl,
                textContent: code.data,
                mode: "qr"
              });
            } else {
              updatePopupError("Không tìm thấy thông tin quét mã QR nào trong hình.");
            }
          } catch (e) {
            updatePopupError("Lỗi phần mềm đọc QR: " + e.message);
          }
          return;
        }

        let extractedText = null;

        if (data.useOcr) {
          updatePopupLoadingText("Đang bóc tách chữ Offline (Tesseract)...");
          try {
            if (typeof Tesseract === "undefined") throw new Error("Chưa nạp được thư viện lõi Tesseract");

            const worker = await Tesseract.createWorker("vie+eng", 1, {
              workerPath: chrome.runtime.getURL('lib/worker.min.js'),
              corePath: chrome.runtime.getURL('lib/tesseract-core.wasm.js'),
              langPath: chrome.runtime.getURL('lib/lang-data'),
              logger: m => {
                if (m.status === "recognizing text") {
                  updatePopupLoadingText(`Đang đọc ảnh OCR ... ${Math.round(m.progress * 100)}%`);
                } else {
                  updatePopupLoadingText(`Đang tải lõi OCR...`);
                }
              }
            });
            const ret = await worker.recognize(croppedDataUrl);
            await worker.terminate();
            extractedText = ret.data.text.trim();

            if (!extractedText) {
              updatePopupError("OCR không nhận diện được chữ nào trong vùng ảnh!");
              return;
            }

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
          } catch (err) {
            console.error(err);
            updatePopupError("Lỗi OCR: " + err.message);
            return;
          }
        }

        if (data.aiChannel === "web") {
          showOcrResultWithTranslateBtn(extractedText, croppedDataUrl);
        } else {
          updatePopupLoadingText(extractedText ? "Đang gửi cho AI phân tích..." : "Đang chờ AI phân tích (Vision)...");
          chrome.runtime.sendMessage({
            action: "TRANSLATE_IMAGE",
            dataUrl: croppedDataUrl,
            ocrText: extractedText
          }, (res) => {
            if (res && res.success) {
              updatePopupResult(extractedText ? `(OCR Text)\n${extractedText}` : "", res.translation);
            } else {
              updatePopupError(res ? res.error : "Mất kết nối với Trung tâm điều khiển. Thử tải lại thẻ.");
            }
          });
        }
      });
    };
    img.src = dataUrl;
  }

  function showOcrResultWithTranslateBtn(ocrText, croppedDataUrl) {
    const content = document.getElementById("snap-translate-content");
    if (!content) return;

    const displayText = ocrText || "(Không bóc được chữ - ảnh mờ hoặc không có text)";
    content.innerHTML = `
      <div class="snap-translate-section">
        <div class="snap-translate-label">VĂN BẢN TRÍCH XUẤT (OCR)</div>
        <div class="snap-translate-text" style="white-space: pre-wrap;">${escapeHtml(displayText)}</div>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:12px;">
        <button id="snap-chatgpt-translate-btn" style="
          background: linear-gradient(135deg, #10a37f, #1a7f5a);
          color: white; border: none; padding: 9px 16px;
          border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;
          display: inline-flex; align-items: center; gap: 6px;
          transition: 0.2s; box-shadow: 0 2px 8px rgba(16,163,127,0.35);
        ">
          <span>💬</span> Dịch bằng ChatGPT
        </button>
        <button id="snap-copy-ocr-btn" style="
          background: var(--snap-bg-secondary, #f1f3f4); color: var(--snap-text, #3c4043);
          border: 1px solid var(--snap-border, #dadce0); padding: 9px 14px;
          border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;
          display: inline-flex; align-items: center; gap: 5px; transition: 0.2s;
        ">
          <span>📋</span> Copy
        </button>
        <button id="snap-export-ocr-btn" style="
          background: var(--snap-bg-secondary, #f1f3f4); color: var(--snap-text, #3c4043);
          border: 1px solid var(--snap-border, #dadce0); padding: 9px 14px;
          border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;
          display: inline-flex; align-items: center; gap: 5px; transition: 0.2s;
        ">
          <span>📤</span> Export
        </button>
      </div>
    `;

    const btn = document.getElementById("snap-chatgpt-translate-btn");
    btn.addEventListener("mouseover", () => { btn.style.opacity = "0.85"; btn.style.transform = "translateY(-1px)"; });
    btn.addEventListener("mouseout",  () => { btn.style.opacity = "1";    btn.style.transform = "translateY(0)"; });

    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.innerHTML = "<span>⏳</span> Đang chuẩn bị...";

      chrome.runtime.sendMessage({ action: "PREP_CHATGPT_IFRAME" }, (res) => {
        if (res && !res.success) {
          console.warn("[SnapTranslate] Cookie prep:", res.error);
        }
        btn.innerHTML = "<span>⏳</span> Đang tải ChatGPT...";
        embedChatGPTIframe(ocrText, croppedDataUrl, btn);
      });
    });

    // Copy button
    document.getElementById("snap-copy-ocr-btn").addEventListener("click", () => {
      const text = ocrText || displayText;
      navigator.clipboard.writeText(text).then(() => {
        const cbtn = document.getElementById("snap-copy-ocr-btn");
        cbtn.innerHTML = '<span>✅</span> Copied!';
        setTimeout(() => { cbtn.innerHTML = '<span>📋</span> Copy'; }, 2000);
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        const cbtn = document.getElementById("snap-copy-ocr-btn");
        cbtn.innerHTML = '<span>✅</span> Copied!';
        setTimeout(() => { cbtn.innerHTML = '<span>📋</span> Copy'; }, 2000);
      });
    });

    // Export button
    document.getElementById("snap-export-ocr-btn").addEventListener("click", () => {
      const text = ocrText || displayText;
      const timestamp = new Date().toLocaleString('vi-VN');
      const exportText = `=== Snap & Translate AI ===\nThời gian: ${timestamp}\n\n[VĂN BẢN OCR]\n${text}\n`;
      const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snap-ocr-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      const ebtn = document.getElementById("snap-export-ocr-btn");
      ebtn.innerHTML = '<span>✅</span> Exported!';
      setTimeout(() => { ebtn.innerHTML = '<span>📤</span> Export'; }, 2000);
    });
  }

  function embedChatGPTIframe(ocrText, croppedDataUrl, btn) {
    const popupEl = document.getElementById("snap-translate-popup");
    if (!popupEl) return;

    popupEl.style.width  = "420px";
    popupEl.style.height = "auto";
    popupEl.style.maxHeight = "none";
    popupEl.style.overflow = "visible";

    if (!document.getElementById("snap-resize-handle")) {
      const rh = document.createElement("div");
      rh.id = "snap-resize-handle";
      rh.style.cssText = `
        position: absolute; bottom: 0; right: 0;
        width: 18px; height: 18px; cursor: se-resize;
        background: linear-gradient(135deg, transparent 50%, #ccc 50%);
        border-radius: 0 0 8px 0;
        z-index: 10;
      `;
      rh.title = "Kéo để thay đổi kích thước";
      popupEl.appendChild(rh);
      makeResizable(popupEl, rh);
    }

    let iframeWrap = document.getElementById("snap-chatgpt-iframe-wrap");
    if (!iframeWrap) {
      iframeWrap = document.createElement("div");
      iframeWrap.id = "snap-chatgpt-iframe-wrap";
      iframeWrap.style.cssText = `
        margin-top: 10px;
        border-top: 1px solid #e0e0e0;
        border-radius: 0 0 8px 8px;
        overflow: hidden;
        height: 420px;
      `;

      const iframe = document.createElement("iframe");
      iframe.id = "snap-chatgpt-iframe";
      iframe.src = "https://chatgpt.com/";
      iframe.allow = "clipboard-read; clipboard-write;";
      iframe.style.cssText = "width: 100%; height: 100%; border: none; display: block;";

      iframeWrap.appendChild(iframe);

      const content = document.getElementById("snap-translate-content");
      if (content) content.appendChild(iframeWrap);

      iframe.addEventListener("load", () => {
        btn.innerHTML = "<span>✅</span> Đã gửi!";
        chrome.runtime.sendMessage({
          action: "SEND_CHATGPT_PROMPT",
          ocrText: ocrText,
          dataUrl: croppedDataUrl
        });
      });
    } else {
      const iframe = document.getElementById("snap-chatgpt-iframe");
      if (iframe) iframe.src = "https://chatgpt.com/";
      btn.innerHTML = "<span>⏱</span> Đang nạp lại...";
    }
  }

  function makeResizable(el, handle) {
    let startX, startY, startW, startH;
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      startW = el.offsetWidth;
      startH = el.offsetHeight;
      const onMove = (em) => {
        el.style.width  = Math.max(280, startW + em.clientX - startX) + "px";
        el.style.height = Math.max(200, startH + em.clientY - startY) + "px";
        const iframeWrap = document.getElementById("snap-chatgpt-iframe-wrap");
        if (iframeWrap) {
          const headerH = document.getElementById("snap-translate-header")?.offsetHeight || 40;
          const contentH = document.getElementById("snap-translate-content")?.scrollHeight || 200;
          iframeWrap.style.height = Math.max(150, el.offsetHeight - headerH - (contentH - iframeWrap.offsetHeight) - 20) + "px";
        }
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup",   onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup",   onUp);
    });
  }

  let popup;

  function createPopupContainer() {
    if (document.getElementById("snap-translate-popup")) {
      document.getElementById("snap-translate-popup").remove();
    }

    const container = document.fullscreenElement || document.body;

    popup = document.createElement("div");
    popup.id = "snap-translate-popup";

    const header = document.createElement("div");
    header.id = "snap-translate-header";
    header.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span id="snap-guide-btn" title="Hướng dẫn sử dụng" style="cursor:pointer; opacity:0.8; font-size:16px; transition:0.2s;">📖</span>
        <span id="snap-settings-btn" title="Mở trang Cài đặt" style="cursor:pointer; opacity:0.8; font-size:18px; transition:0.2s;"> ⚙ </span>
        <span>Snap & Translate</span>
      </div>
      <button id="snap-translate-close">&times;</button>
    `;

    const content = document.createElement("div");
    content.id = "snap-translate-content";

    popup.appendChild(header);
    popup.appendChild(content);
    container.appendChild(popup);

    document.getElementById("snap-translate-close").addEventListener("click", () => {
      popup.remove();
    });

    document.getElementById("snap-settings-btn").addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "OPEN_OPTIONS" });
    });
    document.getElementById("snap-settings-btn").addEventListener("mouseover", (e) => e.target.style.opacity = "1");
    document.getElementById("snap-settings-btn").addEventListener("mouseout", (e) => e.target.style.opacity = "0.8");

    document.getElementById("snap-guide-btn").addEventListener("click", () => {
      showOnboarding();
    });
    document.getElementById("snap-guide-btn").addEventListener("mouseover", (e) => e.target.style.opacity = "1");
    document.getElementById("snap-guide-btn").addEventListener("mouseout", (e) => e.target.style.opacity = "0.8");

    makeDraggable(popup, header);
  }

  function showOnboarding() {
    const content = document.getElementById("snap-translate-content");
    if (!content) return;

    content.innerHTML = `
      <div style="padding:8px 0;">
        <h3 style="margin:0 0 16px; font-size:16px; color:var(--snap-primary, #1a73e8);">📖 Hướng dẫn sử dụng</h3>
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; gap:10px; align-items:flex-start; padding:10px; background:var(--snap-bg-secondary, #f8f9fa); border-radius:8px;">
            <span style="font-size:20px;">1️⃣</span>
            <div>
              <strong style="font-size:13px;">Chụp vùng màn hình</strong>
              <p style="margin:4px 0 0; font-size:12px; color:var(--snap-text-secondary, #5f6368);">Nhấn <code style="background:var(--snap-border, #dadce0); padding:1px 5px; border-radius:3px;">Alt+X</code> hoặc mở extension → chọn "Snap Dịch" → kéo chuột chọn vùng cần dịch.</p>
            </div>
          </div>
          <div style="display:flex; gap:10px; align-items:flex-start; padding:10px; background:var(--snap-bg-secondary, #f8f9fa); border-radius:8px;">
            <span style="font-size:20px;">2️⃣</span>
            <div>
              <strong style="font-size:13px;">OCR tự động</strong>
              <p style="margin:4px 0 0; font-size:12px; color:var(--snap-text-secondary, #5f6368);">Extension tự động trích xuất chữ từ ảnh. Bạn có thể tắt OCR trong Cài đặt để dùng AI Vision trực tiếp.</p>
            </div>
          </div>
          <div style="display:flex; gap:10px; align-items:flex-start; padding:10px; background:var(--snap-bg-secondary, #f8f9fa); border-radius:8px;">
            <span style="font-size:20px;">3️⃣</span>
            <div>
              <strong style="font-size:13px;">Dịch thuật</strong>
              <p style="margin:4px 0 0; font-size:12px; color:var(--snap-text-secondary, #5f6368);">Nhấn "Dịch bằng ChatGPT" để gửi văn bản cho AI. Kết quả hiển thị ngay trong popup. Dùng 📋 Copy hoặc 📤 Export để lưu.</p>
            </div>
          </div>
          <div style="display:flex; gap:10px; align-items:flex-start; padding:10px; background:var(--snap-bg-secondary, #f8f9fa); border-radius:8px;">
            <span style="font-size:20px;">4️⃣</span>
            <div>
              <strong style="font-size:13px;">Đọc mã QR</strong>
              <p style="margin:4px 0 0; font-size:12px; color:var(--snap-text-secondary, #5f6368);">Chọn "Snap Đọc QR" → chụp vùng chứa mã QR → nội dung hiển thị ngay lập tức.</p>
            </div>
          </div>
        </div>
        <div style="text-align:center; margin-top:16px;">
          <button id="snap-onboarding-close" style="
            background:var(--snap-primary, #1a73e8); color:white; border:none;
            padding:8px 24px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600;
          ">Đã hiểu ✓</button>
        </div>
      </div>
    `;

    document.getElementById("snap-onboarding-close").addEventListener("click", () => {
      chrome.storage.sync.set({ hasSeenOnboarding: true });
      showPopupLoading();
    });
  }

  function showPopupLoading() {
    createPopupContainer();
    const content = document.getElementById("snap-translate-content");
    content.innerHTML = `
      <div class="snap-loader">
        <div class="snap-spinner"></div>
        <span id="snap-loading-text">Đang chuẩn bị...</span>
      </div>
      <div style="text-align: center; margin-top: 15px;">
        <button id="snap-cancel-btn" style="background:#d93025; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; transition:0.2s;">✖ Hủy tiến trình</button>
      </div>
    `;

    document.getElementById("snap-cancel-btn").addEventListener("mouseover", (e) => e.target.style.background = "#c5221f");
    document.getElementById("snap-cancel-btn").addEventListener("mouseout", (e) => e.target.style.background = "#d93025");

    document.getElementById("snap-cancel-btn").addEventListener("click", () => {
      if (document.getElementById("snap-translate-popup")) {
        content.innerHTML = `
           <div style="display:flex; flex-direction:column; align-items:center; padding:15px 0;">
             <div style="color:var(--snap-danger, #d93025); font-size:24px; margin-bottom:8px;">⛔</div>
             <div style="color:var(--snap-danger, #d93025); font-weight:bold; font-size:13px;">TIẾN TRÌNH ĐÃ BỊ HỦY!</div>
           </div>
         `;
        setTimeout(() => {
          if (document.getElementById("snap-translate-popup")) {
            document.getElementById("snap-translate-popup").remove();
          }
        }, 1200);
      }
    });
  }

  function updatePopupLoadingText(text) {
    const textEl = document.getElementById("snap-loading-text");
    if (textEl) {
      textEl.innerText = text;
    } else {
      if (document.getElementById("snap-translate-popup")) {
        showPopupLoading();
        document.getElementById("snap-loading-text").innerText = text;
      }
    }
  }

  function updatePopupResult(original, translation) {
    const content = document.getElementById("snap-translate-content");
    if (!content) return;

    const isQR = original === "Tìm thấy Mã QR:";
    const label = isQR ? "NỘI DUNG MÃ QR:" : "KẾT QUẢ TỪ CHATGPT";
    const textColor = isQR ? "var(--snap-success, #0f9d58)" : "var(--snap-primary, #0b57d0)";

    let html = "";
    if (original && !isQR) {
      html += `
      <div class="snap-translate-section">
        <div class="snap-translate-label">BẢN GỐC</div>
        <div class="snap-translate-text" style="white-space: pre-wrap;">${escapeHtml(original)}</div>
      </div>`;
    }

    let safeTranslation = escapeHtml(translation);
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    safeTranslation = safeTranslation.replace(urlRegex, '<a href="$1" target="_blank" style="color: var(--snap-link, #1a73e8); text-decoration: underline; word-break: break-all;">$1</a>');

    html += `
      <div class="snap-translate-section">
        <div class="snap-translate-label">${label}</div>
        <div class="snap-translate-text" style="color:${textColor}; font-weight:500; white-space: pre-wrap;">${safeTranslation}</div>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="snap-copy-btn" data-text="${escapeAttr(translation)}" style="
            background: var(--snap-bg-secondary, #f1f3f4); color: var(--snap-text, #3c4043);
            border: 1px solid var(--snap-border, #dadce0); padding: 5px 12px; border-radius: 6px;
            cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;
          ">📋 Copy</button>
          <button class="snap-export-btn" data-original="${escapeAttr(original || '')}" data-translation="${escapeAttr(translation)}" style="
            background: var(--snap-bg-secondary, #f1f3f4); color: var(--snap-text, #3c4043);
            border: 1px solid var(--snap-border, #dadce0); padding: 5px 12px; border-radius: 6px;
            cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;
          ">📤 Export</button>
        </div>
      </div>
    `;
    content.innerHTML = html;

    content.querySelectorAll('.snap-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-text');
        navigator.clipboard.writeText(text).then(() => {
          btn.innerHTML = '✅ Copied!';
          setTimeout(() => { btn.innerHTML = '📋 Copy'; }, 2000);
        }).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          btn.innerHTML = '✅ Copied!';
          setTimeout(() => { btn.innerHTML = '📋 Copy'; }, 2000);
        });
      });
    });

    content.querySelectorAll('.snap-export-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const original = btn.getAttribute('data-original');
        const translation = btn.getAttribute('data-translation');
        const timestamp = new Date().toLocaleString('vi-VN');
        const exportText = `=== Snap & Translate AI ===\nThời gian: ${timestamp}\n\n[BẢN GỐC]\n${original}\n\n[BẢN DỊCH]\n${translation}\n`;
        const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `snap-translate-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        btn.innerHTML = '✅ Exported!';
        setTimeout(() => { btn.innerHTML = '📤 Export'; }, 2000);
      });
    });
  }

  function updatePopupError(errorMsg) {
    const content = document.getElementById("snap-translate-content");
    if (!content) return;

    content.innerHTML = `
      <div class="snap-translate-section">
        <div class="snap-translate-label" style="color:var(--snap-danger, #d93025);">Có Lỗi Xảy Ra</div>
        <div class="snap-translate-text" style="color:var(--snap-danger-text, #ba1a1a); background:var(--snap-danger-bg, #fce8e6); border-color:var(--snap-danger-border, #fad2cf);">
          ${escapeHtml(errorMsg)}
        </div>
      </div>
    `;
  }

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function makeDraggable(elmnt, header) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
      elmnt.style.right = "auto";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  // Show onboarding on first use
  chrome.storage.sync.get({ hasSeenOnboarding: false }, (data) => {
    if (!data.hasSeenOnboarding) {
      setTimeout(() => showOnboarding(), 500);
    }
  });
}
