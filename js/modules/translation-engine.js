// ═══════════════════════════════════════════════════════════
// TRANSLATION-ENGINE.JS — Xử lý dịch thuật qua API
// ═══════════════════════════════════════════════════════════

export async function handleTranslation(base64Image, ocrText, sendResponse) {
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
    const channel = storageData.aiChannel || "web";

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

export async function translateViaOpenAIApi(base64Image, ocrText, promptText, config, sendResponse) {
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

export async function translateViaWebAuth(base64Image, ocrText, promptText, sendResponse) {
  try {
    let targetTabId;

    const tabs = await chrome.tabs.query({ url: "*://chatgpt.com/*" });
    let botTab = tabs.find(t => t.pinned);

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
      const newTab = await chrome.tabs.create({
        url: "https://chatgpt.com/",
        active: false,
        pinned: true
      });
      targetTabId = newTab.id;

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

    let attempts = 0;
    let success = false;

    while (attempts < 3 && !success) {
      attempts++;
      try {
        const response = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(targetTabId, {
            action: ocrText ? "PROCESS_TEXT" : "PROCESS_VISION",
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
