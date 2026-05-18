<div align="center">

<img src="assets/icon.png" alt="Logo" width="120">

# Snap & Translate AI

> Chrome Extension chụp vùng màn hình → OCR offline → Dịch thuật bằng AI

[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![AI](https://img.shields.io/badge/AI-ChatGPT_%7C_OpenAI_%7C_Local-orange.svg)]()

[Features](#-tính-năng) • [Install](#-cài-đặt) • [Usage](#-hướng-dẫn-sử-dụng) • [Architecture](#-kiến-trúc) • [Roadmap](#-lộ-trình)

</div>

---

## 🎯 Tổng quan

Extension chụp bất kỳ vùng nào trên màn hình trình duyệt, trích xuất văn bản bằng OCR offline (Tesseract.js), sau đó dịch thuật qua 3 kênh: **Web ChatGPT**, **OpenAI API**, hoặc **Local LLM** (Ollama/LM Studio). Hỗ trợ đọc mã QR, lưu lịch sử, quản lý thuật ngữ chuyên ngành.

---

## ✨ Tính năng

### Core
| Tính năng | Mô tả |
|-----------|-------|
| 📸 **Snap & Translate** | Kéo chuột chọn vùng → OCR → Dịch AI |
| 📷 **Snap QR** | Chụp vùng chứa QR → Giải mã tức thì |
| 🔄 **Resnap** | Snap lại không cần mở extension, phân biệt QR/Dịch |
| ⌨️ **Keyboard Shortcut** | `Alt+X` kích hoạt nhanh |

### AI Channels
| Kênh | Đặc điểm |
|------|----------|
| 💬 **Web ChatGPT** | Miễn phí, dùng session ChatGPT có sẵn |
| 🔗 **Server API** | OpenAI-compatible, siêu tốc |
| 🖥️ **Local API** | Ollama/LM Studio, offline, riêng tư |

### Data & Storage
| Tính năng | Mô tả |
|-----------|-------|
| 💾 **Memory** | Lịch sử snap, search, thống kê |
| 📁 **File Storage** | Auto-save PNG + text vào Downloads |
| 📊 **Analytics** | Dashboard theo tuần/tháng/tất cả |
| 📖 **Glossary** | Quản lý thuật ngữ, custom category, CSV import/export |
| 🔄 **Cloud Sync** | Export/Import JSON settings & memory |

### UI/UX
| Tính năng | Mô tả |
|-----------|-------|
| 🎨 **Dark Mode** | Theme sáng/tối nhất quán |
| 📐 **2-Column Settings** | Layout gọn gàng, dễ cấu hình |
| 🏗 **System Architecture** | Sơ đồ tương tác nội bộ |
| 🚀 **Evolution Roadmap** | Lộ trình phát triển |

---

## 📦 Cài đặt

### Yêu cầu
- Chrome 88+ (Manifest V3)
- Không cần server backend

### Các bước

1. **Tải source**
   ```bash
   git clone https://github.com/thinh1234-cyber/Snap-Translate-AI.git
   ```

2. **Mở Chrome Extensions**
   - Truy cập `chrome://extensions/`
   - Bật **Developer mode** (góc phải)

3. **Load extension**
   - Nhấn **Load unpacked**
   - Chọn thư mục project

4. **Sử dụng**
   - Click icon trên toolbar
   - Hoặc nhấn `Alt+X`

> 💡 Để snap trên file PDF local: Bật *"Allow access to file URLs"* trong chi tiết extension.

---

## 📖 Hướng dẫn sử dụng

### Snap Dịch
1. Mở extension → Click **Snap Dịch**
2. Kéo chuột chọn vùng văn bản
3. OCR tự động trích xuất chữ
4. Click **💬 Dịch** để gửi ChatGPT

### Snap QR
1. Click **Snap Đọc QR**
2. Chọn vùng chứa mã QR
3. Kết quả hiển thị ngay

### Resnap
- Sau khi có kết quả → Click **🔄 Resnap** → Chọn vùng mới
- Không cần mở lại extension

### Cấu hình
| Setting | Vị trí | Mô tả |
|---------|--------|-------|
| Chuyên ngành | Settings → Chung | Ngữ cảnh dịch cho AI |
| AI Channel | Settings → Chung | Web/API/Local |
| API Config | Settings → Chung | URL, Model, Key |
| Autoprompt | Settings → Chung | Custom instruction cho AI |
| Memory Limit | Settings → Lịch sử | Giới hạn entry (10-500) |
| Glossary | Settings → Glossary | Thuật ngữ chuyên ngành |

---

## 🏗 Kiến trúc

### Cấu trúc thư mục
```
├── js/
│   ├── background.js          # Service worker, message router
│   ├── content.js             # Content script, overlay, OCR UI
│   ├── popup.js               # Popup UI logic
│   ├── options.js             # Settings page logic
│   ├── chatgpt_automator.js   # ChatGPT tab automator
│   └── modules/
│       ├── snap-controller.js     # Keyboard shortcut handler
│       ├── translation-engine.js  # API translation logic
│       ├── chatgpt-bridge.js      # ChatGPT tab management
│       ├── ocr-manager.js         # iframe prompt injection
│       ├── memory-manager.js      # History CRUD
│       └── file-saver.js          # PNG + text storage
├── lib/
│   ├── tesseract.min.js       # OCR engine
│   ├── tesseract-core.wasm.js # WASM core
│   ├── jsQR.js                # QR decoder
│   └── lang-data/             # Vietnamese + English data
├── html/                      # UI pages
├── css/                       # Styles
└── manifest.json              # Extension config (MV3)
```

### Luồng hoạt động
```
Popup → Inject Scripts → Content Script → Capture Screen
                                                    ↓
                                        Crop + OCR (Tesseract)
                                                    ↓
                              ┌─────────────────────┼─────────────────────┐
                              ↓                     ↓                     ↓
                        QR Mode              Translate Mode          Save to Memory
                        (jsQR)               (ChatGPT/API)          (PNG + Text)
```

### Chi tiết kiến trúc
→ [Xem sơ đồ tương tác](html/architecture.html) trong tab **System** của Settings

---

## 🔧 Công nghệ

| Layer | Technology |
|-------|------------|
| Extension | Manifest V3, Service Worker |
| OCR | Tesseract.js 4.x (WASM, offline) |
| QR | jsQR |
| AI | ChatGPT Web, OpenAI API, Local LLM |
| Storage | chrome.storage.sync + chrome.storage.local |
| UI | Vanilla JS, CSS Variables, Dark Mode |

---

## 🚀 Lộ trình

### Đã hoàn thành (v1.2)
- ✅ ES Modules architecture
- ✅ Multi-channel AI (Web/API/Local)
- ✅ Tesseract OCR offline
- ✅ QR code reader
- ✅ Memory system + File storage
- ✅ Resnap feature
- ✅ Dark mode
- ✅ 2-column settings
- ✅ Cloud Sync (JSON import/export)
- ✅ Analytics Dashboard
- ✅ Glossary Manager

### Sắp tới
- [ ] Auto Cloud Sync (Firebase/Google Drive)
- [ ] Glossary auto-apply trong translation prompt
- [ ] Advanced analytics với Chart.js
- [ ] Batch snap (chụp nhiều vùng)
- [ ] Multi-language UI (i18n)
- [ ] Smart notifications

→ [Xem đầy đủ roadmap](html/evolution.html)

---

## 📝 License

MIT — Xem [LICENSE](LICENSE)

---

<div align="center">
<p>Made with ❤️ by <b>Nguyễn Thịnh - Kyle</b></p>
</div>
