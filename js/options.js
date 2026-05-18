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

      if (tabId === "memory") { loadMemoryHistory(); updateAnalytics(); }
      if (tabId === "glossary") loadGlossary();
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
  const openEvolutionBtn = document.getElementById("open-evolution-btn");
  const openShortcutsLink = document.getElementById("open-shortcuts-link");

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

  openEvolutionBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("html/evolution.html") });
  });

  openShortcutsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
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
  const memoryLimitDisplay = document.getElementById("memory-limit-display");
  const memoryLimitInput = document.getElementById("memory-limit-input");

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

  function loadMemoryLimit() {
    chrome.runtime.sendMessage({ action: "GET_MEMORY_LIMIT" }, (limit) => {
      if (!chrome.runtime.lastError && limit) {
        memoryLimitDisplay.textContent = limit;
        memoryLimitInput.value = limit;
      }
    });
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

  memoryLimitInput.addEventListener("change", () => {
    let val = parseInt(memoryLimitInput.value, 10);
    if (isNaN(val) || val < 10) val = 10;
    if (val > 500) val = 500;
    memoryLimitInput.value = val;

    chrome.runtime.sendMessage({ action: "SET_MEMORY_LIMIT", limit: val }, (res) => {
      if (res && res.success) {
        memoryLimitDisplay.textContent = res.limit;
        loadMemoryHistory();
      }
    });
  });

  // File storage functionality
  const fileList = document.getElementById("file-list");
  const fileCount = document.getElementById("file-count");
  const fileRefreshBtn = document.getElementById("file-refresh-btn");
  const fileClearBtn = document.getElementById("file-clear-btn");

  function loadSavedFiles() {
    chrome.runtime.sendMessage({ action: "GET_SAVED_FILES" }, (files) => {
      if (!chrome.runtime.lastError && files && files.length > 0) {
        fileCount.textContent = files.length;
        fileList.innerHTML = files.map(file => {
          const date = new Date(file.timestamp);
          const timeStr = date.toLocaleString('vi-VN');
          const modeLabel = file.mode === "qr" ? "QR" : "Dịch";
          const modeClass = file.mode === "qr" ? "qr" : "translate";
          const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
          const deleteIn = Math.max(0, 30 - daysAgo);

          return `
            <div class="memory-entry" data-id="${file.id}">
              <div class="memory-entry-header">
                <span class="memory-entry-time">STT #${file.sequence} — ${timeStr}</span>
                <span class="memory-entry-mode ${modeClass}">${modeLabel}</span>
              </div>
              <div class="memory-entry-text">
                🖼 ${file.pngFilename || "N/A"}<br>
                📄 ${file.txtFilename || "N/A"}<br>
                <span style="color:var(--snap-options-desc, #5f6368); font-size:11px;">⏰ Xóa sau: ${deleteIn} ngày</span>
              </div>
              <div class="memory-entry-actions">
                <button class="delete-btn" data-id="${file.id}">🗑 Xóa</button>
              </div>
            </div>
          `;
        }).join('');

        fileList.querySelectorAll('.delete-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            chrome.runtime.sendMessage({ action: "DELETE_SAVED_FILE", id }, () => {
              loadSavedFiles();
            });
          });
        });
      } else {
        fileList.innerHTML = '<div class="memory-empty">📭 Chưa có files nào được lưu.</div>';
        fileCount.textContent = "0";
      }
    });
  }

  fileRefreshBtn.addEventListener("click", () => {
    loadSavedFiles();
  });

  fileClearBtn.addEventListener("click", () => {
    if (confirm("Xóa toàn bộ files đã lưu? Hành động này không thể hoàn tác.")) {
      chrome.runtime.sendMessage({ action: "CLEAR_SAVED_FILES" }, () => {
        loadSavedFiles();
      });
    }
  });

  // Load memory on first tab switch
  const observer = new MutationObserver(() => {
    if (document.getElementById("tab-memory").classList.contains("active")) {
      loadMemoryHistory();
      loadMemoryLimit();
      loadSavedFiles();
      updateAnalytics();
      observer.disconnect();
    }
    if (document.getElementById("tab-glossary").classList.contains("active")) {
      loadGlossary();
    }
  });
  observer.observe(document.getElementById("tab-memory"), { attributes: true, attributeFilter: ["class"] });

  // ── Cloud Sync & Backup ──────────────────────────────────
  function dateStr() { return new Date().toISOString().slice(0, 10); }

  function showSyncMsg(msg) {
    const el = document.getElementById("sync-msg");
    el.textContent = msg; el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 3000);
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showSyncMsg(`✅ Đã export ${filename}`);
  }

  document.getElementById("export-settings-btn").addEventListener("click", () => {
    chrome.storage.sync.get(null, (data) => {
      downloadJSON(data, `snap-settings-${dateStr()}.json`);
    });
  });

  document.getElementById("import-settings-btn").addEventListener("click", () => {
    document.getElementById("import-settings-file").click();
  });
  document.getElementById("import-settings-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        chrome.storage.sync.set(data, () => {
          showSyncMsg("✅ Đã import cài đặt thành công! Reload để áp dụng.");
          setTimeout(() => location.reload(), 1500);
        });
      } catch(err) {
        showSyncMsg("❌ File JSON không hợp lệ: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("export-memory-btn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "GET_SNAP_HISTORY" }, (entries) => {
      downloadJSON(entries || [], `snap-memory-${dateStr()}.json`);
    });
  });

  document.getElementById("import-memory-btn").addEventListener("click", () => {
    document.getElementById("import-memory-file").click();
  });
  document.getElementById("import-memory-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const entries = JSON.parse(ev.target.result);
        chrome.storage.local.set({ snap_history: entries }, () => {
          showSyncMsg("✅ Đã import lịch sử thành công!");
          loadMemoryHistory();
        });
      } catch(err) {
        showSyncMsg("❌ File JSON không hợp lệ: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  // ── Analytics Dashboard ──────────────────────────────────
  let analyticsRange = "week";

  document.querySelectorAll(".analytics-filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".analytics-filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      analyticsRange = btn.dataset.range;
      updateAnalytics();
    });
  });

  function updateAnalytics(entries) {
    if (!entries) {
      chrome.runtime.sendMessage({ action: "GET_SNAP_HISTORY" }, (data) => {
        updateAnalytics(data || []);
      });
      return;
    }

    const now = new Date();
    let filtered = entries;

    if (analyticsRange === "week") {
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      filtered = entries.filter(e => new Date(e.timestamp) >= weekAgo);
    } else if (analyticsRange === "month") {
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      filtered = entries.filter(e => new Date(e.timestamp) >= monthAgo);
    }

    document.getElementById("analytics-total").textContent = filtered.length;
    document.getElementById("analytics-translate").textContent = filtered.filter(e => e.mode === "translate").length;
    document.getElementById("analytics-qr").textContent = filtered.filter(e => e.mode === "qr").length;

    const totalChars = filtered.reduce((sum, e) => sum + (e.ocrText?.length || 0) + (e.translation?.length || 0), 0);
    document.getElementById("analytics-chars").textContent = totalChars > 9999 ? (totalChars / 1000).toFixed(1) + "K" : totalChars;
  }

  // ── Glossary & Terminology Manager ───────────────────────
  function loadGlossary(query = "") {
    chrome.storage.sync.get({ glossary: [] }, (data) => {
      renderGlossary(data.glossary || [], query);
    });
  }

  function renderGlossary(entries, query = "") {
    const filtered = query ? entries.filter(e =>
      e.source.toLowerCase().includes(query.toLowerCase()) ||
      e.target.toLowerCase().includes(query.toLowerCase()) ||
      (e.category || "").toLowerCase().includes(query.toLowerCase())
    ) : entries;

    document.getElementById("glossary-count").textContent = entries.length;
    document.getElementById("glossary-active").textContent = entries.filter(e => e.enabled !== false).length;
    const cats = [...new Set(entries.map(e => e.category).filter(Boolean))];
    document.getElementById("glossary-categories").textContent = cats.length;

    if (filtered.length === 0) {
      document.getElementById("glossary-list").innerHTML = '<div class="memory-empty">📭 Không tìm thấy thuật ngữ nào.</div>';
      return;
    }

    document.getElementById("glossary-list").innerHTML = filtered.map(entry => `
      <div class="glossary-entry" data-id="${entry.id}">
        <div class="glossary-entry-header">
          <span class="glossary-term">${escapeHtml(entry.source)}</span>
          <span class="glossary-arrow">→</span>
          <span class="glossary-translation">${escapeHtml(entry.target)}</span>
          <span class="glossary-category-tag">${escapeHtml(entry.category || "General")}</span>
          <label class="glossary-toggle">
            <input type="checkbox" ${entry.enabled !== false ? 'checked' : ''} data-id="${entry.id}">
          </label>
          <button class="glossary-delete-btn" data-id="${entry.id}">🗑</button>
        </div>
      </div>
    `).join('');

    document.querySelectorAll(".glossary-toggle input").forEach(cb => {
      cb.addEventListener("change", () => {
        toggleGlossaryEntry(cb.dataset.id, cb.checked);
      });
    });
    document.querySelectorAll(".glossary-delete-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        deleteGlossaryEntry(btn.dataset.id);
      });
    });
  }

  function addGlossaryEntry(source, target, category) {
    chrome.storage.sync.get({ glossary: [] }, (data) => {
      const entries = data.glossary || [];
      entries.unshift({ id: Date.now().toString(), source, target, category, enabled: true });
      chrome.storage.sync.set({ glossary: entries }, () => {
        loadGlossary();
      });
    });
  }

  function toggleGlossaryEntry(id, enabled) {
    chrome.storage.sync.get({ glossary: [] }, (data) => {
      const entries = data.glossary.map(e => e.id === id ? { ...e, enabled } : e);
      chrome.storage.sync.set({ glossary: entries }, () => loadGlossary());
    });
  }

  function deleteGlossaryEntry(id) {
    chrome.storage.sync.get({ glossary: [] }, (data) => {
      const entries = data.glossary.filter(e => e.id !== id);
      chrome.storage.sync.set({ glossary: entries }, () => loadGlossary());
    });
  }

  function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showSyncMsg(`✅ Đã export ${filename}`);
  }

  document.getElementById("glossary-add-btn").addEventListener("click", () => {
    const source = document.getElementById("glossary-source").value.trim();
    const target = document.getElementById("glossary-target").value.trim();
    const category = document.getElementById("glossary-category").value.trim();
    if (!source || !target) return;
    addGlossaryEntry(source, target, category);
    document.getElementById("glossary-source").value = "";
    document.getElementById("glossary-target").value = "";
    document.getElementById("glossary-category").value = "";
  });

  document.getElementById("glossary-search").addEventListener("input", (e) => {
    loadGlossary(e.target.value);
  });

  document.getElementById("glossary-export-btn").addEventListener("click", () => {
    chrome.storage.sync.get({ glossary: [] }, (data) => {
      const csv = "source,target,category,enabled\n" +
        (data.glossary || []).map(e => `"${e.source}","${e.target}","${e.category || ''}",${e.enabled !== false}`).join("\n");
      downloadCSV(csv, `snap-glossary-${dateStr()}.csv`);
    });
  });

  document.getElementById("glossary-import-btn").addEventListener("click", () => {
    document.getElementById("glossary-import-file").click();
  });

  document.getElementById("glossary-import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const lines = ev.target.result.split("\n").filter(l => l.trim());
        const entries = lines.slice(1).map((line, i) => {
          const vals = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
          return {
            id: Date.now().toString() + i,
            source: vals[0]?.replace(/"/g, "") || "",
            target: vals[1]?.replace(/"/g, "") || "",
            category: vals[2]?.replace(/"/g, "") || "",
            enabled: vals[3]?.trim() !== "false"
          };
        }).filter(e => e.source && e.target);

        chrome.storage.sync.get({ glossary: [] }, (data) => {
          const merged = [...entries, ...data.glossary];
          chrome.storage.sync.set({ glossary: merged }, () => loadGlossary());
        });
      } catch(err) {
        showSyncMsg("❌ Lỗi import CSV: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("glossary-clear-btn").addEventListener("click", () => {
    if (confirm("Xóa toàn bộ glossary?")) {
      chrome.storage.sync.set({ glossary: [] }, () => loadGlossary());
    }
  });
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
