// --- Advanced DOM Automator for ChatGPT (Extreme Optimization) ---
// This script runs on chatgpt.com

let isAutomating = false; // Khóa Mutex chống dẫm luồng

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PROCESS_VISION" || request.action === "PROCESS_TEXT") {
    if (isAutomating) {
      sendResponse({ success: false, error: "Hệ thống đang bận xử lý một lệnh khác. Vui lòng chờ!" });
      return true;
    }
    isAutomating = true;
    
    executeAutomation(request.action === "PROCESS_VISION" ? request.dataUrl : null, request.prompt)
      .then(resultText => {
        isAutomating = false;
        sendResponse({ success: true, text: resultText });
      })
      .catch(err => {
        isAutomating = false;
        sendResponse({ success: false, error: err.message });
      });
      
    return true; 
  }
});

async function executeAutomation(base64Data, promptText) {
  // 1. Chờ khung chat xuất hiện (Dùng setInterval siêu nhẹ 300ms thay vì MutationObserver)
  const textArea = await waitForElementLightweight('#prompt-textarea', 10000);
  if (!textArea) throw new Error("Không tìm thấy khung chat trên trang ChatGPT.");

  // 2. Nạp dữ liệu giả lập lệnh Paste
  const dataTransfer = new DataTransfer();
  dataTransfer.setData("text/plain", promptText);

  // Nếu có ảnh (Vision Mode) thì mới gắn file ảnh vào clipboard
  if (base64Data) {
    const blob = await (await fetch(base64Data)).blob();
    const file = new File([blob], "snap-image.png", { type: "image/png" });
    dataTransfer.items.add(file);
  }
  
  const pasteEvent = new ClipboardEvent('paste', {
    clipboardData: dataTransfer,
    bubbles: true,
    cancelable: true
  });
  textArea.dispatchEvent(pasteEvent);

  // 3. Đợi nút Gửi có thể bấm được (Chờ tải ảnh)
  let sendBtn = await waitForSendButtonActive(10000);
  if (!sendBtn) {
    throw new Error("Quá thời gian: Nút gửi bị khóa vì quá trình nạp ảnh gặp lỗi mạng.");
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

// Hàm chờ Element nhẹ nhàng không ăn CPU
function waitForElementLightweight(selector, timeout) {
  return new Promise((resolve) => {
    let checkTime = 0;
    const interval = 300; // Kiểm tra mỗi 300ms
    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        resolve(el);
      }
      checkTime += interval;
      if (checkTime >= timeout) {
        clearInterval(timer);
        resolve(null);
      }
    }, interval);
  });
}

function waitForSendButtonActive(timeout) {
  return new Promise((resolve) => {
    let checkTime = 0;
    const interval = 300;
    const timer = setInterval(() => {
      const btn = document.querySelector('[data-testid="send-button"]');
      if (btn && !btn.disabled) {
        clearInterval(timer);
        resolve(btn);
      }
      checkTime += interval;
      if (checkTime >= timeout) {
        clearInterval(timer);
        resolve(null);
      }
    }, interval);
  });
}

function observeResponseLifecycle(initialCount, MSG_SELECTOR) {
  return new Promise((resolve, reject) => {
    let checkInterval;
    let fallbackTimeout;

    // Polling siêu nhẹ cứ 500ms một lần
    checkInterval = setInterval(() => {
      // Logic Lõi: KHI NÀO NÚT SEND TRỞ LẠI -> BẤM ĐƯỢC -> CHATGPT CHẮC CHẮN ĐÃ NGHỈ TAY
      const sendBtn = document.querySelector('[data-testid="send-button"]');
      
      // Đợi nút Send mọc lại và mở khóa
      if (sendBtn && !sendBtn.disabled) {
        clearInterval(checkInterval);
        clearTimeout(fallbackTimeout);

        // Chờ thêm chút thời gian an toàn trước khi bóc text
        setTimeout(() => {
            const msgs = document.querySelectorAll(MSG_SELECTOR);
            if (msgs.length <= initialCount) {
               return reject(new Error("ChatGPT đã dừng nhưng không trả về bất kì văn bản nào."));
            }
            
            const lastMsg = msgs[msgs.length - 1];
            // Chỉ bóc lõi Text sạch nhất (bỏ phần Thinking, Icon rác trên lề)
            const pureMarkdown = lastMsg.querySelector('.markdown');
            
            if (pureMarkdown && pureMarkdown.innerText.trim().length > 0) {
              resolve(pureMarkdown.innerText);
            } else if (lastMsg.innerText.trim().length > 0) { // Fallback chống vã
              resolve(lastMsg.innerText);
            } else {
              reject(new Error("Lỗi: Không thể trích xuất đoạn văn từ mã nguồn của ChatGPT."));
            }
        }, 500); // Đợi 500ms cho text định hình DOM cuối
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
