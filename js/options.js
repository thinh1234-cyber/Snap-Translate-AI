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

      if (tabId === "memory") {
        loadMemoryHistory();
        loadMemoryLimit();
        updateAnalytics();
      }
    });
  });

  // General settings
  const themeToggle = document.getElementById("theme-toggle");
  const saveBtn = document.getElementById("save-btn");
  const saveMsg = document.getElementById("save-msg");
  const openShortcutsLink = document.getElementById("open-shortcuts-link");

  chrome.storage.sync.get({
    theme: "light"
  }, (data) => {
    const isDark = data.theme === "dark";
    themeToggle.checked = isDark;
    applyTheme(isDark);
  });

  themeToggle.addEventListener("change", () => {
    const isDark = themeToggle.checked;
    applyTheme(isDark);
    chrome.storage.sync.set({ theme: isDark ? "dark" : "light" });
    chrome.runtime.sendMessage({ action: "THEME_CHANGED", theme: isDark ? "dark" : "light" }).catch(() => {});
  });

  saveBtn.addEventListener("click", () => {
    saveMsg.style.display = "block";
    setTimeout(() => { saveMsg.style.display = "none"; }, 2000);
  });

  if (openShortcutsLink) {
    openShortcutsLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    });
  }

  // Memory functionality
  const memorySearch = document.getElementById("memory-search");
  const memoryList = document.getElementById("memory-list");
  const memoryClearBtn = document.getElementById("memory-clear-btn");
  const memoryCount = document.getElementById("memory-count");
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
          const isQR = entry.mode === "qr";
          const modeLabel = isQR ? "QR Code" : "OCR Text";
          const modeClass = isQR ? "qr" : "translate";
          const previewText = entry.text || "(Không có nội dung)";

          return `
            <div class="memory-entry" data-id="${entry.id}">
              <div class="memory-entry-header">
                <span class="memory-entry-time">${timeStr}</span>
                <span class="memory-entry-mode ${modeClass}">${modeLabel}</span>
              </div>
              <div class="memory-entry-text">${escapeHtml(previewText)}</div>
              <div class="memory-entry-actions">
                <button class="copy-btn" data-text="${escapeAttr(previewText)}">📋 Copy</button>
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
              updateAnalytics();
            });
          });
        });
      } else {
        memoryList.innerHTML = '<div class="memory-empty">📭 Chưa có lịch sử snap nào.</div>';
        if (memoryCount) memoryCount.textContent = "0";
      }
    });
  }

  function updateMemoryStats(entries) {
    if (memoryCount) memoryCount.textContent = entries.length;
  }

  function loadMemoryLimit() {
    chrome.runtime.sendMessage({ action: "GET_MEMORY_LIMIT" }, (limit) => {
      if (!chrome.runtime.lastError && limit) {
        if (memoryLimitDisplay) memoryLimitDisplay.textContent = limit;
        if (memoryLimitInput) memoryLimitInput.value = limit;
      }
    });
  }

  function escapeHtml(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escapeAttr(str) {
    return String(str || "").replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  let searchTimeout;
  if (memorySearch) {
    memorySearch.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        loadMemoryHistory(memorySearch.value);
      }, 300);
    });
  }

  if (memoryClearBtn) {
    memoryClearBtn.addEventListener("click", () => {
      if (confirm("Xóa toàn bộ lịch sử snap? Hành động này không thể hoàn tác.")) {
        chrome.runtime.sendMessage({ action: "CLEAR_HISTORY" }, () => {
          loadMemoryHistory();
          updateAnalytics();
        });
      }
    });
  }

  if (memoryLimitInput) {
    memoryLimitInput.addEventListener("change", () => {
      let val = parseInt(memoryLimitInput.value, 10);
      if (isNaN(val) || val < 10) val = 10;
      if (val > 500) val = 500;
      memoryLimitInput.value = val;

      chrome.runtime.sendMessage({ action: "SET_MEMORY_LIMIT", limit: val }, (res) => {
        if (res && res.success) {
          if (memoryLimitDisplay) memoryLimitDisplay.textContent = res.limit;
          loadMemoryHistory();
        }
      });
    });
  }

  // Cloud Sync & Backup
  function dateStr() { return new Date().toISOString().slice(0, 10); }

  function showSyncMsg(msg) {
    const el = document.getElementById("sync-msg");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 3000);
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showSyncMsg(`✅ Đã export ${filename}`);
  }

  document.getElementById("export-settings-btn")?.addEventListener("click", () => {
    chrome.storage.sync.get({
      theme: "light",
      memoryLimit: 50,
      hasSeenOnboarding: false
    }, (data) => {
      downloadJSON(data, `snap-decode-settings-${dateStr()}.json`);
    });
  });

  document.getElementById("import-settings-btn")?.addEventListener("click", () => {
    document.getElementById("import-settings-file")?.click();
  });

  document.getElementById("import-settings-file")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        chrome.storage.sync.set(data, () => {
          showSyncMsg("✅ Đã import cài đặt thành công!");
          setTimeout(() => location.reload(), 1500);
        });
      } catch(err) {
        showSyncMsg("❌ File JSON không hợp lệ: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("export-memory-btn")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "GET_SNAP_HISTORY" }, (entries) => {
      downloadJSON(entries || [], `snap-decode-memory-${dateStr()}.json`);
    });
  });

  document.getElementById("import-memory-btn")?.addEventListener("click", () => {
    document.getElementById("import-memory-file")?.click();
  });

  document.getElementById("import-memory-file")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const entries = JSON.parse(ev.target.result);
        chrome.storage.local.set({ snap_history: entries }, () => {
          showSyncMsg("✅ Đã import lịch sử thành công!");
          loadMemoryHistory();
          updateAnalytics();
        });
      } catch(err) {
        showSyncMsg("❌ File JSON không hợp lệ: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Analytics Dashboard
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

    const totalEl = document.getElementById("analytics-total");
    const ocrEl = document.getElementById("analytics-ocr");
    const qrEl = document.getElementById("analytics-qr");
    const charsEl = document.getElementById("analytics-chars");

    if (totalEl) totalEl.textContent = filtered.length;
    if (ocrEl) ocrEl.textContent = filtered.filter(e => e.mode !== "qr").length;
    if (qrEl) qrEl.textContent = filtered.filter(e => e.mode === "qr").length;

    const totalChars = filtered.reduce((sum, e) => {
      const text = e.text || "";
      return sum + text.length;
    }, 0);

    if (charsEl) {
      charsEl.textContent = totalChars > 9999 ? (totalChars / 1000).toFixed(1) + "K" : totalChars;
    }
  }
});

function applyTheme(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}
