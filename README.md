<div align="center">

<img src="assets/icon.png" alt="Logo" width="120">

# Snap Decode

> Chrome Extension: Giải mã QR Code thông minh & Mở khóa tải tài liệu (Scribd, StuDocu, SlideShare)

[![Version](https://img.shields.io/badge/version-2.3.0-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![Backend](https://img.shields.io/badge/Backend-Native_Messaging_%7C_OpenCV_%7C_PyZBar-green.svg)]()

[Tính năng](#-tính-năng-cốt-lõi-core-features) • [Cài đặt & Kích hoạt](#-cài-đặt--kích-hoạt) • [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng) • [Lưu ý & Mẹo tối ưu](#-lưu-ý--mẹo-sử-dụng-tối-ưu) • [Cấu hình in ấn](#-cấu-hình-chrome-print-khi-lưu-pdf-chuẩn-cho-tất-cả-web)

</div>

---

## 🎯 Tính năng cốt lõi (Core Features)

### 1. Smart QR & Barcode Engine (Siêu tốc & Zero-Touch)
- **Khởi động & tắt ngầm tự động:** Không chiếm dụng RAM thường trực, snap xong tự giải phóng 100% tài nguyên hệ thống.
- **Định vị vùng chứa QR (ROI Localization):** Tự động nhận diện và căn chỉnh góc quét mã QR ngay cả khi chụp toàn màn hình độ phân giải cao hoặc hậu cảnh phức tạp.
- **Tốc độ vượt trội:** Thời gian giải mã cực nhanh chỉ **~30ms**.

### 2. DocUnlocker — Mở khóa & Tải tài liệu (100% Client-side)
- **Scribd Downloader:** 
  - Tự động chuyển sang chế độ Clean Embed, bảo lưu đầy đủ vector font và nội dung gốc.
  - Hỗ trợ tài liệu lớn (>60 - 100 trang) với pipeline nạp tuần tự, chống nghẽn socket/CDN.
  - Tự động giải quyết ảnh nhúng qua token bảo mật và căn chỉnh tỷ lệ chuẩn A4 (không bị lệch lề, không cắt chữ, không chồng đè text).
- **StuDocu Downloader & Unblur:** 
  - Gỡ bỏ hoàn toàn lớp làm mờ CSS (`filter: blur`), xóa banner paywall, bỏ hạn chế bôi đen/copy.
  - Mở khóa và nạp toàn bộ trang tài liệu trọn vẹn.
- **SlideShare Downloader:** 
  - Tự động quét và nâng cấp toàn bộ slide lên độ phân giải cao nhất **2048px** (`-2048.jpg`).
  - Hỗ trợ cơ chế tải song song (Parallel Stream) cho các bài thuyết trình dài (>80 - 100 slide) với bố cục khổ ngang chuẩn xác.
- **Nút nổi thông minh (Floating Button):** 
  - Tự động hiển thị nút `⚡ Tải PDF Sạch` ngay góc dưới màn hình khi bạn truy cập Scribd, StuDocu hoặc SlideShare.

---

## 📦 Cài đặt & Kích hoạt

### Bước 1: Kích hoạt tự động khởi động backend (Chỉ làm 1 lần duy nhất)
Nhấp đúp file:
```cmd
setup_auto_backend.bat
```
*(Script sẽ tự động đăng ký liên kết Extension với Backend thông qua Chrome Native Messaging).*

### Bước 2: Cài đặt Chrome Extension
1. Mở trình duyệt Chrome, truy cập `chrome://extensions/`.
2. Bật công tắc **Developer mode** ở góc trên bên phải.
3. Nhấp **Load unpacked** và chọn thư mục `Snap-Translate-AI-main`.
4. Bật tuỳ chọn *"Allow access to file URLs"* nếu bạn muốn quét QR trên các file PDF mở cục bộ.

---

## 📖 Hướng dẫn sử dụng

### 1. Quét Mã QR & Barcode (`Alt + X`)
1. Bấm tổ hợp phím `Alt + X` (hoặc click icon Extension trên thanh công cụ → chọn **Snap Quét QR**).
2. Kéo chuột chọn vùng chứa mã QR (vùng chụp có thể rộng hơn, hệ thống tự định vị chính xác mã).
3. Kết quả giải mã hiển thị tức thì: tự động mở liên kết, cho phép **Copy** hoặc **Export .txt**.

### 2. Tải Tài Liệu Scribd / StuDocu / SlideShare
1. Truy cập trang tài liệu cần tải trên **Scribd**, **StuDocu** hoặc **SlideShare**.
2. Nhấp nút nổi **⚡ Tải PDF Sạch** ở góc dưới bên phải màn hình (hoặc mở popup Extension bấm **Tải Tài Liệu**).
3. Chờ thanh tiến trình quét nạp dữ liệu hoàn tất 100%, hộp thoại in của Chrome sẽ tự động xuất hiện.
4. Chọn **Save as PDF** để lưu file về máy.

---

## 💡 Lưu ý & Mẹo sử dụng tối ưu

> [!TIP]
> **Dành cho SlideShare:**
> - Khi bạn đang xem một bài thuyết trình và chuyển sang một bài thuyết trình khác trong cùng tab (chuyển từ Presentation A sang B), hãy **F5 (Reload lại trang)** trước khi bấm nút tải. Thao tác này giúp Extension nạp sạch sẽ metadata và danh sách slide 2048px của bài mới, tránh dùng lại cache của bài trước.

> [!TIP]
> **Dành cho StuDocu:**
> - Khi vừa mở một tài liệu mới, hãy **bấm nút `⚡ Tải PDF Sạch` ngay lập tức** mà không cần cuộn trang thủ công xuống dưới. Việc lướt sâu vào tài liệu trước có thể kích hoạt cơ chế đếm lượt xem và hiện pop-up bắt đăng ký gói Premium của StuDocu.
> - Nếu chẳng may trang đã bị dính pop-up Premium chặn xem từ trước: Chỉ cần **mở link tài liệu đó trong Tab Ẩn danh (Incognito)** hoặc khởi động lại Chrome để tạo phiên (session) mới sạch sẽ là có thể bấm tải bình thường.

> [!TIP]
> **Dành cho Scribd:**
> - Extension đã tự động xử lý chuyển sang link Embed sạch và nạp tuần tự từng nhóm trang. Bạn chỉ cần giữ nguyên tab cho đến khi thanh tiến trình chạy đến 100% và hộp thoại in xuất hiện.

---

## ⚙️ Cấu hình Chrome Print khi Lưu PDF (Chuẩn cho tất cả Web)

Để bản in PDF xuất ra đẹp nhất, không bị viền trắng thừa, căn giữa chuẩn xác và hiển thị đầy đủ 100% hình ảnh / sơ đồ / công thức, hãy thiết lập hộp thoại in của Chrome theo bảng chuẩn bên dưới:

<div align="center">
  <img src="assets/print_config_guide.png" alt="Cấu hình Chrome Print Chuẩn" width="620">
</div>

<br>

| Mục thiết lập | Giá trị chọn | Giải thích & Tác dụng |
|---|---|---|
| **Destination** *(Máy in đích)* | **Save as PDF** | Xuất trực tiếp thành file tài liệu `.pdf`. |
| **Pages** *(Trang)* | **All** | In toàn bộ các trang đã được mở khóa. |
| **Layout** *(Bố cục)* | **Portrait** *(hoặc Landscape)* | Mặc định là **Portrait (Khổ dọc)**. Với slide thuyết trình như SlideShare, chọn `Landscape (Khổ ngang)`. |
| **Paper size** *(Khổ giấy)* | **A4** | Khổ giấy in tiêu chuẩn quốc tế. |
| **Pages per sheet** | **1** | 1 trang tài liệu trên mỗi mặt giấy. |
| **Margins** *(Lề)* | **None** *(Không có)* | Loại bỏ lề trắng thừa của trình duyệt, tài liệu căn giữa tràn viền hoàn hảo. |
| **Scale** *(Tỷ lệ)* | **Default** *(Mặc định)* | Thuật toán AutoFit của SnapDoc đã tự động căn chỉnh tỷ lệ tối ưu cho tài liệu. |
| **Options** *(Tùy chọn)* | ✅ **Background graphics** | **BẮT BUỘC TÍCH CHỌN** để Chrome in đầy đủ ảnh nền HD, màu chữ, công thức và đồ họa. |

> [!NOTE]
> **Trình duyệt tự ghi nhớ:** Chrome sẽ tự động ghi nhớ các tùy chọn này cho những lần in sau, bạn chỉ cần cấu hình chuẩn một lần duy nhất!
