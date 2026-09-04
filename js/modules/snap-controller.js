// ═══════════════════════════════════════════════════════════
// SNAP-CONTROLLER.JS — Quản lý chụp vùng màn hình (Lazy-load & Smart Ping)
// ═══════════════════════════════════════════════════════════

export async function startSnap(tab, mode = "ocr") {
  if (!tab || !tab.id) return;

  if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("chrome-extension://"))) {
    console.error("[SnapDecode] Cannot snap on browser UI or extension pages");
    return;
  }

  await injectAndStartSnap(tab, mode);
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
      console.log("[SnapDecode] Injecting bridge script on tab:", tab.id);
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["css/content.css"] });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["js/content.js"]
      });
    }

    chrome.tabs.sendMessage(tab.id, { action: "START_SNAP", mode: mode });
  } catch (e) {
    console.warn("[SnapDecode] Script injection failed:", e);
    if (tab.url && tab.url.startsWith("file://")) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "assets/icon.png",
        title: "Cấp quyền cho File PDF / Local",
        message: "Để Snap trên file lưu trên máy (file://), hãy mở trang chi tiết Extension và bật 'Allow access to file URLs'."
      });
    }
  }
}

export function registerCommandListener() {
  chrome.commands.onCommand.addListener((command) => {
    if (command === "snap-region" || command === "snap-ocr") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          startSnap(tabs[0], "ocr");
        }
      });
    }
  });
}
