// ═══════════════════════════════════════════════════════════
// CONTENT.JS — Snap Decode (Lightweight Client Bridge)
// 2 Core Features: High-precision OCR & Fast QR Code Decoder
// ═══════════════════════════════════════════════════════════

(() => {
  window.snapDecodeInjected = true;

  // Clean up any previous listener if extension was reloaded without page refresh
  if (window.__snapDecodeListener) {
    try {
      chrome.runtime.onMessage.removeListener(window.__snapDecodeListener);
    } catch (e) {}
  }

  let startX, startY;
  let isSnapping = false;
  let overlay, selectionBox;
  let currentSnapMode = "ocr"; // "ocr" | "qr"
  let popup;

  // ── Message Listener ───────────────────────────────────────
  const messageListener = (request, sender, sendResponse) => {
    if (request.action === "PING") {
      sendResponse({ status: "PONG" });
      return true;
    }

    if (request.action === "START_SNAP") {
      currentSnapMode = request.mode === "qr" ? "qr" : "ocr";
      initSnapOverlay();
      sendResponse({ status: "STARTED" });
      return true;
    }

    if (request.action === "THEME_CHANGED") {
      applyTheme(request.theme);
      return;
    }
  };

  window.__snapDecodeListener = messageListener;
  chrome.runtime.onMessage.addListener(messageListener);

  chrome.storage.sync.get({ theme: "light" }, (data) => {
    applyTheme(data.theme);
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  // ── Snap Overlay & Region Selection ────────────────────────
  function initSnapOverlay() {
    const prevOverlay = document.getElementById("snap-decode-overlay") || document.getElementById("snap-translate-overlay");
    if (prevOverlay) {
      prevOverlay.remove();
    }

    const container = document.fullscreenElement || document.body;

    overlay = document.createElement("div");
    overlay.id = "snap-translate-overlay";
    overlay.className = "snap-translate-overlay";
    overlay.style.cursor = "crosshair";

    selectionBox = document.createElement("div");
    selectionBox.id = "snap-translate-selection";
    selectionBox.className = "snap-translate-selection";
    selectionBox.style.cursor = "crosshair";
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
    const o1 = document.getElementById("snap-translate-overlay");
    if (o1) o1.remove();
    const o2 = document.getElementById("snap-decode-overlay");
    if (o2) o2.remove();
    document.removeEventListener("keydown", onKeyDown);
  }

  // ── Capture & Process Crop (Bridge to Python Backend) ──────
  async function processSnap(rect) {
    // 1. Chụp màn hình NGAY LẬP TỨC trước khi vẽ popup để ảnh không bị che
    chrome.runtime.sendMessage({ action: "CAPTURE_SCREEN" }, (response) => {
      if (chrome.runtime.lastError) {
        showPopupLoading();
        updatePopupError("Lỗi kết nối nền: " + chrome.runtime.lastError.message, true);
        return;
      }

      if (!response || !response.dataUrl) {
        showPopupLoading();
        updatePopupError(response?.error || "Không thể chụp màn hình trang web.", true);
        return;
      }

      // 2. Hiện popup loader sau khi đã chụp ảnh xong
      showPopupLoading();
      updatePopupLoadingText(
        currentSnapMode === "qr"
          ? "Đang định vị & giải mã QR..."
          : "Đang trích xuất ký tự OCR..."
      );

      // 3. Cắt ảnh và gửi sang Backend
      cropAndDispatchToBackend(response.dataUrl, rect);
    });
  }

  function cropAndDispatchToBackend(dataUrl, rect) {
    const img = new Image();
    img.onload = async () => {
      // Tỷ lệ scale thực giữa bitmap chụp và viewport
      const scaleX = img.naturalWidth / window.innerWidth;
      const scaleY = img.naturalHeight / window.innerHeight;

      const cropX = Math.round(rect.left * scaleX);
      const cropY = Math.round(rect.top * scaleY);
      const cropWidth = Math.round(rect.width * scaleX);
      const cropHeight = Math.round(rect.height * scaleY);

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, cropWidth);
      canvas.height = Math.max(1, cropHeight);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      const croppedDataUrl = canvas.toDataURL("image/png");

      chrome.runtime.sendMessage({
        action: "DECODE_IMAGE",
        mode: currentSnapMode,
        image: croppedDataUrl
      }, (data) => {
        if (!data) {
          updatePopupError("Không nhận được phản hồi từ backend.", true);
          return;
        }

        if (data.success) {
          const decodedText = data.text ? data.text.trim() : "";
          if (!decodedText) {
            updatePopupError("Không phát hiện được nội dung nào trong vùng chọn.", true);
            return;
          }

          chrome.runtime.sendMessage({
            action: "SAVE_SNAP",
            entry: {
              mode: currentSnapMode,
              text: decodedText,
              sourceUrl: window.location.href
            }
          });

          updatePopupResult(currentSnapMode, decodedText, croppedDataUrl, data.elapsedMs);
        } else {
          updatePopupError(data.error || "Không thể xử lý hình ảnh.", true);
        }
      });
    };
    img.src = dataUrl;
  }

  // ── Result & UI Rendering ──────────────────────────────────
  function createPopupContainer() {
    if (document.getElementById("snap-decode-popup")) {
      document.getElementById("snap-decode-popup").remove();
    }

    const container = document.fullscreenElement || document.body;

    popup = document.createElement("div");
    popup.id = "snap-decode-popup";
    popup.className = "snap-translate-popup";

    const header = document.createElement("div");
    header.id = "snap-decode-header";
    header.className = "snap-translate-header";
    header.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span id="snap-guide-btn" title="Hướng dẫn sử dụng" style="cursor:pointer; opacity:0.85; font-size:16px;">📖</span>
        <span id="snap-settings-btn" title="Mở trang Cài đặt" style="cursor:pointer; opacity:0.85; font-size:16px;">⚙️</span>
        <span style="font-weight:600; font-size:14px; letter-spacing:0.2px;">Snap Decode</span>
      </div>
      <button id="snap-decode-close" class="snap-translate-close" title="Đóng">&times;</button>
    `;

    const content = document.createElement("div");
    content.id = "snap-decode-content";
    content.className = "snap-translate-content";

    popup.appendChild(header);
    popup.appendChild(content);
    container.appendChild(popup);

    document.getElementById("snap-decode-close").addEventListener("click", () => {
      popup.remove();
    });

    document.getElementById("snap-settings-btn").addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "OPEN_OPTIONS" });
    });

    document.getElementById("snap-guide-btn").addEventListener("click", () => {
      showOnboarding();
    });

    makeDraggable(popup, header);
  }

  function showPopupLoading() {
    createPopupContainer();
    const content = document.getElementById("snap-decode-content");
    content.innerHTML = `
      <div class="snap-loader">
        <div class="snap-spinner"></div>
        <span id="snap-loading-text">Đang chuẩn bị...</span>
      </div>
      <div style="text-align: center; margin-top: 15px;">
        <button id="snap-cancel-btn" style="background:#d93025; color:white; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500;">✖ Hủy</button>
      </div>
    `;

    document.getElementById("snap-cancel-btn").addEventListener("click", () => {
      if (document.getElementById("snap-decode-popup")) {
        document.getElementById("snap-decode-popup").remove();
      }
    });
  }

  function updatePopupLoadingText(text) {
    const textEl = document.getElementById("snap-loading-text");
    if (textEl) {
      textEl.innerText = text;
    }
  }

  function updatePopupResult(mode, decodedText, croppedDataUrl, elapsedMs) {
    const content = document.getElementById("snap-decode-content");
    if (!content) return;

    const isQR = mode === "qr";
    const labelTitle = isQR ? "NỘI DUNG MÃ QR:" : "VĂN BẢN TRÍCH XUẤT (OCR):";
    const modeBadge = isQR ? "📷 QR Code (OpenCV / ZBar)" : "🔍 OCR (RapidOCR ONNX)";
    const badgeBg = isQR ? "rgba(15, 157, 88, 0.12)" : "rgba(26, 115, 232, 0.12)";
    const badgeColor = isQR ? "var(--snap-success, #0f9d58)" : "var(--snap-primary, #1a73e8)";

    const charCount = decodedText.length;
    const wordCount = decodedText.split(/\s+/).filter(Boolean).length;
    const speedText = elapsedMs !== undefined ? ` • ⚡ ${elapsedMs}ms` : "";
    const statsText = `${charCount} ký tự • ${wordCount} từ${speedText}`;

    let safeText = escapeHtml(decodedText);
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    safeText = safeText.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: var(--snap-link, #1a73e8); text-decoration: underline; word-break: break-all;">$1</a>');

    content.innerHTML = `
      <div class="snap-translate-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="snap-translate-label" style="margin-bottom:0;">${labelTitle}</span>
          <span style="font-size:11px; font-weight:600; padding:2px 8px; border-radius:12px; background:${badgeBg}; color:${badgeColor};">${modeBadge}</span>
        </div>
        <div class="snap-translate-text" style="white-space: pre-wrap; max-height:260px; overflow-y:auto; user-select:text;">${safeText}</div>
        <div style="margin-top:6px; font-size:11px; color:var(--snap-text-secondary, #5f6368); text-align:right;">${statsText}</div>
      </div>

      <div style="display:flex; justify-content:center; gap:8px; margin-top:14px;">
        <button id="snap-copy-btn" style="
          background: var(--snap-primary, #1a73e8); color: white;
          border: none; padding: 8px 16px; border-radius: 6px;
          cursor: pointer; font-size: 13px; font-weight: 500;
          display: inline-flex; align-items: center; gap: 6px; transition: 0.2s;
        ">
          <span>📋</span> Copy
        </button>

        <button id="snap-export-btn" style="
          background: var(--snap-bg-secondary, #f1f3f4); color: var(--snap-text, #3c4043);
          border: 1px solid var(--snap-border, #dadce0); padding: 8px 14px;
          border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;
          display: inline-flex; align-items: center; gap: 6px; transition: 0.2s;
        ">
          <span>📤</span> Export .txt
        </button>

        <button id="snap-resnap-btn" style="
          background: var(--snap-bg-secondary, #f1f3f4); color: var(--snap-text, #3c4043);
          border: 1px solid var(--snap-border, #dadce0); padding: 8px 14px;
          border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;
          display: inline-flex; align-items: center; gap: 6px; transition: 0.2s;
        ">
          <span>🔄</span> Resnap
        </button>
      </div>
    `;

    // Copy Event
    document.getElementById("snap-copy-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(decodedText).then(() => {
        const btn = document.getElementById("snap-copy-btn");
        btn.innerHTML = '<span>✅</span> Đã Copy!';
        setTimeout(() => { btn.innerHTML = '<span>📋</span> Copy'; }, 2000);
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = decodedText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        const btn = document.getElementById("snap-copy-btn");
        btn.innerHTML = '<span>✅</span> Đã Copy!';
        setTimeout(() => { btn.innerHTML = '<span>📋</span> Copy'; }, 2000);
      });
    });

    // Export Event
    document.getElementById("snap-export-btn").addEventListener("click", () => {
      const timestamp = new Date().toLocaleString('vi-VN');
      const headerTag = isQR ? "MÃ QR" : "VĂN BẢN TRÍCH XUẤT OCR";
      const exportContent = `=== Snap Decode ===\nThời gian: ${timestamp}\nChế độ: ${headerTag}\n\n[NỘI DUNG]\n${decodedText}\n`;
      const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snap-decode-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      const btn = document.getElementById("snap-export-btn");
      btn.innerHTML = '<span>✅</span> Đã tải!';
      setTimeout(() => { btn.innerHTML = '<span>📤</span> Export .txt'; }, 2000);
    });

    // Resnap Event
    document.getElementById("snap-resnap-btn").addEventListener("click", () => {
      if (document.getElementById("snap-decode-popup")) {
        document.getElementById("snap-decode-popup").remove();
      }
      initSnapOverlay();
    });
  }

  function updatePopupError(errorMsg, canResnap = true) {
    const content = document.getElementById("snap-decode-content");
    if (!content) return;

    content.innerHTML = `
      <div class="snap-translate-section">
        <div class="snap-translate-label" style="color:var(--snap-danger, #d93025);">Thông Báo</div>
        <div class="snap-translate-text" style="color:var(--snap-danger-text, #ba1a1a); background:var(--snap-danger-bg, #fce8e6); border-color:var(--snap-danger-border, #fad2cf);">
          ${escapeHtml(errorMsg)}
        </div>
      </div>
      ${canResnap ? `
        <div style="text-align:center; margin-top:14px;">
          <button id="snap-error-resnap-btn" style="
            background: var(--snap-primary, #1a73e8); color: white; border: none;
            padding: 8px 18px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;
          ">🔄 Thử Snap lại</button>
        </div>
      ` : ''}
    `;

    if (canResnap) {
      document.getElementById("snap-error-resnap-btn").addEventListener("click", () => {
        if (document.getElementById("snap-decode-popup")) {
          document.getElementById("snap-decode-popup").remove();
        }
        initSnapOverlay();
      });
    }
  }

  function showOnboarding() {
    const content = document.getElementById("snap-decode-content");
    if (!content) return;

    content.innerHTML = `
      <div style="padding:4px 0;">
        <h3 style="margin:0 0 12px; font-size:15px; color:var(--snap-primary, #1a73e8);">📖 Hướng dẫn Snap Decode</h3>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; gap:10px; align-items:flex-start; padding:10px; background:var(--snap-bg-secondary, #f8f9fa); border-radius:8px;">
            <span style="font-size:18px;">🔍</span>
            <div>
              <strong style="font-size:13px;">1. Snap Trích Xuất Chữ (OCR)</strong>
              <p style="margin:4px 0 0; font-size:12px; color:var(--snap-text-secondary, #5f6368);">Nhấn phím tắt <code style="background:var(--snap-border, #dadce0); padding:1px 4px; border-radius:3px;">Alt+X</code> hoặc mở extension chọn "Snap OCR", kéo chọn vùng chứa chữ để trích xuất văn bản offline.</p>
            </div>
          </div>
          <div style="display:flex; gap:10px; align-items:flex-start; padding:10px; background:var(--snap-bg-secondary, #f8f9fa); border-radius:8px;">
            <span style="font-size:18px;">📷</span>
            <div>
              <strong style="font-size:13px;">2. Snap Quét Mã QR</strong>
              <p style="margin:4px 0 0; font-size:12px; color:var(--snap-text-secondary, #5f6368);">Mở popup chọn "Snap Đọc QR", kéo chuột bao quanh mã QR trên màn hình. Nội dung link hoặc mã token sẽ được tự động định vị và giải mã ngay lập tức.</p>
            </div>
          </div>
        </div>
        <div style="text-align:center; margin-top:14px;">
          <button id="snap-onboarding-close" style="
            background:var(--snap-primary, #1a73e8); color:white; border:none;
            padding:7px 20px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600;
          ">Đã hiểu ✓</button>
        </div>
      </div>
    `;

    document.getElementById("snap-onboarding-close").addEventListener("click", () => {
      chrome.storage.sync.set({ hasSeenOnboarding: true });
      if (document.getElementById("snap-decode-popup")) {
        document.getElementById("snap-decode-popup").remove();
      }
    });
  }

  function escapeHtml(unsafe) {
    return String(unsafe || "")
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

  // Show onboarding on first use
  chrome.storage.sync.get({ hasSeenOnboarding: false }, (data) => {
    if (!data.hasSeenOnboarding) {
      setTimeout(() => {
        createPopupContainer();
        showOnboarding();
      }, 500);
    }
  });
})();
