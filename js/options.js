document.addEventListener("DOMContentLoaded", () => {
  const specialtyCard = document.getElementById("specialty-card");
  const aiChannelCard = document.getElementById("ai-channel-card");
  const autopromptCard = document.getElementById("autoprompt-input").closest('.card');
  const webAuthCard = document.getElementById("web-auth-card");

  const specialtyInput = document.getElementById("specialty-input");
  const autopromptInput = document.getElementById("autoprompt-input");
  
  // New UI Elements
  const ocrToggle = document.getElementById("ocr-toggle");
  const channelSelect = document.getElementById("channel-select");
  const apiConfigBox = document.getElementById("api-config");
  const apiUrlInput = document.getElementById("api-url");
  const apiModelInput = document.getElementById("api-model");
  const apiKeyInput = document.getElementById("api-key");

  const saveBtn = document.getElementById("save-btn");
  const saveMsg = document.getElementById("save-msg");
  const checkAuthBtn = document.getElementById("check-auth-btn");
  const viewArchBtn = document.getElementById("view-arch-btn");

  // Load saved option
  chrome.storage.sync.get([
    "specialty", "autoprompt", 
    "useOcr", "aiChannel", "apiUrl", "apiModel", "apiKey"
  ], (data) => {
    if (data.specialty) specialtyInput.value = data.specialty;
    if (data.autoprompt) autopromptInput.value = data.autoprompt;
    
    ocrToggle.checked = !!data.useOcr;
    if (data.aiChannel) channelSelect.value = data.aiChannel;
    if (data.apiUrl) apiUrlInput.value = data.apiUrl;
    if (data.apiModel) apiModelInput.value = data.apiModel;
    if (data.apiKey) apiKeyInput.value = data.apiKey;

    toggleChannelConfig();
  });

  channelSelect.addEventListener("change", toggleChannelConfig);

  function toggleChannelConfig() {
    const channel = channelSelect.value;
    if (channel === "web") {
      apiConfigBox.style.display = "none";
      webAuthCard.style.display = "block";
    } else {
      apiConfigBox.style.display = "block";
      webAuthCard.style.display = "none";
      
      if (channel === "api_local") {
         document.getElementById("api-key").placeholder = "(Thường bỏ trống cho Local API)";
         if(!apiUrlInput.value) apiUrlInput.value = "http://localhost:1234/v1/chat/completions";
      } else {
         document.getElementById("api-key").placeholder = "Bearer Token (Bắt buộc)";
         if(apiUrlInput.value === "http://localhost:1234/v1/chat/completions") apiUrlInput.value = "https://api.openai.com/v1/chat/completions";
      }
    }
  }

  saveBtn.addEventListener("click", () => {
    chrome.storage.sync.set({ 
      specialty: specialtyInput.value.trim(), 
      autoprompt: autopromptInput.value.trim(),
      useOcr: ocrToggle.checked,
      aiChannel: channelSelect.value,
      apiUrl: apiUrlInput.value.trim(),
      apiModel: apiModelInput.value.trim(),
      apiKey: apiKeyInput.value.trim()
    }, () => {
      saveMsg.style.display = "block";
      setTimeout(() => {
        saveMsg.style.display = "none";
      }, 2000);
    });
  });


  checkAuthBtn.addEventListener("click", checkAuthStatus);
  checkAuthStatus();

  viewArchBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("html/architecture.html") });
  });
});

async function checkAuthStatus() {
  const statusDiv = document.getElementById("auth-status");
  statusDiv.innerHTML = '<span class="status-indicator loading"></span> Đang kiểm tra...';
  
  try {
    const res = await fetch("https://chatgpt.com/api/auth/session");
    if (res.status === 200) {
      const data = await res.json();
      if (data && data.accessToken) {
        statusDiv.innerHTML = '<span class="status-indicator logged-in"></span> Đã kết nối với ChatGPT Plus (Sẵn sàng).';
      } else {
        statusDiv.innerHTML = '<span class="status-indicator logged-out"></span> Chưa đăng nhập ChatGPT. Hãy đăng nhập trên tab riêng!';
      }
    } else {
      statusDiv.innerHTML = `<span class="status-indicator logged-out"></span> Lỗi kết nối (Mã lỗi: ${res.status}). Không thể truy cập session.`;
    }
  } catch (error) {
    statusDiv.innerHTML = '<span class="status-indicator logged-out"></span> Lỗi mạng! Hãy tải lại và thử lại.';
  }
}
