// ═══════════════════════════════════════════════════════════
// OCR-MANAGER.JS — Quản lý cookie manipulation & iframe prompt
// ═══════════════════════════════════════════════════════════

export async function prepChatGPTCookies(sendResponse) {
  try {
    const allCookies = await chrome.cookies.getAll({ domain: "chatgpt.com" });
    const oaiCookies = await chrome.cookies.getAll({ domain: "openai.com" });
    const cookies = [...allCookies, ...oaiCookies];

    if (!cookies.length) {
      sendResponse({ success: false, error: "Không tìm thấy cookie ChatGPT. Hãy đăng nhập chatgpt.com trước." });
      return;
    }

    const results = await Promise.allSettled(cookies.map(c => {
      const scheme = c.secure ? "https" : "http";
      const host   = c.domain.startsWith(".") ? `www${c.domain}` : c.domain;
      const url    = `${scheme}://${host}${c.path}`;

      return chrome.cookies.set({
        url,
        name:           c.name,
        value:          c.value,
        domain:         c.domain,
        path:           c.path,
        secure:         true,
        httpOnly:       c.httpOnly,
        sameSite:       "no_restriction",
        expirationDate: c.expirationDate,
        storeId:        c.storeId
      });
    }));

    const succeeded = results.filter(r => r.status === "fulfilled").length;
    console.log(`[SnapTranslate] Re-set ${succeeded}/${cookies.length} cookies → SameSite=None`);
    sendResponse({ success: true, count: succeeded });
  } catch(err) {
    sendResponse({ success: false, error: err.message });
  }
}

export async function sendPromptToIframe(ocrText, dataUrl, senderTabId, sendResponse) {
  try {
    const storageData = await chrome.storage.sync.get({
      specialty: "chung",
      autoprompt: "Ngắn gọn súc tích, không giải thích thêm."
    });
    const specialty   = storageData.specialty || "chung";
    const customRule  = storageData.autoprompt ? `\nCustom Rules: ${storageData.autoprompt}` : "";
    const promptText  = `Dịch đoạn văn bản chuyên ngành (${specialty}) sau sang tiếng Việt.${customRule}\n\n[BẢN GỐC]:\n${ocrText}`;

    await new Promise(r => setTimeout(r, 3000));

    let chatgptFrame = null;
    for (let attempt = 0; attempt < 3 && !chatgptFrame; attempt++) {
      const frames = await chrome.webNavigation.getAllFrames({ tabId: senderTabId });
      chatgptFrame  = frames?.find(f => f.url && f.url.includes("chatgpt.com") && f.frameId !== 0);
      if (!chatgptFrame) await new Promise(r => setTimeout(r, 2000));
    }

    if (!chatgptFrame) {
      if (sendResponse) sendResponse({ success: false, error: "Không tìm thấy iframe ChatGPT trong trang. Đảm bảo đã nhấn nút Dịch." });
      return;
    }

    chrome.tabs.sendMessage(
      senderTabId,
      { action: "PROCESS_TEXT", prompt: promptText },
      { frameId: chatgptFrame.frameId },
      (res) => {
        if (chrome.runtime.lastError) {
          console.warn("[SnapTranslate] Frame msg error:", chrome.runtime.lastError.message);
          return;
        }
        if (res && res.success && res.text) {
          chrome.runtime.sendMessage({
            action: "CHATGPT_RESULT_RECEIVED",
            ocrText: ocrText,
            translation: res.text
          });
        }
      }
    );

    if (sendResponse) sendResponse({ success: true });
  } catch(err) {
    if (sendResponse) sendResponse({ success: false, error: err.message });
  }
}
