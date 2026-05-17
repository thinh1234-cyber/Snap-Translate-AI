document.addEventListener("DOMContentLoaded", () => {
  // Tab switching
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${tabId}`).classList.add("active");

      if (tabId === "memory") loadMemoryHistory();
    });
  });

  // General settings
  const specialtyInput = document.getElementById("specialty-input");
  const autopromptInput = document.getElementById("autoprompt-input");
  const ocrToggle = document.getElementById("ocr-toggle");
  const channelSelect = document.getElementById("channel-select");
  const apiConfigBox = document.getElementById("api-config");
  const apiUrlInput = document.getElementById("api-url");
  const apiModelInput = document.getElementById("api-model");
  const apiKeyInput = document.getElementById("api-key");
  const themeToggle = document.getElementById("theme-toggle");
  const saveBtn = document.getElementById("save-btn");
  const saveMsg = document.getElementById("save-msg");
  const checkAuthBtn = document.getElementById("check-auth-btn");
  const openFullArchBtn = document.getElementById("open-full-arch-btn");

  chrome.storage.sync.get({
    specialty: "",
    autoprompt: "Ngắn gọn súc tích, không giải thích thêm.",
    useOcr: true,
    aiChannel: "web",
    apiUrl: "",
    apiModel: "",
    apiKey: "",
    theme: "light"
  }, (data) => {
    specialtyInput.value = data.specialty;
    autopromptInput.value = data.autoprompt;
    ocrToggle.checked = data.useOcr;
    channelSelect.value = data.aiChannel;
    if (data.apiUrl) apiUrlInput.value = data.apiUrl;
    if (data.apiModel) apiModelInput.value = data.apiModel;
    if (data.apiKey) apiKeyInput.value = data.apiKey;

    const isDark = data.theme === "dark";
    themeToggle.checked = isDark;
    applyTheme(isDark);
    toggleChannelConfig();
  });

  themeToggle.addEventListener("change", () => {
    const isDark = themeToggle.checked;
    applyTheme(isDark);
    chrome.storage.sync.set({ theme: isDark ? "dark" : "light" });
    chrome.runtime.sendMessage({ action: "THEME_CHANGED", theme: isDark ? "dark" : "light" }).catch(() => {});
  });

  channelSelect.addEventListener("change", toggleChannelConfig);

  function toggleChannelConfig() {
    const channel = channelSelect.value;
    if (channel === "web") {
      apiConfigBox.style.display = "none";
      document.getElementById("web-auth-card").style.display = "block";
    } else {
      apiConfigBox.style.display = "block";
      document.getElementById("web-auth-card").style.display = "none";
      if (channel === "api_local") {
        apiKeyInput.placeholder = "(Thường bỏ trống cho Local API)";
        if(!apiUrlInput.value) apiUrlInput.value = "http://localhost:1234/v1/chat/completions";
      } else {
        apiKeyInput.placeholder = "Bearer Token (Bắt buộc)";
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
      setTimeout(() => { saveMsg.style.display = "none"; }, 2000);
    });
  });

  checkAuthBtn.addEventListener("click", checkAuthStatus);
  checkAuthStatus();

  openFullArchBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("html/architecture.html") });
  });

  // Architecture preview nodes
  const archNodes = document.querySelectorAll(".arch-node");
  const archInfo = document.getElementById("arch-info");

  const archData = {
    popup: { title: "📱 Popup UI", desc: "Giao diện chính của extension, nơi người dùng chọn chế độ Snap Dịch hoặc Snap QR. Gửi lệnh đến Background Service Worker." },
    content: { title: "🌐 Content Script", desc: "Chạy trên mỗi tab web. Lắng nghe sự kiện kéo chuột, tạo overlay crop, xử lý OCR và hiển thị kết quả." },
    background: { title: "🔀 Background Service Worker", desc: "Trung tâm điều phối. Nhận message từ popup/content, routing đến OCR, Translation, ChatGPT hoặc Memory." },
    memory: { title: "💾 Memory Storage", desc: "Lưu lịch sử snap vào chrome.storage.local. Hỗ trợ search, delete, copy. Tối đa 100 entries." },
    ocr: { title: "🔍 Tesseract OCR Engine", desc: "Engine nhận dạng ký tự quang học offline. Chuyển ảnh thành text trước khi gửi đi dịch, giảm tải cho AI." },
    translate: { title: "🌍 Translation Engine", desc: "Xử lý dịch thuật qua API (OpenAI/Gemini/Local). Ghép autoprompt và chuyên ngành vào request." },
    chatgpt: { title: "🤖 ChatGPT Bridge", desc: "Mở tab ChatGPT, inject prompt, paste ảnh ảo, đợi response và bóc rút kết quả từ DOM." },
    api: { title: "🔗 API/Local Channel", desc: "Kết nối trực tiếp đến OpenAI API, Gemini, hoặc Local API (LM Studio/Ollama). Siêu tốc, không cần mở tab." }
  };

  archNodes.forEach(node => {
    node.addEventListener("click", () => {
      archNodes.forEach(n => n.classList.remove("active"));
      node.classList.add("active");
      const key = node.dataset.node;
      const info = archData[key];
      if (info) {
        archInfo.innerHTML = `<b>${info.title}</b><br>${info.desc}`;
      }
    });
  });

  // Memory functionality
  const memorySearch = document.getElementById("memory-search");
  const memoryList = document.getElementById("memory-list");
  const memoryClearBtn = document.getElementById("memory-clear-btn");
  const memoryCount = document.getElementById("memory-count");
  const memoryTranslateCount = document.getElementById("memory-translate-count");
  const memoryQrCount = document.getElementById("memory-qr-count");

  function loadMemoryHistory(query = "") {
    const action = query ? "SEARCH_SNAP_HISTORY" : "GET_SNAP_HISTORY";
    const request = query ? { action, query } : { action: "GET_SNAP_HISTORY" };

    chrome.runtime.sendMessage(request, (entries) => {
      if (!chrome.runtime.lastError && entries && entries.length > 0) {
        updateMemoryStats(entries);
        memoryList.innerHTML = entries.map(entry => {
          const date = new Date(entry.timestamp);
          const timeStr = date.toLocaleString('vi-VN');
          const modeLabel = entry.mode === "qr" ? "QR" : "Dịch";
          const modeClass = entry.mode === "qr" ? "qr" : "translate";
          const previewText = entry.translation || entry.ocrText || "(Không có text)";

          return `
            <div class="memory-entry" data-id="${entry.id}">
              <div class="memory-entry-header">
                <span class="memory-entry-time">${timeStr}</span>
                <span class="memory-entry-mode ${modeClass}">${modeLabel}</span>
              </div>
              <div class="memory-entry-text">${escapeHtml(previewText)}</div>
              <div class="memory-entry-actions">
                <button class="copy-btn" data-text="${escapeAttr(entry.translation || entry.ocrText || '')}">📋 Copy</button>
                <button class="delete-btn" data-id="${entry.id}">🗑 Xóa</button>
              </div>
            </div>
          `;
        }).join('');

        memoryList.querySelectorAll('.copy-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const text = btn.getAttribute('data-text');
            navigator.clipboard.writeText(text).then(() => {
              btn.textContent = '✅ Copied!';
              setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
            });
          });
        });

        memoryList.querySelectorAll('.delete-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            chrome.runtime.sendMessage({ action: "DELETE_SNAP", id }, () => {
              loadMemoryHistory(memorySearch?.value || "");
            });
          });
        });
      } else {
        memoryList.innerHTML = '<div class="memory-empty">📭 Chưa có lịch sử snap nào.</div>';
        memoryCount.textContent = "0";
        memoryTranslateCount.textContent = "0";
        memoryQrCount.textContent = "0";
      }
    });
  }

  function updateMemoryStats(entries) {
    memoryCount.textContent = entries.length;
    memoryTranslateCount.textContent = entries.filter(e => e.mode === "translate").length;
    memoryQrCount.textContent = entries.filter(e => e.mode === "qr").length;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  let searchTimeout;
  memorySearch.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadMemoryHistory(memorySearch.value);
    }, 300);
  });

  memoryClearBtn.addEventListener("click", () => {
    if (confirm("Xóa toàn bộ lịch sử snap? Hành động này không thể hoàn tác.")) {
      chrome.runtime.sendMessage({ action: "CLEAR_HISTORY" }, () => {
        loadMemoryHistory();
      });
    }
  });

  // Load memory on first tab switch
  const observer = new MutationObserver(() => {
    if (document.getElementById("tab-memory").classList.contains("active")) {
      loadMemoryHistory();
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById("tab-memory"), { attributes: true, attributeFilter: ["class"] });
});

function applyTheme(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

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
