document.addEventListener("DOMContentLoaded", () => {
  // Apply theme
  chrome.storage.sync.get({ theme: "light" }, (data) => {
    document.documentElement.setAttribute('data-theme', data.theme);
  });

  function executeSnap(mode) {
    chrome.storage.sync.set({ mode: mode }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          let tab = tabs[0];
          if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
            alert("Không thể chụp ảnh trên các trang cài đặt hệ thống của trình duyệt!");
            return;
          }
          injectAndStartSnap(tab);
          window.close();
        }
      });
    });
  }

  async function injectAndStartSnap(tab) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["css/content.css"] });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["lib/tesseract.min.js", "lib/jsQR.js", "js/content.js"]
      });
      chrome.tabs.sendMessage(tab.id, { action: "START_SNAP" });
    } catch (e) {
      console.error("Popup: Failed to inject scripts", e);
      if (tab.url.startsWith("file://")) {
        alert("Hãy cấp quyền 'Allow access to file URLs' trong trang quản lý Extension để chụp các file PDF ngoại tuyến nhé!");
      }
    }
  }

  document.getElementById("snap-translate-btn").addEventListener("click", () => {
    executeSnap("translate");
  });

  document.getElementById("snap-qr-btn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "CAPTURE_SCREEN", mode: "qr" });
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
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.7); z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Segoe UI', sans-serif;
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
