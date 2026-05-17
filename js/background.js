// ═══════════════════════════════════════════════════════════
// BACKGROUND.JS — Message Router & Orchestrator
// ═══════════════════════════════════════════════════════════

import { registerCommandListener, startSnap } from './modules/snap-controller.js';
import { handleTranslation } from './modules/translation-engine.js';
import { openChatGPTWindow } from './modules/chatgpt-bridge.js';
import { prepChatGPTCookies, sendPromptToIframe } from './modules/ocr-manager.js';
import { saveSnap, getHistory, deleteSnap, clearHistory, searchHistory } from './modules/memory-manager.js';

// ── Register command listener ─────────────────────────────
registerCommandListener();

// ── Message Router ────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "CAPTURE_SCREEN":
      chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, (dataUrl) => {
        sendResponse({ dataUrl: dataUrl });
      });
      return true;

    case "OPEN_OPTIONS":
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('html/options.html'));
      }
      return true;

    case "TRANSLATE_IMAGE":
      handleTranslation(request.dataUrl, request.ocrText, sendResponse);
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

    case "OPEN_CHATGPT_TRANSLATE":
    case "OPEN_CHATGPT_WINDOW":
      openChatGPTWindow(request.ocrText, request.dataUrl, request.winLeft, request.winTop, sendResponse);
      return true;

    case "SEND_CHATGPT_PROMPT":
      sendPromptToIframe(request.ocrText, request.dataUrl, sender.tab.id, sendResponse);
      return true;

    case "PREP_CHATGPT_IFRAME":
      prepChatGPTCookies(sendResponse);
      return true;

    default:
      return false;
  }
});
