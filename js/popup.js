document.addEventListener("DOMContentLoaded", () => {
  // Hàm chung để phát lệnh Cắt màn hình
  function executeSnap(mode) {
    chrome.storage.sync.set({ mode: mode }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          let tab = tabs[0];
          if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
              alert("Không thể chụp ảnh trên các trang cài đặt hệ thống của trình duyệt!");
              return;
          }
          // Send start command
          chrome.tabs.sendMessage(tab.id, { action: "START_SNAP" }).catch(async () => {
            try {
              await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["css/content.css"] });
              await chrome.scripting.executeScript({ 
                target: { tabId: tab.id }, 
                files: ["lib/tesseract.min.js", "lib/jsQR.js", "js/content.js"] 
              });
              chrome.tabs.sendMessage(tab.id, { action: "START_SNAP" });
            } catch (e) {
              console.error("Popup: Failed to start snap", e);
              if (tab.url.startsWith("file://")) {
                  alert("Hãy cấp quyền 'Allow access to file URLs' trong trang quản lý Extension để chụp các file PDF ngoại tuyến nhé!");
              }
            }
          });
          
          window.close(); // Đóng popup
        }
      });
    });
  }

  document.getElementById("snap-translate-btn").addEventListener("click", () => {
    executeSnap("translate");
  });

  document.getElementById("snap-qr-btn").addEventListener("click", () => {
    executeSnap("qr");
  });

  // Mở Cài đặt
  document.getElementById("options-btn").addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('html/options.html'));
    }
  });
});
