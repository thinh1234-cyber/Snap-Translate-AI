<div align="center">

<img src="/assets/icon.png" alt="Logo" width="120">

# 🚀 SnapTranslate & QR Master

**Một Extension mạnh mẽ kết hợp AI Vision để Dịch thuật và Xử lý QR tức thì.**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/your-repo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome_Extension-green.svg)](https://developer.chrome.com/docs/extensions/)
[![AI-Powered](https://img.shields.io/badge/AI-ChatGPT_%7C_Local_LLM-orange.svg)]()

[Tính năng](#-tính-năng-chính) • [Cài đặt](#-hướng-dẫn-cài-đặt) • [Kiến trúc](#-kiến-trúc-hệ-thống) • [Sử dụng](#-hướng-dẫn-sử-dụng)

</div>

---
<img src="/assets/V1.png" alt="Visualization" width="1000">
## 🌟 Tính năng chính

### 1. 📸 Snap-to-Translate (AI Vision)
* **Chụp vùng chọn:** Quét bất kỳ phần nào trên màn hình trình duyệt.
* **Đa dạng Model:** Hỗ trợ gửi ảnh qua **ChatGPT API (GPT-4o)** hoặc kết nối với **Local AI API** (như Ollama/LocalAI) để đảm bảo quyền riêng tư.
* **Xác thực bảo mật:** Sử dụng **OAuth** để quản lý phiên đăng nhập và bảo vệ dữ liệu người dùng.

### 2. 🔍 Smart QR Reader
* **Giải mã tức thì:** Snap vùng chứa mã QR để đọc nội dung ngay lập tức.
* **Xử lý thông minh:** Tự động nhận diện URL, thông tin Wifi, hoặc văn bản thuần túy.

---

## 🛠 Kiến trúc hệ thống

Dự án được xây dựng với cấu trúc tối ưu cho Chrome Extension:

* **Frontend:** `HTML5`, `CSS3` (Giao diện Popup & Overlay), `JavaScript` (DOM Manipulation).
* **Manifest:** `v3` (Tuân thủ tiêu chuẩn mới nhất của Google).
* **Backend & Auth:**
    * **OAuth:** Xử lý xác thực người dùng.
    * **Server-side:** Relay API để bảo mật API Key.
    * **Local Support:** Kết nối linh hoạt với Local AI API chạy trên máy cá nhân.

---

🚀 Hướng dẫn cài đặt
Tải mã nguồn: git clone https://github.com/thinh1234-cyber/Snap-Translate-AI.git

Mở Chrome: Truy cập đường dẫn chrome://extensions/.

Bật chế độ nhà phát triển: Gạt công tắc Developer mode ở góc trên bên phải.

Load Extension: Nhấn nút Load unpacked và chọn thư mục chứa mã nguồn của bạn.

📖 Hướng dẫn sử dụng
Mở Extension: Nhấn vào icon trên thanh công cụ.

Chọn chế độ:

Bấm "Snap & Translate": Kéo chuột chọn vùng văn bản cần dịch.

Bấm "Read QR": Chọn vùng chứa mã QR.

Kết quả: Bản dịch hoặc nội dung QR sẽ hiển thị ngay trong popup hoặc một thông báo thông minh trên màn hình.

🤝 Đóng góp
Mọi ý đóng góp hoặc báo lỗi vui lòng mở một Issue hoặc tạo Pull Request. Mình rất hoan nghênh các nâng cấp về:

Tích hợp thêm các Local LLM mới.

Cải thiện UI/UX cho phần vùng chọn ảnh.

<div align="center">
<p>Made with ❤️ by <b>Nguyễn Thịnh - Kyle</b></p>
</div>
