<div align="center">

<img src="assets/icon.png" alt="Logo" width="120">

# Snap Decode

> Chrome Extension chụp vùng màn hình QR + OCR

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![Backend](https://img.shields.io/badge/Backend-Native_Messaging_%7C_OpenCV_%7C_RapidOCR-green.svg)]()

[Tính năng](#-tính-năng) • [Cài đặt & Kích hoạt](#-cài-đặt--kích-hoạt) • [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)

</div>

---

## 🎯 Điểm nổi bật & Cơ chế Zero-Touch

**Snap Decode** hỗ trợ cơ chế vận hành **hoàn toàn tự động (Zero-Touch Native Messaging)**:
1. **Tự động khởi động ngầm (Auto-Start):** Khi bạn bấm `Alt+X` hoặc click nút Snap, Chrome sẽ tự động khởi chạy backend xử lý ngầm (không hiện cửa sổ terminal đen, không tốn tài nguyên trước đó).
2. **Tự động tắt hoàn toàn (Auto-Shutdown):** Ngay khi giải mã xong kết quả OCR hoặc QR code, tiến trình backend tự động ngắt và giải phóng 100% RAM cho máy tính.
3. **QR Code Engine (ROI Localization):** Tự động phát hiện và định vị vùng chứa QR code ngay cả khi chụp toàn bộ màn hình lớn hoặc có nền phức tạp.
4. **OCR Engine (RapidOCR ONNX):** Trích xuất chữ tiếng Việt và tiếng Anh chính xác tuyệt đối mà không phụ thuộc trình duyệt.

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

> 💡 **Lưu ý:** Bạn **không cần** chạy `start_backend.bat` nữa! Mỗi khi snap, backend sẽ tự bật ngầm và tự tắt khi xong. (Nếu muốn chạy server HTTP thủ công như trước, bạn vẫn có thể nhấp `start_backend.bat`).

---

## 📖 Hướng dẫn sử dụng

### 1. Snap Trích Xuất Chữ (OCR)
1. Bấm `Alt+X` hoặc click icon extension → chọn **Snap OCR**.
2. Kéo chuột chọn bất kỳ vùng văn bản nào trên màn hình (con trỏ dấu `+` xuất hiện).
3. Chữ sẽ được trích xuất tức thì. Bấm **Copy** hoặc **Export .txt**.

### 2. Snap Đọc Mã QR
1. Click icon extension → chọn **Snap Đọc QR**.
2. Kéo chuột bao quanh mã QR (ảnh chụp có thể rộng hơn, hệ thống tự định vị chính xác).
3. Nội dung mã QR hiển thị ngay lập tức.

---

## 📝 License

MIT — Xem [LICENSE](LICENSE)

<div align="center">
<p>Phát triển bởi <b>Kyle (Nguyễn Thịnh)</b></p>
</div>
