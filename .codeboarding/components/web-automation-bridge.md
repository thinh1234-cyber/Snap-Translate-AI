---
component_id: 4
component_name: Web Automation Bridge
---

# Web Automation Bridge

## Component Description

A specialized component that automates the ChatGPT web interface. It acts as an alternative to direct API calls, simulating user interaction to input text and extract AI-generated translations directly from the browser DOM.

---

## Key References:

### d:\trans extension\js\chatgpt_automator.js (lines 51-108)
```
async function executeAutomation(base64Data, promptText) {
  // 1. Chờ khung chat xuất hiện (Dùng setInterval siêu nhẹ 300ms thay vì MutationObserver)
  const textArea = await waitForElementLightweight('#prompt-textarea', 15000);
  if (!textArea) throw new Error("Không tìm thấy khung chat trên trang ChatGPT.");

  // CHỜ QUAN TRỌNG: Đợi thêm 1s sau khi DOM xuất hiện để React bind xong sự kiện onPaste.
  // Nếu gửi event ngay lập tức, React có thể bỏ qua lệnh Paste khiến hệ thống bị treo chờ nút Gửi.
  await new Promise(r => setTimeout(r, 1000));

  // 2. Chèn chữ (bỏ qua mô phỏng Paste event vì ProseMirror kiểm tra event.isTrusted)
  textArea.focus();
  const textInserted = document.execCommand('insertText', false, promptText);
  if (!textInserted) {
    // Fallback nếu execCommand bị chặn
    textArea.innerText = promptText;
    textArea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 3. Nếu có ảnh, đưa trực tiếp vào thẻ <input type="file">
  if (base64Data) {
    try {
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        const blob = await (await fetch(base64Data)).blob();
        const file = new File([blob], "snap-image.png", { type: "image/png" });
        const dt = new DataTransfer();
        dt.items.add(file);
        
        // Gán file vào input HTML và bắn sự kiện thay đổi
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        console.warn("[SnapTranslate] Không tìm thấy nút đính kèm ảnh trên giao diện ChatGPT.");
      }
    } catch (e) {
      console.error("[SnapTranslate] Lỗi gửi file ảnh:", e);
    }
  }

  // 4. Đợi nút Gửi có thể bấm được (Chờ tải ảnh)
  let sendBtn = await waitForSendButtonActive(15000);
  if (!sendBtn) {
    throw new Error("Quá thời gian: Nút gửi bị khóa vì quá trình nạp dữ liệu (ảnh/text) chưa hoàn tất.");
  }
  
  // 4. Lấy số lượng thẻ chat ban đầu
  const MSG_SELECTOR = '[data-message-author-role="assistant"]';
  const initialMsgCount = document.querySelectorAll(MSG_SELECTOR).length;

  sendBtn.click();

  // 5. Ngủ đông 2 giây để giao diện ChatGPT có thời gian đổi Nút Send thành Nút Stop
  await new Promise(r => setTimeout(r, 2000));

  // 6. Theo dõi chu kỳ sống của Nút Gửi để báo "Xong"
  const responseText = await observeResponseLifecycle(initialMsgCount, MSG_SELECTOR);
  return responseText;
}
```

### d:\trans extension\js\chatgpt_automator.js (lines 149-208)
```
function observeResponseLifecycle(initialCount, MSG_SELECTOR) {
  return new Promise((resolve, reject) => {
    let checkInterval;
    let fallbackTimeout;

    // Polling siêu nhẹ cứ 500ms một lần
    checkInterval = setInterval(() => {
      // Logic Lõi: KHI NÀO NÚT STOP BIẾN MẤT VÀ CÓ TIN NHẮN MỚI XUẤT HIỆN -> CHATGPT ĐÃ NGHỈ TAY
      const stopBtn = document.querySelector('[data-testid="stop-button"]');
      const msgs = document.querySelectorAll(MSG_SELECTOR);
      
      // Không còn nút Dừng và đã có thẻ tin nhắn mới trả về
      // (Không dùng nút Send làm dấu hiệu nữa vì ChatGPT có thể biến nút Send thành nút Microphone)
      if (!stopBtn && msgs.length > initialCount) {
        clearInterval(checkInterval);
        clearTimeout(fallbackTimeout);

        // Chờ và Check liên tục tối đa 5 giây cho đến khi text xuất hiện trong DOM
        let checks = 0;
        const textCheckInterval = setInterval(() => {
            // Liên tục bắn tín hiệu giả lập Focus để chọc React render UI dù tab đang bị ẩn
            try { 
               window.dispatchEvent(new Event('focus')); 
               document.dispatchEvent(new Event('visibilitychange')); 
            } catch(e) {}

            checks++;
            const currentMsgs = document.querySelectorAll(MSG_SELECTOR);
            const lastMsg = currentMsgs[currentMsgs.length - 1];
            
            if (!lastMsg) {
              if (checks > 10) {
                 clearInterval(textCheckInterval);
                 return reject(new Error("ChatGPT đã dừng nhưng không tìm thấy tin nhắn trả về."));
              }
              return;
            }

            const pureMarkdown = lastMsg.querySelector('.markdown');
            const text = pureMarkdown ? pureMarkdown.innerText.trim() : lastMsg.innerText.trim();
            
            if (text.length > 0) {
              clearInterval(textCheckInterval);
              resolve(text);
            } else if (checks > 10) { // Timeout 5 giây
              clearInterval(textCheckInterval);
              reject(new Error("Lỗi: Không thể trích xuất đoạn văn từ mã nguồn của ChatGPT. Khung DOM có thể đang bị rỗng."));
            }
        }, 500);
      }
    }, 500);

    // Timeout bảo vệ vĩnh viễn (90s)
    fallbackTimeout = setTimeout(() => {
      clearInterval(checkInterval);
      isAutomating = false;
      reject(new Error("Hết thời gian chờ 90s do đứt cáp Internet hoặc ChatGPT bị lỗi sập máy chủ."));
    }, 90000);
  });
}
```


## Source Files:

- `js\chatgpt_automator.js`

