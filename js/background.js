// Function: Start Snap
chrome.commands.onCommand.addListener((command) => {
  if (command === "snap-region") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        startSnap(tabs[0]);
      }
    });
  }
});

// (Action click đã được chuyển sang giao diện thay vì trigger bằng click thẳng)

async function startSnap(tab) {
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
    console.error("Cannot snap on browser UI pages");
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: "START_SNAP" }).catch(async () => {
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
  });
}

// Background Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "CAPTURE_SCREEN") {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, (dataUrl) => {
      sendResponse({ dataUrl: dataUrl });
    });
    return true;
  }

  if (request.action === "OPEN_OPTIONS") {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('html/options.html'));
    }
    return true;
  }

  if (request.action === "TRANSLATE_IMAGE") {
    handleTranslation(request.dataUrl, request.ocrText, sendResponse);
    return true;
  }

  if (request.action === "OPEN_CHATGPT_TRANSLATE" || request.action === "OPEN_CHATGPT_WINDOW") {
    openChatGPTWindow(request.ocrText, request.dataUrl, request.winLeft, request.winTop, sendResponse);
    return true;
  }

  if (request.action === "SEND_CHATGPT_PROMPT") {
    sendPromptToIframe(request.ocrText, request.dataUrl, sender.tab.id, sendResponse);
    return true;
  }
  if (request.action === "PREP_CHATGPT_IFRAME") {
    prepChatGPTCookies(sendResponse);
    return true;
  }
});

// Đọc toàn bộ cookies chatgpt.com và re-set thành SameSite=None để iframe nhận được session
async function prepChatGPTCookies(sendResponse) {
  try {
    const allCookies = await chrome.cookies.getAll({ domain: "chatgpt.com" });
    const oaiCookies = await chrome.cookies.getAll({ domain: "openai.com" });
    const cookies = [...allCookies, ...oaiCookies];

    if (!cookies.length) {
      sendResponse({ success: false, error: "Không tìm thấy cookie ChatGPT. Hãy đăng nhập chatgpt.com trước." });
      return;
    }

    const results = await Promise.allSettled(cookies.map(c => {
      // Xây dựng URL đúng chuẩn để set cookie
      const scheme = c.secure ? "https" : "http";
      const host   = c.domain.startsWith(".") ? `www${c.domain}` : c.domain;
      const url    = `${scheme}://${host}${c.path}`;

      return chrome.cookies.set({
        url,
        name:           c.name,
        value:          c.value,
        domain:         c.domain,
        path:           c.path,
        secure:         true,           // SameSite=None phải có Secure
        httpOnly:       c.httpOnly,
        sameSite:       "no_restriction", // SameSite=None → được gửi trong iframe cross-origin
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


async function sendPromptToIframe(ocrText, dataUrl, senderTabId, sendResponse) {
  try {
    const storageData = await chrome.storage.sync.get({
      specialty: "chung",
      autoprompt: "Ngắn gọn súc tích, không giải thích thêm."
    });
    const specialty   = storageData.specialty || "chung";
    const customRule  = storageData.autoprompt ? `\nCustom Rules: ${storageData.autoprompt}` : "";
    const promptText  = `Dịch đoạn văn bản chuyên ngành (${specialty}) sau sang tiếng Việt.${customRule}\n\n[BẢN GỐC]:\n${ocrText}`;

    // Chờ React mount trong iframe (iframe.onload chỉ báo HTML done, chưa phải React done)
    await new Promise(r => setTimeout(r, 3000));

    // Tìm frame chatgpt.com trong tab người dùng (retry tối đa 3 lần × 2s)
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

    // KHÔNG inject lại — all_frames:true đã làm điều này tại document_start
    // Chỉ gửi message thẳng vào đúng frame
    chrome.tabs.sendMessage(
      senderTabId,
      { action: "PROCESS_TEXT", prompt: promptText },
      { frameId: chatgptFrame.frameId },
      (res) => {
        if (chrome.runtime.lastError) {
          console.warn("[SnapTranslate] Frame msg error:", chrome.runtime.lastError.message);
        }
      }
    );

    if (sendResponse) sendResponse({ success: true });
  } catch(err) {
    if (sendResponse) sendResponse({ success: false, error: err.message });
  }
}


async function handleTranslation(base64Image, ocrText, sendResponse) {
  try {
    const storageData = await chrome.storage.sync.get({
      specialty: "",
      autoprompt: "Ngắn gọn súc tích, không giải thích thêm.",
      aiChannel: "web",
      apiUrl: "",
      apiModel: "",
      apiKey: ""
    });
    
    const specialty = storageData.specialty || "chung";
    const customInstruction = storageData.autoprompt ? `\nCustom Rules: ${storageData.autoprompt}` : "";
    const channel = storageData.aiChannel || "web"; // Default
    
    let promptText = "";
    if (ocrText) {
      promptText = `Dịch đoạn văn bản chuyên ngành (${specialty}) sau sang tiếng Việt.\n${customInstruction}\n\n[BẢN GỐC]:\n${ocrText}`;
    } else {
      promptText = `Bóc tách văn bản trong ảnh và dịch sang tiếng Việt. (Dịch sát theo ngữ cảnh chuyên môn: ${specialty}).\n${customInstruction}`;
    }

    if (channel === "web") {
      await translateViaWebAuth(base64Image, ocrText, promptText, sendResponse);
    } else if (channel === "api_server" || channel === "api_local") {
      await translateViaOpenAIApi(base64Image, ocrText, promptText, storageData, sendResponse);
    } else {
      sendResponse({ success: false, error: "Kênh AI không hợp lệ." });
    }

  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function translateViaOpenAIApi(base64Image, ocrText, promptText, config, sendResponse) {
  try {
    if (!config.apiUrl || !config.apiModel) {
      return sendResponse({ success: false, error: "Chưa cấu hình API URL hoặc Tên Model. Vui lòng mở Cài đặt." });
    }

    let messages = [];
    
    if (ocrText) {
       messages = [
         { role: "system", content: "Bạn là một AI dịch thuật chuyên nghiệp." },
         { role: "user", content: promptText }
       ];
    } else {
       // Support Local Vision model format (OpenAI compatibility standard format)
       messages = [
         {
           role: "user",
           content: [
             { type: "text", text: promptText },
             { type: "image_url", image_url: { url: base64Image } }
           ]
         }
       ];
    }

    const payload = {
      model: config.apiModel,
      messages: messages,
      temperature: 0.2
    };

    const headers = { "Content-Type": "application/json" };
    if (config.aiChannel === "api_server" && config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
       const err = await response.text();
       throw new Error(`Mã lỗi [${response.status}]: ${err}`);
    }

    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
       return sendResponse({
         success: true,
         translation: data.choices[0].message.content.trim()
       });
    } else {
       throw new Error("API trả về dữ liệu không hợp lệ (Không có choices).");
    }

  } catch (e) {
    sendResponse({ success: false, error: `Lỗi kết nối API: ${e.message}` });
  }
}

async function translateViaWebAuth(base64Image, ocrText, promptText, sendResponse) {
  try {
    let targetTabId;
    let isNewTab = false;

    // Lấy TẤT CẢ các tab trùng url trên TẤT CẢ window
    const tabs = await chrome.tabs.query({ url: "*://chatgpt.com/*" });
    
    // Ưu tiên tìm Tab ChatGPT ở dạng ghim (Pinned) chạy ngầm
    let botTab = tabs.find(t => t.pinned);

    // Nếu không có, lấy đại thẻ ChatGPT bất kỳ đang mở
    if (!botTab && tabs.length > 0) {
      botTab = tabs[0];
    }

    if (botTab) {
      targetTabId = botTab.id;
      if (botTab.discarded) {
        await chrome.tabs.reload(targetTabId);
        await new Promise(r => setTimeout(r, 2000));
      }
    } else {
      isNewTab = true;
      // Trọng tâm giải quyết: Pinned Tab hoạt động ngầm (Chống Sleep qua autoDiscardable)
      const newTab = await chrome.tabs.create({ 
        url: "https://chatgpt.com/", 
        active: false,
        pinned: true
      });
      targetTabId = newTab.id;
      
      // Khóa tab này để hệ điều hành không bao giờ ép nó ngủ (Suspend/Hibernate)
      await chrome.tabs.update(targetTabId, { autoDiscardable: false });
      
      await new Promise((resolve) => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === targetTabId && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            setTimeout(resolve, 2000);
          }
        });
      });
    }

    // Logic thử gửi tin nhắn tối đa 3 lần
    let attempts = 0;
    let success = false;

    while (attempts < 3 && !success) {
      attempts++;
      try {
        const response = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(targetTabId, {
            action: ocrText ? "PROCESS_TEXT" : "PROCESS_VISION", // Phân luồng cho Bot ở trang ChatGPT
            dataUrl: base64Image,
            ocrText: ocrText,
            prompt: promptText
          }, (res) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(res);
            }
          });
        });

        success = true;
        
        if (response && response.success) {
          return sendResponse({
            success: true,
            translation: response.text.trim()
          });
        } else {
          return sendResponse({ success: false, error: response?.error || "Lỗi không xác định từ ChatGPT Automator" });
        }
        
      } catch (err) {
        console.log(`Lỗi kết nối tab ChatGPT ở lần thử ${attempts}:`, err.message);
        if (attempts < 3) {
          if (attempts === 2) {
            try {
              await chrome.scripting.executeScript({ target: { tabId: targetTabId }, files: ["js/chatgpt_automator.js"] });
            } catch(e) {}
          }
          await new Promise(r => setTimeout(r, 1500));
        } else {
          return sendResponse({ success: false, error: "Content script trên tab ChatGPT chưa phản hồi sau 3 lần thử. Vui lòng thử lại hoặc tải lại tab ChatGPT." });
        }
      }
    }
  } catch (err) {
      sendResponse({ success: false, error: err.message });
  }
}

// Mở/tái dùng cửa sổ popup ChatGPT nhỏ, auto-gửi prompt ngay
async function openChatGPTWindow(ocrText, dataUrl, winLeft, winTop, sendResponse) {
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

    // Ghi lại cửa sổ đang active để trả focus sau
    const [currentWindow] = await chrome.windows.getAll({ populate: false })
      .then(wins => wins.filter(w => w.focused));
    const originalWinId = currentWindow?.id;

    // Tìm cửa sổ popup ChatGPT nhỏ đã tạo trước đó (tái sử dụng)
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
      // Di chuyển cửa sổ cũ đến đúng vị trí và đưa lên trước
      await chrome.windows.update(targetWinId, {
        left: winLeft || 20,
        top:  winTop  || 100,
        focused: true // focus để React không bị throttle
      });
    } else {
      // Tạo cửa sổ popup mới — PHẢI focused: true để ChatGPT load đúng
      const newWin = await chrome.windows.create({
        url:    "https://chatgpt.com/",
        type:   "popup",
        width:  WIN_W,
        height: WIN_H,
        left:   winLeft || 20,
        top:    winTop  || 100,
        focused: true  // Cần thiết để React mount & render đầy đủ
      });
      targetTabId = newWin.tabs[0].id;
      targetWinId = newWin.id;

      // Chờ ChatGPT load + React mount xong
      await new Promise((resolve) => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === targetTabId && info.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            setTimeout(resolve, 2500); // React cần ~2s để mount giao diện
          }
        });
      });
    }

    // Trả focus về cửa sổ gốc ngay — người dùng không bị mất focus lâu
    if (originalWinId) {
      await chrome.windows.update(originalWinId, { focused: true });
    }

    // Cắm automator vào cửa sổ ChatGPT
    try {
      await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        files: ["js/chatgpt_automator.js"]
      });
    } catch(e) { /* Đã inject — OK */ }

    await new Promise(r => setTimeout(r, 500));

    // Báo content.js ngay: cửa sổ đã sẵn sàng
    sendResponse({ success: true });

    // Gửi prompt vào nền — ChatGPT sẽ tự gõ và trả lời trong cửa sổ popup
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
