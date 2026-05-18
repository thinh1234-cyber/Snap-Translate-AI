# Spec: Keyboard Shortcuts + System Architecture Tab

**Date:** 2026-05-18
**Status:** Approved

---

## Feature 1: Keyboard Shortcuts Display

**File:** `html/options.html`

Add new card in General tab (after Custom Autoprompt card):

```html
<div class="card" id="shortcuts-card">
  <div class="section-title">⌨️ Phím tắt</div>
  <p class="description">Xem và tùy chỉnh phím tắt cho Snap & Translate AI.</p>
  <div class="shortcuts-list">
    <div class="shortcut-item">
      <span class="shortcut-label">Snap Dịch</span>
      <span class="shortcut-key">Alt+X</span>
    </div>
    <div class="shortcut-item">
      <span class="shortcut-label">Snap QR</span>
      <span class="shortcut-key">Chưa có</span>
    </div>
  </div>
  <a href="#" id="open-shortcuts-link" class="link">🔗 Mở cài đặt phím tắt Chrome</a>
</div>
```

**File:** `js/options.js`

Add click handler:
```javascript
document.getElementById("open-shortcuts-link").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});
```

**File:** `css/options.css`

Add styles:
```css
.shortcuts-list { margin: 12px 0; }
.shortcut-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px; background: var(--snap-options-bg-secondary, #f8f9fa);
  border-radius: 6px; margin-bottom: 6px;
}
.shortcut-key {
  font-family: monospace; font-weight: 600; padding: 2px 8px;
  background: var(--snap-options-bg-tertiary, #e8eaed); border-radius: 4px;
}
```

---

## Feature 2: Merge Architecture + Evolution

**File:** `html/options.html`

1. Remove `tab-evolution` div entirely
2. Change Architecture tab button text from "🏗 Kiến trúc" to "🏗 System"
3. Add Evolution button inside `tab-architecture` card:

```html
<div class="tab-content" id="tab-architecture">
  <div class="card" id="arch-card">
    <div class="section-title">🏗 System Architecture</div>
    <p class="description">Xem sơ đồ tương tác minh họa luồng hoạt động nội bộ của Extension.</p>
    <div id="arch-preview" class="arch-preview">
      <!-- existing nodes -->
    </div>
    <div id="arch-info" class="arch-info">
      <p>👆 Nhấn vào từng node để xem chi tiết luồng dữ liệu</p>
    </div>
    <div style="display:flex; gap:8px; margin-top:12px;">
      <button id="open-full-arch-btn" class="btn">🔍 Xem đầy đủ trong tab mới</button>
      <button id="open-evolution-btn" class="btn">🗺️ Mở Evolution Roadmap</button>
    </div>
  </div>
</div>
```

**File:** `js/options.js`

- Remove the separate evolution tab handler (line 107-109 stays, just moved context)
- The `openEvolutionBtn` click handler already exists, no change needed

---

## Files Modified

1. `html/options.html` - Add shortcuts card, merge tabs
2. `js/options.js` - Add shortcuts link handler
3. `css/options.css` - Add shortcuts styles