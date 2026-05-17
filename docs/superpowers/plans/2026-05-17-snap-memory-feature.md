# Snap History Memory Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lưu lịch sử mỗi lần snap (ảnh, OCR text, bản dịch, QR) với UI xem/xóa trong Settings và popup.

**Architecture:** Dùng `chrome.storage.local` để lưu snap history (không sync lên cloud). Mỗi entry chứa: timestamp, mode (translate/qr), ocrText, translation, sourceUrl. Settings page có tab mới hiển thị danh sách history với search + delete.

**Tech Stack:** chrome.storage.local, vanilla JS, CSS variables (đã có dark mode)

---

### File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `js/modules/memory-manager.js` | Create | CRUD operations cho snap history |
| `js/background.js` | Modify | Thêm handler `SAVE_SNAP`, `GET_SNAP_HISTORY`, `DELETE_SNAP`, `CLEAR_HISTORY` |
| `js/content.js` | Modify | Gọi `SAVE_SNAP` sau khi có kết quả OCR/translation/QR |
| `html/options.html` | Modify | Thêm Memory tab với list + search + delete buttons |
| `js/options.js` | Modify | Load/render memory history, handle delete/clear |
| `css/options.css` | Modify | Styles cho memory list, cards, search bar |

---

### Task 1: Memory Manager Module

**Files:**
- Create: `js/modules/memory-manager.js`

- [ ] **Step 1: Create memory-manager.js**

```javascript
// ═══════════════════════════════════════════════════════════
// MEMORY-MANAGER.JS — Quản lý lịch sử Snap
// ═══════════════════════════════════════════════════════════

const MEMORY_KEY = "snap_history";
const MAX_ENTRIES = 100;

export async function saveSnap(entry) {
  const history = await getHistory();
  history.unshift({
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    mode: entry.mode || "translate",
    ocrText: entry.ocrText || "",
    translation: entry.translation || "",
    sourceUrl: entry.sourceUrl || "",
    confidence: entry.confidence || 0
  });

  // Keep only MAX_ENTRIES
  if (history.length > MAX_ENTRIES) {
    history.length = MAX_ENTRIES;
  }

  await chrome.storage.local.set({ [MEMORY_KEY]: history });
  return history;
}

export async function getHistory() {
  const result = await chrome.storage.local.get(MEMORY_KEY);
  return result[MEMORY_KEY] || [];
}

export async function deleteSnap(id) {
  const history = await getHistory();
  const filtered = history.filter(entry => entry.id !== id);
  await chrome.storage.local.set({ [MEMORY_KEY]: filtered });
  return filtered;
}

export async function clearHistory() {
  await chrome.storage.local.set({ [MEMORY_KEY]: [] });
  return [];
}

export async function searchHistory(query) {
  const history = await getHistory();
  if (!query.trim()) return history;

  const lowerQuery = query.toLowerCase();
  return history.filter(entry =>
    (entry.ocrText && entry.ocrText.toLowerCase().includes(lowerQuery)) ||
    (entry.translation && entry.translation.toLowerCase().includes(lowerQuery))
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add js/modules/memory-manager.js
git commit -m "feat: add memory-manager module for snap history CRUD"
```

---

### Task 2: Background Message Handlers

**Files:**
- Modify: `js/background.js`

- [ ] **Step 1: Add memory imports and handlers**

```javascript
// ═══════════════════════════════════════════════════════════
// BACKGROUND.JS — Message Router & Orchestrator
// ═══════════════════════════════════════════════════════════

import { registerCommandListener, startSnap } from './modules/snap-controller.js';
import { handleTranslation } from './modules/translation-engine.js';
import { openChatGPTWindow } from './modules/chatgpt-bridge.js';
import { prepChatGPTCookies, sendPromptToIframe } from './modules/ocr-manager.js';
import { saveSnap, getHistory, deleteSnap, clearHistory, searchHistory } from './modules/memory-manager.js';

// ── Register command listener ─────────────────────────────
registerCommandListener();

// ── Message Router ────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "CAPTURE_SCREEN":
      chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, (dataUrl) => {
        sendResponse({ dataUrl: dataUrl });
      });
      return true;

    case "OPEN_OPTIONS":
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('html/options.html'));
      }
      return true;

    case "TRANSLATE_IMAGE":
      handleTranslation(request.dataUrl, request.ocrText, sendResponse);
      return true;

    case "SAVE_SNAP":
      saveSnap(request.entry).then(history => {
        sendResponse({ success: true, count: history.length });
      });
      return true;

    case "GET_SNAP_HISTORY":
      getHistory().then(history => {
        sendResponse(history);
      });
      return true;

    case "SEARCH_SNAP_HISTORY":
      searchHistory(request.query).then(results => {
        sendResponse(results);
      });
      return true;

    case "DELETE_SNAP":
      deleteSnap(request.id).then(history => {
        sendResponse({ success: true, count: history.length });
      });
      return true;

    case "CLEAR_HISTORY":
      clearHistory().then(() => {
        sendResponse({ success: true });
      });
      return true;

    case "OPEN_CHATGPT_TRANSLATE":
    case "OPEN_CHATGPT_WINDOW":
      openChatGPTWindow(request.ocrText, request.dataUrl, request.winLeft, request.winTop, sendResponse);
      return true;

    case "SEND_CHATGPT_PROMPT":
      sendPromptToIframe(request.ocrText, request.dataUrl, sender.tab.id, sendResponse);
      return true;

    case "PREP_CHATGPT_IFRAME":
      prepChatGPTCookies(sendResponse);
      return true;

    default:
      return false;
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add js/background.js
git commit -m "feat: add memory message handlers to background router"
```

---

### Task 3: Save Snap After Results

**Files:**
- Modify: `js/content.js`

- [ ] **Step 1: Add saveSnap call in cropImage after OCR+translation result**

Tìm function `cropImage` trong `js/content.js`, thêm save sau khi có kết quả API:

```javascript
// Trong cropImage, sau khi nhận kết quả từ TRANSLATE_IMAGE:
chrome.runtime.sendMessage({
  action: "TRANSLATE_IMAGE",
  dataUrl: croppedDataUrl,
  ocrText: extractedText
}, (res) => {
  if (res && res.success) {
    updatePopupResult(extractedText ? `(OCR Text)\n${extractedText}` : "", res.translation);
    // Save to memory
    chrome.runtime.sendMessage({
      action: "SAVE_SNAP",
      entry: {
        mode: "translate",
        ocrText: extractedText || "",
        translation: res.translation,
        sourceUrl: window.location.href
      }
    });
  } else {
    updatePopupError(res ? res.error : "Mất kết nối với Trung tâm điều khiển. Thử tải lại thẻ.");
  }
});
```

- [ ] **Step 2: Add saveSnap call for QR mode**

Trong phần QR detection:

```javascript
if (data.mode === "qr") {
  try {
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code) {
      updatePopupResult("Tìm thấy Mã QR:", code.data);
      // Save to memory
      chrome.runtime.sendMessage({
        action: "SAVE_SNAP",
        entry: {
          mode: "qr",
          ocrText: "",
          translation: code.data,
          sourceUrl: window.location.href
        }
      });
    } else {
      updatePopupError("Không tìm thấy thông tin quét mã QR nào trong hình.");
    }
  } catch (e) {
    updatePopupError("Lỗi phần mềm đọc QR: " + e.message);
  }
  return;
}
```

- [ ] **Step 3: Commit**

```bash
git add js/content.js
git commit -m "feat: save snap results to memory after OCR/translation/QR"
```

---

### Task 4: Memory UI in Options Page

**Files:**
- Modify: `html/options.html`
- Modify: `js/options.js`
- Modify: `css/options.css`

- [ ] **Step 1: Add Memory tab HTML to options.html**

Thêm trước `<button id="save-btn">`:

```html
    <div class="card" id="memory-card">
      <div class="section-title">📝 Lịch sử Snap</div>
      <p class="description">Xem lại các lần chụp và dịch trước đây. Tối đa 100 entries.</p>

      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <input type="text" id="memory-search" placeholder="🔍 Tìm kiếm trong lịch sử..." style="flex:1; padding:8px 12px;">
        <button id="memory-clear-btn" class="btn" style="background:#d93025; color:white;">🗑 Xóa tất cả</button>
      </div>

      <div id="memory-list" style="max-height:400px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
        <div style="text-align:center; padding:20px; color:#5f6368;">Đang tải lịch sử...</div>
      </div>
    </div>
```

- [ ] **Step 2: Add Memory styles to options.css**

```css
/* Memory History Styles */
.memory-entry {
  background: var(--snap-options-bg, #f7f9fa);
  border: 1px solid var(--snap-options-border, #dadce0);
  border-radius: 8px;
  padding: 12px;
  position: relative;
  transition: background-color 0.3s;
}
.memory-entry:hover {
  background: var(--snap-options-input-bg, #ffffff);
}
.memory-entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.memory-entry-time {
  font-size: 11px;
  color: var(--snap-options-desc, #5f6368);
}
.memory-entry-mode {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}
.memory-entry-mode.translate {
  background: #e8f0fe;
  color: #1a73e8;
}
.memory-entry-mode.qr {
  background: #e6f4ea;
  color: #0f9d58;
}
.memory-entry-text {
  font-size: 12px;
  line-height: 1.4;
  color: var(--snap-options-text, #333);
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.memory-entry-actions {
  display: flex;
  gap:6px;
  margin-top: 8px;
}
.memory-entry-actions button {
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid var(--snap-options-border, #dadce0);
  background: var(--snap-options-btn-bg, #f1f3f4);
  color: var(--snap-options-btn-text, #3c4043);
  cursor: pointer;
}
.memory-entry-actions button:hover {
  background: var(--snap-options-border, #e8eaed);
}
.memory-entry-actions .delete-btn {
  color: #d93025;
}
.memory-empty {
  text-align: center;
  padding: 30px;
  color: var(--snap-options-desc, #5f6368);
  font-size: 14px;
}
```

- [ ] **Step 3: Add Memory JS logic to options.js**

Thêm vào cuối `DOMContentLoaded`:

```javascript
  // Memory History
  const memorySearch = document.getElementById("memory-search");
  const memoryList = document.getElementById("memory-list");
  const memoryClearBtn = document.getElementById("memory-clear-btn");

  async function loadMemoryHistory(query = "") {
    const action = query ? "SEARCH_SNAP_HISTORY" : "GET_SNAP_HISTORY";
    const request = query ? { action, query } : { action: "GET_SNAP_HISTORY" };

    chrome.runtime.sendMessage(request, (entries) => {
      if (!entries || entries.length === 0) {
        memoryList.innerHTML = '<div class="memory-empty">📭 Chưa có lịch sử snap nào.</div>';
        return;
      }

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

      // Bind copy buttons
      memoryList.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const text = btn.getAttribute('data-text');
          navigator.clipboard.writeText(text).then(() => {
            btn.textContent = '✅ Copied!';
            setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
          });
        });
      });

      // Bind delete buttons
      memoryList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          chrome.runtime.sendMessage({ action: "DELETE_SNAP", id }, () => {
            loadMemoryHistory(memorySearch?.value || "");
          });
        });
      });
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Load history on page load
  loadMemoryHistory();

  // Search with debounce
  let searchTimeout;
  memorySearch.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadMemoryHistory(memorySearch.value);
    }, 300);
  });

  // Clear all
  memoryClearBtn.addEventListener("click", () => {
    if (confirm("Xóa toàn bộ lịch sử snap? Hành động này không thể hoàn tác.")) {
      chrome.runtime.sendMessage({ action: "CLEAR_HISTORY" }, () => {
        loadMemoryHistory();
      });
    }
  });
```

- [ ] **Step 4: Commit**

```bash
git add html/options.html js/options.js css/options.css
git commit -m "feat: add memory history UI in options page with search/delete"
```

---

### Self-Review Checklist

1. **Spec coverage:** ✅ CRUD operations, ✅ UI in settings, ✅ Auto-save after snap, ✅ Search, ✅ Delete single/clear all, ✅ Copy from history
2. **Placeholder scan:** No TBD/TODO found
3. **Type consistency:** `entry.mode`, `entry.ocrText`, `entry.translation`, `entry.timestamp` consistent across all files
4. **DRY:** escapeHtml/escapeAttr duplicated in options.js - acceptable since content.js is separate context
5. **YAGNI:** No pagination (100 entries max is enough), no export history (can add later)

---

### Execution

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch fresh subagent per task, review between tasks
2. **Inline Execution** - Execute tasks in this session using executing-plans

Which approach?
