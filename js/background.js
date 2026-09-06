// ═══════════════════════════════════════════════════════════
// BACKGROUND.JS — Message Router & Orchestrator (Snap Decode)
// Supports Native Messaging (Auto-start & Auto-shutdown) + HTTP Fallback
// ═══════════════════════════════════════════════════════════

import { registerCommandListener } from './modules/snap-controller.js';
import {
  saveSnap,
  getHistory,
  deleteSnap,
  clearHistory,
  searchHistory,
  setMaxEntries,
  getMaxEntriesSetting
} from './modules/memory-manager.js';

// ── Register command listener (Alt+X) ─────────────────────
registerCommandListener();

const NATIVE_HOST_NAME = "com.kyle.snap_decode";

function fallbackToHttp(payload, sendResponse) {
  fetch("http://127.0.0.1:8765/api/decode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(r => r.json())
  .then(data => sendResponse(data))
  .catch(() => {
    sendResponse({
      success: false,
      error: "⚠️ Chưa kích hoạt Backend tự động.\n\n👉 Nhấp đúp file setup_auto_backend.bat (chỉ cần chạy 1 lần duy nhất) để Extension tự khởi động & tắt ngầm Backend khi snap!"
    });
  });
}

// ── Message Router ────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "CAPTURE_SCREEN": {
      const windowId = sender.tab ? sender.tab.windowId : null;
      chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          const errMsg = chrome.runtime.lastError?.message || "Không thể chụp màn hình tab hiện tại.";
          console.error("[SnapDecode SW] Capture failed:", errMsg);
          sendResponse({ dataUrl: null, error: errMsg });
        } else {
          sendResponse({ dataUrl: dataUrl });
        }
      });
      return true;
    }

    case "DECODE_IMAGE": {
      const payload = {
        mode: request.mode,
        image: request.image
      };

      // 1. Try Native Messaging first (Auto-start & Auto-shutdown managed by Chrome)
      try {
        chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, payload, (nativeResp) => {
          if (!chrome.runtime.lastError && nativeResp) {
            sendResponse(nativeResp);
          } else {
            // 2. Fallback to local HTTP backend if Native Host is not registered
            fallbackToHttp(payload, sendResponse);
          }
        });
      } catch (e) {
        fallbackToHttp(payload, sendResponse);
      }
      return true;
    }

    case "START_DOC_DOWNLOAD": {
      const tab = request.tab;
      if (!tab || !tab.url) {
        sendResponse({ success: false, error: "Không tìm thấy thông tin tab." });
        return true;
      }

      const url = tab.url;
      if (url.includes("scribd.com")) {
        const match = url.match(/\/(?:document|doc)\/(\d+)/);
        if (match && !url.includes("/embeds/")) {
          const docId = match[1];
          const embedUrl = `https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll#snap_autodownload=1`;
          chrome.tabs.create({ url: embedUrl });
          sendResponse({ success: true, redirect: true });
        } else {
          chrome.tabs.sendMessage(tab.id, { action: "TRIGGER_DOC_DOWNLOAD" }, () => {
            sendResponse({ success: true });
          });
        }
      } else if (url.includes("studocu.com") || url.includes("studocu.vn") || url.includes("slideshare.net")) {
        chrome.tabs.sendMessage(tab.id, { action: "TRIGGER_DOC_DOWNLOAD" }, () => {
          sendResponse({ success: true });
        });
      } else {
        sendResponse({
          success: false,
          error: "Trang hiện tại không phải Scribd, StuDocu hoặc SlideShare!\nHãy mở trang tài liệu cần tải trước."
        });
      }
      return true;
    }

    case "OPEN_OPTIONS":
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('html/options.html'));
      }
      return true;

    case "SAVE_SNAP":
      saveSnap(request.entry).then(history => {
        sendResponse({ success: true, count: history.length });
      });
      return true;

    case "GET_SNAP_HISTORY":
      getHistory().then(history => {
        sendResponse(history);
      });
      return true;

    case "SEARCH_SNAP_HISTORY":
      searchHistory(request.query).then(results => {
        sendResponse(results);
      });
      return true;

    case "DELETE_SNAP":
      deleteSnap(request.id).then(history => {
        sendResponse({ success: true, count: history.length });
      });
      return true;

    case "CLEAR_HISTORY":
      clearHistory().then(() => {
        sendResponse({ success: true });
      });
      return true;

    case "SET_MEMORY_LIMIT":
      setMaxEntries(request.limit).then(newLimit => {
        sendResponse({ success: true, limit: newLimit });
      });
      return true;

    case "GET_MEMORY_LIMIT":
      getMaxEntriesSetting().then(limit => {
        sendResponse(limit);
      });
      return true;

    default:
      return false;
  }
});
