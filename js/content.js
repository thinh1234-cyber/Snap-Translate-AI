// Ensure script run only once
if (typeof window.snapTranslateInjected === 'undefined') {
  window.snapTranslateInjected = true;

  let startX, startY;
  let isSnapping = false;
  let overlay, selectionBox;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_SNAP") {
      initSnapOverlay();
    }
  });

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
      chrome.storage.sync.get({ mode: "normal", useOcr: true, aiChannel: "web" }, async (data) => {
        const dpr = window.devicePixelRatio || 1;
        const canvasWidth = rect.width * dpr;
        const canvasHeight = rect.height * dpr;

        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, rect.left * dpr, rect.top * dpr, canvasWidth, canvasHeight, 0, 0, canvasWidth, canvasHeight);

        if (data.mode === "qr") {
          try {
            const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
              updatePopupResult("Tìm thấy Mã QR:", code.data);
            } else {
              updatePopupError("Không tìm thấy thông tin quét mã QR nào trong hình.");
            }
          } catch (e) {
            updatePopupError("Lỗi phần mềm đọc QR: " + e.message);
          }
          return;
        }

        const croppedDataUrl = canvas.toDataURL("image/png");
        let extractedText = null;

        // --- BƯỚC 1: OCR (nếu bật) ---
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
          } catch (err) {
            console.error(err);
            updatePopupError("Lỗi OCR: " + err.message);
            return;
          }
        }

        // --- BƯỚC 2: Phân luồng theo Channel ---
        if (data.aiChannel === "web") {
          // WEB OAUTH: Hiện OCR text ngay + Nút "Dịch bằng ChatGPT"
          showOcrResultWithTranslateBtn(extractedText, croppedDataUrl);
        } else {
          // API / LOCAL: Gửi thẳng, hiện kết quả trong popup
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

  // Web OAuth mode: Hiện OCR text + nút Dịch → Embed iframe ChatGPT bên trong popup
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

  // Nhúng iframe ChatGPT vào bên trong popup OCR, thêm resize handle
  function embedChatGPTIframe(ocrText, croppedDataUrl, btn) {
    const popupEl = document.getElementById("snap-translate-popup");
    if (!popupEl) return;

    // Mở rộng popup để chứa iframe, cho phép resize
    popupEl.style.width  = "420px";
    popupEl.style.height = "auto";
    popupEl.style.maxHeight = "none";
    popupEl.style.overflow = "visible";

    // Thêm resize handle nếu chưa có
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

    // Tạo khung iframe nếu chưa có
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

      // Gửi prompt khi iframe đã load xong
      iframe.addEventListener("load", () => {
        btn.innerHTML = "<span>✅</span> Đã gửi!";
        // Gửi qua background, background sẽ tìm frame theo webNavigation API
        chrome.runtime.sendMessage({
          action: "SEND_CHATGPT_PROMPT",
          ocrText: ocrText,
          dataUrl: croppedDataUrl
        });
      });
    } else {
      // Reload iframe để gửi prompt mới
      const iframe = document.getElementById("snap-chatgpt-iframe");
      if (iframe) iframe.src = "https://chatgpt.com/";
      btn.innerHTML = "<span>⏱</span> Đang nạp lại...";
    }
  }

  // Resize handle cho popup
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
        // Iframe đầy chiều cao còn lại
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

    makeDraggable(popup, header);
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
        // Hiệu ứng notification Hủy Tiền Trình
        content.innerHTML = `
           <div style="display:flex; flex-direction:column; align-items:center; padding:15px 0;">
             <div style="color:#d93025; font-size:24px; margin-bottom:8px;">⛔</div>
             <div style="color:#d93025; font-weight:bold; font-size:13px;">TIẾN TRÌNH ĐÃ BỊ HỦY!</div>
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
    if (!content) return; // Bảo vệ khi user bấm hủy

    let html = "";
    if (original && original !== "Tìm thấy Mã QR:") {
      html += `
      <div class="snap-translate-section">
        <div class="snap-translate-label">BẢN GỐC</div>
        <div class="snap-translate-text" style="white-space: pre-wrap;">${escapeHtml(original)}</div>
      </div>`;
    }

    let safeTranslation = escapeHtml(translation);
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    safeTranslation = safeTranslation.replace(urlRegex, '<a href="$1" target="_blank" style="color: #1a73e8; text-decoration: underline; word-break: break-all;">$1</a>');

    html += `
      <div class="snap-translate-section">
        <div class="snap-translate-label">${original === "Tìm thấy Mã QR:" ? "NỘI DUNG MÃ QR:" : "KẾT QUẢ TỪ CHATGPT"}</div>
        <div class="snap-translate-text" style="${original === "Tìm thấy Mã QR:" ? "color:#0f9d58" : "color:#0b57d0"}; font-weight:500; white-space: pre-wrap;">${safeTranslation}</div>
      </div>
    `;
    content.innerHTML = html;
  }

  function updatePopupError(errorMsg) {
    const content = document.getElementById("snap-translate-content");
    if (!content) return; // Bảo vệ khi user bấm hủy

    content.innerHTML = `
      <div class="snap-translate-section">
        <div class="snap-translate-label" style="color:#d93025;">Có Lỗi Xảy Ra</div>
        <div class="snap-translate-text" style="color:#ba1a1a; background:#fce8e6; border-color:#fad2cf;">
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
}
