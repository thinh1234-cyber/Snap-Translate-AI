// ═══════════════════════════════════════════════════════════
// SNAP-CONTROLLER.JS — Quản lý chụp vùng màn hình (Lazy-load)
// ═══════════════════════════════════════════════════════════

export async function startSnap(tab) {
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
    console.error("Cannot snap on browser UI pages");
    return;
  }

  await injectAndStartSnap(tab);
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
    console.log("Cannot start snap even with dynamic injection fallback: ", e);
    if (tab.url.startsWith("file://")) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "assets/icon.png",
        title: "Cấp quyền cho File PDF cục bộ",
        message: "Để Snap trên file PDF lưu trên máy (file://), hãy mở chi tiết Extension này và bật tính năng 'Allow access to file URLs'."
      });
    }
  }
}

export function registerCommandListener() {
  chrome.commands.onCommand.addListener((command) => {
    if (command === "snap-region") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          startSnap(tabs[0]);
        }
      });
    }
  });
}
