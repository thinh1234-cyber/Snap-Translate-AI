// ═══════════════════════════════════════════════════════════
// DOC-INJECT.JS — Content Script Entry Point for DocUnlocker
// Bridges Chrome runtime messages with the DocUnlocker Router
// ═══════════════════════════════════════════════════════════

(() => {
  if (window.__snapDocInjectBridgeReady) return;
  window.__snapDocInjectBridgeReady = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TRIGGER_DOC_DOWNLOAD") {
      if (window.__SnapDocRouter) {
        window.__SnapDocRouter.dispatch();
        sendResponse({ status: "STARTED" });
      } else {
        sendResponse({ status: "NOT_READY" });
      }
      return true;
    }
  });
})();
