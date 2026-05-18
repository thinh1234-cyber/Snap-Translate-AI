---
component_id: 2.2
component_name: AI Gateway & Translation Engine
---

# AI Gateway & Translation Engine

## Component Description

A unified interface for AI processing that combines business logic for translation with the technical implementation of API communication. It prepares prompts based on user settings, manages cross-origin fetch requests to OpenAI or local providers, and parses structured responses for the UI.

---

## Key References:

### d:\trans extension\js\background.js (lines 167-200)
```
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
```

### d:\trans extension\js\background.js (lines 202-263)
```
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
```


## Source Files:

- `js\background.js`

