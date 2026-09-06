document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get({ theme: "light" }, (data) => {
    document.documentElement.setAttribute('data-theme', data.theme);
  });

  async function executeSnap(mode) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length > 0) {
        let tab = tabs[0];
        if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("chrome-extension://")) {
          alert("Không thể chụp trên các trang cài đặt hệ thống của trình duyệt!");
          return;
        }
        try {
          await injectAndStartSnap(tab, mode);
        } catch (e) {
          console.error("[SnapDecode Popup] Snap failed:", e);
        }
        window.close();
      }
    });
  }

  async function isContentScriptReady(tabId) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { action: "PING" }, (response) => {
        if (chrome.runtime.lastError || !response || response.status !== "PONG") {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async function injectAndStartSnap(tab, mode) {
    try {
      const ready = await isContentScriptReady(tab.id);

      if (!ready) {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["css/content.css"] });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["js/content.js"]
        });
      }

      chrome.tabs.sendMessage(tab.id, { action: "START_SNAP", mode: mode });
    } catch (e) {
      console.error("[SnapDecode Popup] Failed to start snap:", e);
      if (tab.url.startsWith("file://")) {
        alert("Hãy cấp quyền 'Allow access to file URLs' trong trang quản lý Extension để chụp các file lưu trên máy nhé!");
      } else {
        alert("Lỗi: Không thể khởi tạo snap trên trang này. Hãy thử tải lại trang web.");
      }
    }
  }

  const qrBtn = document.getElementById("snap-qr-btn");
  if (qrBtn) {
    qrBtn.addEventListener("click", () => {
      executeSnap("qr");
    });
  }

  const docsBtn = document.getElementById("docs-download-btn");
  if (docsBtn) {
    docsBtn.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.runtime.sendMessage({ action: "START_DOC_DOWNLOAD", tab: tabs[0] }, (resp) => {
            if (resp && resp.error) {
              alert(resp.error);
            } else {
              window.close();
            }
          });
        }
      });
    });
  }

  document.getElementById("options-btn").addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('html/options.html'));
    }
  });

  document.getElementById("guide-btn").addEventListener("click", () => {
    showGuideOverlay();
  });

  function showGuideOverlay() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: injectGuide
        });
      }
    });
    window.close();
  }

  function injectGuide() {
    if (document.getElementById("snap-guide-overlay")) {
      document.getElementById("snap-guide-overlay").remove();
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "snap-guide-overlay";
    overlay.innerHTML = `
      <style>
        #snap-guide-overlay {
          position: fixed !important; top: 0 !important; left: 0 !important;
          width: 100vw !important; height: 100vh !important;
          background: rgba(0,0,0,0.75) !important; z-index: 2147483647 !important;
          display: flex !important; align-items: center !important; justify-content: center !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
        #snap-guide-overlay .snap-guide-container {
          background: #ffffff !important; border-radius: 16px !important;
          padding: 30px 24px 20px !important; max-width: 400px !important; width: 90% !important;
          position: relative !important; box-shadow: 0 20px 60px rgba(0,0,0,0.4) !important;
          text-align: center !important; color: #202124 !important;
        }
        #snap-guide-overlay .snap-guide-close {
          position: absolute !important; top: 12px !important; right: 14px !important;
          background: none !important; border: none !important; font-size: 22px !important;
          cursor: pointer !important; color: #5f6368 !important; padding: 4px 8px !important;
        }
        #snap-guide-overlay .snap-guide-icon { font-size: 44px !important; margin-bottom: 12px !important; }
        #snap-guide-overlay .snap-guide-step h3 {
          margin: 0 0 8px !important; font-size: 17px !important; color: #202124 !important; font-weight: 600 !important;
        }
        #snap-guide-overlay .snap-guide-step p {
          margin: 0 !important; font-size: 13px !important; line-height: 1.6 !important; color: #5f6368 !important;
        }
        #snap-guide-overlay .snap-guide-nav {
          display: flex !important; justify-content: space-between !important;
          align-items: center !important; margin-top: 22px !important;
        }
        #snap-guide-overlay .snap-guide-nav button {
          background: #1a73e8 !important; color: white !important; border: none !important;
          padding: 8px 16px !important; border-radius: 8px !important; cursor: pointer !important;
          font-size: 13px !important; font-weight: 500 !important;
        }
        #snap-guide-overlay .snap-guide-dots { display: flex !important; gap: 8px !important; }
        #snap-guide-overlay .snap-guide-dots .dot {
          width: 9px !important; height: 9px !important; border-radius: 50% !important;
          background: #dadce0 !important; cursor: pointer !important;
        }
        #snap-guide-overlay .snap-guide-dots .dot.active { background: #1a73e8 !important; }
      </style>
      <div class="snap-guide-container">
        <button class="snap-guide-close" id="snap-guide-close">✕</button>
        <div class="snap-guide-step" data-step="1">
          <div class="snap-guide-icon">📷</div>
          <h3>Bước 1: Snap Quét Mã QR</h3>
          <p>Nhấn <b>Alt+X</b> hoặc click nút Snap Quét QR, sau đó kéo chuột chọn vùng chứa mã QR để giải mã tức thì.</p>
        </div>
        <div class="snap-guide-step" data-step="2" style="display:none;">
          <div class="snap-guide-icon">📄</div>
          <h3>Bước 2: Mở Khóa Tài Liệu Scribd / StuDocu</h3>
          <p>Khi ở trang tài liệu Scribd hoặc StuDocu bị khóa/làm mờ, click nút <b>Tải Tài Liệu</b> để tự động mở khóa và xuất file PDF.</p>
        </div>
        <div class="snap-guide-step" data-step="3" style="display:none;">
          <div class="snap-guide-icon">📋</div>
          <h3>Bước 3: Copy, Xuất File & Xem Lịch Sử</h3>
          <p>Nhấn <b>Copy</b> hoặc <b>Export .txt</b> ngay tại popup kết quả. Mở mục Cài đặt để quản lý lịch sử quét.</p>
        </div>
        <div class="snap-guide-nav">
          <button id="snap-guide-prev" style="visibility:hidden;">← Trước</button>
          <span class="snap-guide-dots">
            <span class="dot active" data-dot="1"></span>
            <span class="dot" data-dot="2"></span>
            <span class="dot" data-dot="3"></span>
          </span>
          <button id="snap-guide-next">Tiếp →</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let currentStep = 1;
    const totalSteps = 3;

    function showStep(step) {
      overlay.querySelectorAll(".snap-guide-step").forEach(s => s.style.display = "none");
      overlay.querySelector(`.snap-guide-step[data-step="${step}"]`).style.display = "block";
      overlay.querySelectorAll(".dot").forEach(d => d.classList.toggle("active", d.dataset.dot == step));
      document.getElementById("snap-guide-prev").style.visibility = step === 1 ? "hidden" : "visible";
      document.getElementById("snap-guide-next").textContent = step === totalSteps ? "✓ Xong" : "Tiếp →";
    }

    document.getElementById("snap-guide-close").addEventListener("click", () => overlay.remove());
    document.getElementById("snap-guide-next").addEventListener("click", () => {
      if (currentStep >= totalSteps) { overlay.remove(); return; }
      currentStep++;
      showStep(currentStep);
    });
    document.getElementById("snap-guide-prev").addEventListener("click", () => {
      if (currentStep <= 1) return;
      currentStep--;
      showStep(currentStep);
    });
    overlay.querySelectorAll(".dot").forEach(dot => {
      dot.addEventListener("click", () => {
        currentStep = parseInt(dot.dataset.dot);
        showStep(currentStep);
      });
    });
  }
});
