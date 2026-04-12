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
});

async function handleTranslation(base64Image, ocrText, sendResponse) {
  try {
    const storageData = await chrome.storage.sync.get([
      "specialty", "autoprompt", "aiChannel", "apiUrl", "apiModel", "apiKey"
    ]);
    
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
    
    // Ưu tiên tìm Tab ChatGPT đang nằm trong cửa sổ thu nhỏ (Cửa sổ rác chạy ngầm của extension)
    let botTab = null;
    for (let t of tabs) {
      const win = await chrome.windows.get(t.windowId);
      if (win.state === "minimized" || win.type === "popup") {
        botTab = t;
        break;
      }
    }

    // Nếu không có cửa sổ ngầm, lấy đại tab ChatGPT đang mở, nếu không có thì tạo cửa sổ ngầm mới.
    if (botTab) {
      targetTabId = botTab.id;
      if (botTab.discarded) {
        await chrome.tabs.reload(targetTabId);
        await new Promise(r => setTimeout(r, 2000));
      }
    } else if (tabs.length > 0) {
      targetTabId = tabs[0].id;
      if (tabs[0].discarded) {
         await chrome.tabs.reload(targetTabId);
         await new Promise(r => setTimeout(r, 2000));
      }
    } else {
      isNewTab = true;
      // Trọng tâm: Tạo cửa sổ mới thu nhỏ hoàn toàn (chạy nền) thay vì tab ghim
      const newWin = await chrome.windows.create({ 
        url: "https://chatgpt.com/", 
        type: "popup", 
        state: "minimized" 
      });
      targetTabId = newWin.tabs[0].id;
      
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
