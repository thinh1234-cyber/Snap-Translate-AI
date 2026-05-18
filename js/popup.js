document.addEventListener("DOMContentLoaded", () => {
  console.log("[Popup] DOMContentLoaded fired");
  
  chrome.storage.sync.get({ theme: "light" }, (data) => {
    document.documentElement.setAttribute('data-theme', data.theme);
  });

  async function executeSnap(mode) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length > 0) {
        let tab = tabs[0];
        if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
          alert("Không thể chụp ảnh trên các trang cài đặt hệ thống của trình duyệt!");
          return;
        }
        try {
          await injectAndStartSnap(tab, mode);
        } catch (e) {
          console.error("Snap failed:", e);
        }
        window.close();
      }
    });
  }

  async function injectAndStartSnap(tab, mode) {
    console.log("[Popup] Injecting scripts for mode:", mode);
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["css/content.css"] });
      console.log("[Popup] CSS injected");
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["lib/tesseract.min.js", "lib/jsQR.js", "js/content.js"]
      });
      console.log("[Popup] Scripts injected");
      
      chrome.tabs.sendMessage(tab.id, { action: "START_SNAP", mode: mode });
      console.log("[Popup] START_SNAP message sent");
    } catch (e) {
      console.error("[Popup] Failed to inject scripts:", e);
      if (tab.url.startsWith("file://")) {
        alert("Hãy cấp quyền 'Allow access to file URLs' trong trang quản lý Extension để chụp các file PDF ngoại tuyến nhé!");
      } else {
        alert("Lỗi: Không thể khởi tạo snap. Hãy thử tải lại trang web.");
      }
    }
  }

  document.getElementById("snap-translate-btn").addEventListener("click", () => {
    console.log("[Popup] Snap Translate button clicked");
    executeSnap("translate");
  });

  document.getElementById("snap-qr-btn").addEventListener("click", () => {
    console.log("[Popup] Snap QR button clicked");
    executeSnap("qr");
  });

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
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        #snap-guide-overlay .snap-guide-container {
          background: #ffffff !important; border-radius: 16px !important;
          padding: 32px 28px 24px !important; max-width: 420px !important; width: 90% !important;
          position: relative !important; box-shadow: 0 20px 60px rgba(0,0,0,0.4) !important;
          text-align: center !important; color: #202124 !important;
        }
        #snap-guide-overlay .snap-guide-close {
          position: absolute !important; top: 12px !important; right: 14px !important;
          background: none !important; border: none !important; font-size: 22px !important;
          cursor: pointer !important; color: #5f6368 !important; padding: 4px 8px !important;
          line-height: 1 !important;
        }
        #snap-guide-overlay .snap-guide-close:hover { color: #202124 !important; }
        #snap-guide-overlay .snap-guide-icon { font-size: 48px !important; margin-bottom: 12px !important; }
        #snap-guide-overlay .snap-guide-step h3 {
          margin: 0 0 8px !important; font-size: 18px !important;
          color: #202124 !important; font-weight: 600 !important;
        }
        #snap-guide-overlay .snap-guide-step p {
          margin: 0 !important; font-size: 14px !important; line-height: 1.6 !important;
          color: #5f6368 !important;
        }
        #snap-guide-overlay .snap-guide-nav {
          display: flex !important; justify-content: space-between !important;
          align-items: center !important; margin-top: 24px !important;
        }
        #snap-guide-overlay .snap-guide-nav button {
          background: #1a73e8 !important; color: white !important; border: none !important;
          padding: 8px 16px !important; border-radius: 8px !important; cursor: pointer !important;
          font-size: 14px !important; font-weight: 500 !important;
        }
        #snap-guide-overlay .snap-guide-nav button:hover { opacity: 0.9 !important; }
        #snap-guide-overlay .snap-guide-dots { display: flex !important; gap: 8px !important; }
        #snap-guide-overlay .snap-guide-dots .dot {
          width: 10px !important; height: 10px !important; border-radius: 50% !important;
          background: #dadce0 !important; cursor: pointer !important; transition: background 0.2s !important;
        }
        #snap-guide-overlay .snap-guide-dots .dot.active { background: #1a73e8 !important; }
      </style>
      <div class="snap-guide-container">
        <button class="snap-guide-close" id="snap-guide-close">✕</button>
        <div class="snap-guide-step" data-step="1">
          <div class="snap-guide-icon">🌍</div>
          <h3>Bước 1: Snap Dịch</h3>
          <p>Nhấn <b>Alt+X</b> hoặc click nút Snap Dịch, sau đó kéo chuột chọn vùng cần dịch trên trang web.</p>
        </div>
        <div class="snap-guide-step" data-step="2" style="display:none;">
          <div class="snap-guide-icon">📷</div>
          <h3>Bước 2: Snap QR</h3>
          <p>Chọn Snap Đọc QR, kéo chuột vào mã QR trên màn hình. Kết quả sẽ hiện ngay lập tức.</p>
        </div>
        <div class="snap-guide-step" data-step="3" style="display:none;">
          <div class="snap-guide-icon">⚙️</div>
          <h3>Bước 3: Cài đặt</h3>
          <p>Mở Settings để cấu hình API, chuyên ngành, OCR, và xem lịch sử Snap.</p>
        </div>
        <div class="snap-guide-step" data-step="4" style="display:none;">
          <div class="snap-guide-icon">📋</div>
          <h3>Bước 4: Copy & Export</h3>
          <p>Sau khi dịch xong, nhấn Copy để sao chép hoặc Export để lưu file text.</p>
        </div>
        <div class="snap-guide-nav">
          <button id="snap-guide-prev" style="visibility:hidden;">← Trước</button>
          <span class="snap-guide-dots">
            <span class="dot active" data-dot="1"></span>
            <span class="dot" data-dot="2"></span>
            <span class="dot" data-dot="3"></span>
            <span class="dot" data-dot="4"></span>
          </span>
          <button id="snap-guide-next">Tiếp →</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let currentStep = 1;
    const totalSteps = 4;

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
