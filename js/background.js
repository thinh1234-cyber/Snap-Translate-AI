// ═══════════════════════════════════════════════════════════
// BACKGROUND.JS — Message Router & Orchestrator
// ═══════════════════════════════════════════════════════════

import { registerCommandListener, startSnap } from './modules/snap-controller.js';
import { handleTranslation } from './modules/translation-engine.js';
import { openChatGPTWindow } from './modules/chatgpt-bridge.js';
import { prepChatGPTCookies, sendPromptToIframe } from './modules/ocr-manager.js';
import { saveSnap, getHistory, deleteSnap, clearHistory, searchHistory, setMaxEntries, getMaxEntriesSetting } from './modules/memory-manager.js';
import { saveSnapFiles, autoDeleteOldFiles, deleteSavedFile, getSavedFilesList, clearSavedFiles } from './modules/file-saver.js';

// ── Auto-delete old files on startup ──────────────────────
autoDeleteOldFiles().then(result => {
  if (result.deleted > 0) {
    console.log(`[SnapTranslate] Auto-deleted ${result.deleted} old files (>30 days). ${result.remaining} remaining.`);
  }
});

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

    case "CHATGPT_RESULT_RECEIVED":
      saveSnap({
        mode: "translate",
        ocrText: request.ocrText || "",
        translation: request.translation || "",
        sourceUrl: ""
      }).then(() => {
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

    case "SAVE_SNAP_FILES":
      saveSnapFiles(request.dataUrl, request.textContent, request.mode).then(results => {
        sendResponse(results);
      });
      return true;

    case "GET_SAVED_FILES":
      getSavedFilesList().then(files => {
        sendResponse(files);
      });
      return true;

    case "DELETE_SAVED_FILE":
      deleteSavedFile(request.id).then(files => {
        sendResponse({ success: true, count: files.length });
      });
      return true;

    case "CLEAR_SAVED_FILES":
      clearSavedFiles().then(() => {
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
