<div align="center">

<img src="assets/icon.png" alt="Logo" width="120">

# Snap Decode

> Chrome Extension: Giải mã QR Code thông minh & Mở khóa tải tài liệu (Scribd, StuDocu)

[![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![Backend](https://img.shields.io/badge/Backend-Native_Messaging_%7C_OpenCV_%7C_PyZBar-green.svg)]()

[Tính năng](#-tính-năng) • [Cài đặt & Kích hoạt](#-cài-đặt--kích-hoạt) • [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)

</div>

---

## 🎯 2 Tính năng cốt lõi (Core Features)

1. **Smart QR & Barcode Engine (Siêu tốc & Tự động tắt/bật):**
   - **Tự động khởi động & tắt ngầm (Zero-Touch):** Không tốn RAM thường trực, snap xong tự giải phóng 100% tài nguyên.
   - **Định vị vùng chứa QR (ROI Localization):** Tự động phát hiện và căn góc mã QR ngay cả khi chụp toàn bộ màn hình lớn hoặc nền phức tạp.
   - **Tốc độ cực nhanh:** Thời gian giải mã chỉ **~30ms**.

2. **DocUnlocker — Mở khóa & Tải tài liệu Scribd, StuDocu (100% Client-side):**
   - **Scribd Downloader:** Tự động chuyển sang chế độ Embed sạch, cuộn nạp tất cả các trang và xuất ra file PDF nguyên bản vector/text sắc nét.
   - **StuDocu Downloader & Unblur:** Gỡ bỏ hoàn toàn lớp làm mờ CSS (`filter: blur`), xóa banner paywall, mở khóa bôi đen và in PDF trọn vẹn không giới hạn trang.
   - **Nút nổi thông minh (Floating Button):** Tự động xuất hiện nút `⚡ Tải PDF Sạch` ngay góc màn hình khi bạn duyệt Scribd hoặc StuDocu.

---

## 📦 Cài đặt & Kích hoạt

### Bước 1: Kích hoạt tự động khởi động backend (Chỉ làm 1 lần duy nhất)
Nhấp đúp file:
```
setup_auto_backend.bat
```
*(Script sẽ tự động liên kết Extension với Backend thông qua Chrome Native Messaging).*

### Bước 2: Cài đặt Chrome Extension
1. Mở trình duyệt Chrome, truy cập `chrome://extensions/`.
2. Bật công tắc **Developer mode** ở góc trên bên phải.
3. Nhấp **Load unpacked** và chọn thư mục `Snap-Translate-AI-main`.
4. Bật tuỳ chọn *"Allow access to file URLs"* nếu bạn muốn snap trên các file PDF mở cục bộ.

---

## 📖 Hướng dẫn sử dụng

### 1. Snap Quét Mã QR (Alt+X)
1. Bấm `Alt+X` hoặc click icon extension → chọn **Snap Quét QR**.
2. Kéo chuột bao quanh mã QR (vùng chụp có thể rộng hơn, hệ thống tự định vị chính xác).
3. Kết quả giải mã hiển thị tức thì. Bấm **Copy** hoặc **Export .txt**.

### 2. Tải Tài Liệu Scribd / StuDocu
1. Mở trang tài liệu cần tải trên **Scribd** hoặc **StuDocu**.
2. Bấm nút nổi **⚡ Tải PDF Sạch** ở góc dưới bên phải trang web (hoặc mở popup Extension bấm **Tải Tài Liệu**).
3. Hệ thống sẽ tự động cuộn nạp toàn bộ các trang và mở hộp thoại in **"Save as PDF"** của trình duyệt.
