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
      chrome.storage.sync.get(["mode", "useOcr"], async (data) => {
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
        } else {
          const croppedDataUrl = canvas.toDataURL("image/png");
          let extractedText = null;

          if (data.useOcr) {
            updatePopupLoadingText("Đang bóc tách chữ Offline (Tesseract)...");
            try {
              if (typeof Tesseract === "undefined") throw new Error("Chưa nạp được thư viện lõi Tesseract");

              const worker = await Tesseract.createWorker("vie+eng", 1, {
                workerPath: chrome.runtime.getURL('worker.min.js'),
                corePath: chrome.runtime.getURL('tesseract-core.wasm.js'),
                logger: m => {
                   if (m.status === "recognizing text") {
                      updatePopupLoadingText(`Đang đọc ảnh OCR ... ${Math.round(m.progress * 100)}%`);
                   } else {
                      updatePopupLoadingText(`Đang tải lõi ngôn ngữ ...`);
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
              updatePopupLoadingText("Đang gửi văn bản OCR cho AI phân tích...");
            } catch (err) {
              console.error(err);
              updatePopupError("Lỗi mảng OCR: " + err.message);
              return;
            }
          } else {
            updatePopupLoadingText("Đang chờ AI phân tích (Vision)...");
          }

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

  // --- POPUP UI ---
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
      <span>Snap & Translate</span>
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
    `;
  }

  function updatePopupLoadingText(text) {
    const textEl = document.getElementById("snap-loading-text");
    if (textEl) {
      textEl.innerText = text;
    } else {
      showPopupLoading();
      document.getElementById("snap-loading-text").innerText = text;
    }
  }

  function updatePopupResult(original, translation) {
    const content = document.getElementById("snap-translate-content");
    let html = "";
    if (original && original !== "Tìm thấy Mã QR:") {
      html += `
      <div class="snap-translate-section">
        <div class="snap-translate-label">BẢN GỐC</div>
        <div class="snap-translate-text" style="white-space: pre-wrap;">${escapeHtml(original)}</div>
      </div>`;
    }
    
    let safeTranslation = escapeHtml(translation);
    // Tự động biến các đường link thành thẻ <a> có thể click được
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
