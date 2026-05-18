# Spec: Settings UI Improvements + Cloud Sync + Analytics + Glossary

**Date:** 2026-05-18
**Status:** Approved

---

## Feature 1: General Tab — 2 Column Layout

**File:** `css/options.css`

Add CSS grid to general tab:
```css
#tab-general {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
#tab-general > .card { margin: 0; }
#tab-general > .btn, #tab-general > .msg {
  grid-column: 1 / -1;
}
#shortcuts-card { grid-column: 1 / -1; }
```

**File:** `html/options.html`

Wrap save button and message in a full-width container:
```html
<div class="full-width-actions">
  <button id="save-btn" class="btn btn-primary">💾 Lưu cài đặt</button>
  <div id="save-msg" class="msg">Đã lưu thành công!</div>
</div>
```

---

## Feature 2: Cloud Sync & Backup (JSON Import/Export)

**File:** `html/options.html`

Add new card in General tab (full width):
```html
<div class="card full-width" id="sync-card">
  <div class="section-title">🔄 Cloud Sync & Backup</div>
  <p class="description">Xuất hoặc nhập cài đặt và lịch sử dưới dạng JSON.</p>
  <div class="sync-actions">
    <div class="sync-group">
      <span class="sync-label">Cài đặt:</span>
      <button id="export-settings-btn" class="btn">💾 Export Settings</button>
      <button id="import-settings-btn" class="btn">📂 Import Settings</button>
    </div>
    <div class="sync-group">
      <span class="sync-label">Lịch sử:</span>
      <button id="export-memory-btn" class="btn">💾 Export Memory</button>
      <button id="import-memory-btn" class="btn">📂 Import Memory</button>
    </div>
  </div>
  <input type="file" id="import-settings-file" accept=".json" style="display:none">
  <input type="file" id="import-memory-file" accept=".json" style="display:none">
  <div id="sync-msg" class="msg" style="display:none"></div>
</div>
```

**File:** `js/options.js`

Add handlers:
```javascript
// Export settings
document.getElementById("export-settings-btn").addEventListener("click", () => {
  chrome.storage.sync.get(null, (data) => {
    downloadJSON(data, `snap-settings-${dateStr()}.json`);
  });
});

// Import settings (replace all)
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

// Export memory
document.getElementById("export-memory-btn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "GET_SNAP_HISTORY" }, (entries) => {
    downloadJSON(entries, `snap-memory-${dateStr()}.json`);
  });
});

// Import memory (replace all)
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

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showSyncMsg(`✅ Đã export ${filename}`);
}

function showSyncMsg(msg) {
  const el = document.getElementById("sync-msg");
  el.textContent = msg; el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 3000);
}

function dateStr() {
  return new Date().toISOString().slice(0, 10);
}
```

**File:** `css/options.css`

```css
.sync-actions { display: flex; flex-direction: column; gap: 12px; margin: 12px 0; }
.sync-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sync-label { font-weight: 600; min-width: 80px; }
```

---

## Feature 3: Analytics Dashboard (Memory Tab)

**File:** `html/options.html`

Add analytics section at top of memory tab:
```html
<div class="card" id="analytics-card">
  <div class="section-title">📊 Analytics Dashboard</div>
  <p class="description">Thống kê hoạt động snap và dịch thuật.</p>
  <div class="analytics-filters">
    <button class="analytics-filter active" data-range="week">Tuần này</button>
    <button class="analytics-filter" data-range="month">Tháng này</button>
    <button class="analytics-filter" data-range="all">Tất cả</button>
  </div>
  <div class="analytics-grid">
    <div class="analytics-stat">
      <div class="analytics-value" id="analytics-total">0</div>
      <div class="analytics-label">Tổng Snap</div>
    </div>
    <div class="analytics-stat">
      <div class="analytics-value" id="analytics-translate">0</div>
      <div class="analytics-label">🌍 Dịch</div>
    </div>
    <div class="analytics-stat">
      <div class="analytics-value" id="analytics-qr">0</div>
      <div class="analytics-label">📷 QR</div>
    </div>
    <div class="analytics-stat">
      <div class="analytics-value" id="analytics-chars">0</div>
      <div class="analytics-label">Ký tự đã dịch</div>
    </div>
  </div>
</div>
```

**File:** `js/options.js`

Add analytics logic:
```javascript
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
```

**File:** `css/options.css`

```css
.analytics-filters { display: flex; gap: 8px; margin: 12px 0; }
.analytics-filter {
  padding: 6px 14px; border: 1px solid var(--snap-options-border);
  border-radius: 6px; background: var(--snap-options-btn-bg);
  cursor: pointer; font-size: 13px; color: var(--snap-options-btn-text);
}
.analytics-filter.active {
  background: var(--snap-options-primary-bg); color: var(--snap-options-primary-text);
  border-color: var(--snap-options-primary-bg);
}
.analytics-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 12px;
}
.analytics-stat { text-align: center; padding: 12px; background: var(--snap-options-bg); border-radius: 8px; }
.analytics-value { font-size: 24px; font-weight: 700; color: var(--snap-options-title); }
.analytics-label { font-size: 11px; color: var(--snap-options-desc); margin-top: 4px; }
```

---

## Feature 4: Glossary & Terminology Manager Tab

**File:** `html/options.html`

Add new tab button and content:
```html
<button class="tab-btn" data-tab="glossary">📖 Glossary</button>
```

```html
<div class="tab-content" id="tab-glossary">
  <div class="card" id="glossary-card">
    <div class="section-title">📖 Glossary & Terminology</div>
    <p class="description">Quản lý thuật ngữ chuyên ngành. Auto-apply khi dịch.</p>

    <div class="glossary-add">
      <input type="text" id="glossary-source" placeholder="Thuật ngữ gốc (VD: API)">
      <input type="text" id="glossary-target" placeholder="Bản dịch (VD: Giao diện lập trình)">
      <input type="text" id="glossary-category" placeholder="Category (VD: IT)">
      <button id="glossary-add-btn" class="btn btn-primary">+ Thêm</button>
    </div>

    <div class="glossary-controls">
      <input type="text" id="glossary-search" placeholder="🔍 Tìm kiếm thuật ngữ...">
      <button id="glossary-export-btn" class="btn">📤 Export CSV</button>
      <button id="glossary-import-btn" class="btn">📥 Import CSV</button>
      <button id="glossary-clear-btn" class="btn btn-danger">🗑 Xóa tất cả</button>
    </div>
    <input type="file" id="glossary-import-file" accept=".csv" style="display:none">

    <div class="glossary-stats" id="glossary-stats">
      <span class="stat">📊 Tổng: <b id="glossary-count">0</b></span>
      <span class="stat">✅ Active: <b id="glossary-active">0</b></span>
      <span class="stat">📁 Categories: <b id="glossary-categories">0</b></span>
    </div>

    <div id="glossary-list">
      <div class="memory-empty">📭 Chưa có thuật ngữ nào.</div>
    </div>
  </div>
</div>
```

**File:** `js/options.js`

Add glossary CRUD:
```javascript
function loadGlossary() {
  chrome.storage.sync.get({ glossary: [] }, (data) => {
    renderGlossary(data.glossary || []);
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

  // Event listeners
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
    chrome.storage.sync.set({ glossary: entries }, loadGlossary);
  });
}

function deleteGlossaryEntry(id) {
  chrome.storage.sync.get({ glossary: [] }, (data) => {
    const entries = data.glossary.filter(e => e.id !== id);
    chrome.storage.sync.set({ glossary: entries }, loadGlossary);
  });
}

// Event listeners
document.getElementById("glossary-add-btn").addEventListener("click", () => {
  const source = document.getElementById("glossary-source").value.trim();
  const target = document.getElementById("glossary-target").value.trim();
  const category = document.getElementById("glossary-category").value.trim();
  if (!source || !target) return;
  addGlossaryEntry(source, target, category);
  document.getElementById("glossary-source").value = "";
  document.getElementById("glossary-target").value = "";
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
      const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
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
        chrome.storage.sync.set({ glossary: merged }, loadGlossary);
      });
    } catch(err) {
      showSyncMsg("❌ Lỗi import CSV: " + err.message);
    }
  };
  reader.readAsText(file);
});

document.getElementById("glossary-clear-btn").addEventListener("click", () => {
  if (confirm("Xóa toàn bộ glossary?")) {
    chrome.storage.sync.set({ glossary: [] }, loadGlossary);
  }
});

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showSyncMsg(`✅ Đã export ${filename}`);
}
```

**File:** `css/options.css`

```css
.glossary-add { display: flex; gap: 8px; margin: 12px 0; flex-wrap: wrap; }
.glossary-add input { flex: 1; min-width: 120px; }
.glossary-controls { display: flex; gap: 8px; margin: 12px 0; flex-wrap: wrap; }
.glossary-controls input { flex: 1; min-width: 150px; }
.glossary-stats { display: flex; gap: 16px; margin: 12px 0; font-size: 13px; }
.glossary-entry {
  padding: 10px 12px; background: var(--snap-options-bg); border-radius: 6px;
  margin-bottom: 6px; display: flex; align-items: center;
}
.glossary-entry-header { display: flex; align-items: center; gap: 8px; width: 100%; }
.glossary-term { font-weight: 600; color: var(--snap-options-title); }
.glossary-arrow { color: var(--snap-options-desc); }
.glossary-translation { color: var(--snap-options-text); }
.glossary-category-tag {
  font-size: 11px; padding: 2px 8px; background: var(--snap-options-btn-bg);
  border-radius: 4px; color: var(--snap-options-desc);
}
.glossary-toggle { margin-left: auto; }
.glossary-delete-btn { background: none; border: none; cursor: pointer; font-size: 14px; }
```

---

## Files Modified

1. `html/options.html` - 2-column layout, sync card, analytics, glossary tab
2. `js/options.js` - Sync handlers, analytics logic, glossary CRUD
3. `css/options.css` - Grid layout, sync styles, analytics styles, glossary styles
