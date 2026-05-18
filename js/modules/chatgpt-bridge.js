// ═══════════════════════════════════════════════════════════
// CHATGPT-BRIDGE.JS — Quản lý cửa sổ/popup ChatGPT
// ═══════════════════════════════════════════════════════════

export async function openChatGPTWindow(ocrText, dataUrl, winLeft, winTop, sendResponse) {
  try {
    const storageData = await chrome.storage.sync.get({
      specialty: "chung",
      autoprompt: "Ngắn gọn súc tích, không giải thích thêm."
    });

    const specialty = storageData.specialty || "chung";
    const customRule = storageData.autoprompt ? `\nCustom Rules: ${storageData.autoprompt}` : "";
    const promptText = `Dịch đoạn văn bản chuyên ngành (${specialty}) sau sang tiếng Việt.${customRule}\n\n[BẢN GỐC]:\n${ocrText}`;

    const WIN_W = 480;
    const WIN_H = 540;

    const [currentWindow] = await chrome.windows.getAll({ populate: false })
      .then(wins => wins.filter(w => w.focused));
    const originalWinId = currentWindow?.id;

    let targetTabId = null;
    let targetWinId = null;
    const existingTabs = await chrome.tabs.query({ url: "*://chatgpt.com/*" });
    for (const t of existingTabs) {
      const win = await chrome.windows.get(t.windowId);
      if (win.type === "popup" && win.width <= 600) {
        targetTabId = t.id;
        targetWinId = t.windowId;
        break;
      }
    }

    if (targetWinId) {
      await chrome.windows.update(targetWinId, {
        left: winLeft || 20,
        top:  winTop  || 100,
        focused: true
      });
    } else {
      const newWin = await chrome.windows.create({
        url:    "https://chatgpt.com/",
        type:   "popup",
        width:  WIN_W,
        height: WIN_H,
        left:   winLeft || 20,
        top:    winTop  || 100,
        focused: true
      });
      targetTabId = newWin.tabs[0].id;
      targetWinId = newWin.id;

      await new Promise((resolve) => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === targetTabId && info.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            setTimeout(resolve, 2500);
          }
        });
      });
    }

    if (originalWinId) {
      await chrome.windows.update(originalWinId, { focused: true });
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        files: ["js/chatgpt_automator.js"]
      });
    } catch(e) { /* Đã inject — OK */ }

    await new Promise(r => setTimeout(r, 500));

    sendResponse({ success: true });

    chrome.tabs.sendMessage(targetTabId, {
      action: "PROCESS_TEXT",
      prompt: promptText
    }, (res) => {
      if (chrome.runtime.lastError) {
        console.warn("[SnapTranslate] ChatGPT window msg error:", chrome.runtime.lastError.message);
      }
    });

  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}
