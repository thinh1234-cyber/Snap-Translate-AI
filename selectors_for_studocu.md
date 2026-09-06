# StuDocu DOM Structure & Selectors Reference

Tài liệu tham khảo cấu trúc DOM và bộ chọn (selectors) thực tế của **StuDocu (Next.js Platform)** được trích xuất từ phân tích phần tử trang web.

---

## 1. Phần tử che phủ & Chặn xem (Overlay & Paywall Banners)

Phần tử bay lơ lửng đè lên toàn bộ tài liệu từ trang 2 - 4 trở đi:

### Cấu trúc HTML mẫu (Trích từ `temp.txt`):
```html
<div class="PremiumBannerBlobWrapper-module-scss-module__vHt8Pq__overflowWrapper 
            PremiumBannerBlobWrapper-module-scss-module__vHt8Pq__wideVariant 
            PremiumBanner-module-scss-module__suZeuq__isFloating">
  <div class="PremiumBannerBlobWrapper-module-scss-module__vHt8Pq__blobContainer">
    <svg class="Shapes-module-scss-module__ywr5wa__lime ..."></svg>
    <div class="PremiumBannerBlobWrapper-module-scss-module__vHt8Pq__previewBanner">
      <div class="PremiumBannerHeader-module-scss-module__0oj_xW__header">
        <p>This is a preview</p>
      </div>
      <div class="PremiumBannerSubHeader-module-scss-module__WSQhnq__subHeader">
        <span>Do you want full access?</span>
        <span>unlock all 20 pages</span>
      </div>
      <ul class="PremiumBannerBenefitsList-module-scss-module__89BNpW__benefitsList">...</ul>
      <div class="PremiumBannerButtons-module-scss-module__eeYxrW__premiumBannerButtons">...</div>
    </div>
  </div>
</div>
```

### Bộ chọn Selector cần triệt tiêu:
- `[class*="PremiumBannerBlobWrapper"]`
- `[class*="PremiumBanner"]`
- `[class*="overflowWrapper"]`
- `[class*="isFloating"]`
- `[class*="previewBanner"]`
- `[class*="blobContainer"]`
- `[class*="Shapes-module"]`
- `[class*="paywall"]`
- `#paywall-wrapper`, `.paywall-wrapper`

---

## 2. Cấu trúc Trang & Cơ chế giấu nội dung (Page Management Template)

### Cấu trúc HTML mẫu (Trích từ `temp.txt`):
```html
<div class="p2hv Viewer-module-scss-module__FXsxkq__pageContainer" id="page-container-wrapper" style="transform: scale(1.37418); width: 72.7705%; height: 72.7705%; opacity: 1;">
  <div id="page-container">
    <!-- Trang 1: Hiển thị bình thường -->
    <div data-page-index="0">
      <div class="pf w0 h0">
        <div class="page-content" style="display: block;">
          <div class="pc pc1 w0 h0" style="display:block">
            <img class="bi x0 y0 w1 h1" src="https://doc-assets.studocu.com/.../html/bg1.png">
            <div class="t m0 x1 h2 y1 ...">BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
            ...
          </div>
        </div>
      </div>
    </div>

    <!-- Trang 2 (và các trang bị khóa sau): CẤU TRÚC THỰC TẾ -->
    <div data-page-index="1">
      <!-- Banner quảng cáo dạng inline (cần xóa) -->
      <div class="InlineBanner-module-scss-module__8TVoUq__inlineBannerWrapper banner-wrapper ...">...</div>

      <div class="pf w0 h0">
        <!-- KHUNG CHỨA TRANG 2: StuDocu đặt display:none; filter:blur(2px) -->
        <div class="page-content DocumentPage-module-scss-module__oGQxBa__blurredImageWrapper" 
             style="display:none; filter:blur(2px); user-select:none">
          <!-- Ảnh mờ webp tạm thời -->
          <img alt="blurred_content_of_page_2" 
               src="https://doc-assets.studocu.com/1f6513df.../html/pages/blurred/page2.webp?Policy=..." 
               style="width:100%;height:100%" loading="lazy" fetchpriority="low" decoding="async">
        </div>

        <!-- Banner giải thích đè lên trang: "Why is this page out of focus?" (cần xóa) -->
        <div class="PremiumPageClarificationBanner-module-scss-module__5XZx7G__container">
          <span class="...heading">Why is this page out of focus?</span>
          <p class="...text">This is a Premium document. Become Premium to read the whole document.</p>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 3. Bản chất cơ chế khóa & Lỗ hổng Wildcard CloudFront của StuDocu

1. **Vì sao trang 2 không có text vector riêng biệt?**
   - Với trang 1 (preview), StuDocu nạp đầy đủ DOM vector text (`<div class="t">`).
   - Với trang 2 trở đi, StuDocu không nạp text vector mà chỉ nạp duy nhất một thẻ `blurredImageWrapper` chứa ảnh trang tài liệu `page2.webp` bị làm mờ và gắn `filter: blur(2px)`.
   - **CẢNH BÁO QUAN TRỌNG:** Tuyệt đối **KHÔNG XÓA** `blurredImageWrapper` vì nó chính là phần tử duy nhất chứa nội dung trang 2! Nếu xóa nó, trang 2 sẽ biến mất thành trang trắng rỗng (0px height)!

2. **Lỗ hổng bảo mật CloudFront Wildcard (`*.png`):**
   - Xem chuỗi `Policy` mã hóa Base64 trong link `bg1.png`:
     ```json
     {
       "Statement": [{
         "Resource": "https://doc-assets.studocu.com/1f6513df1590a3fa1c69cf97768d6a28/html/*.png",
         "Condition": { "DateLessThan": { "AWS:EpochTime": 1788786193 } }
       }]
     }
     ```
   - **Tài nguyên được cấp phép:** `.../html/*.png` chứa ký tự đại diện `*` (Wildcard)!
   - **Hệ quả:** Chữ ký số AWS CloudFront đi kèm `bg1.png` có hiệu lực hợp lệ cho **mọi trang khác** (`bg2.png`, `bg3.png`, `bg4.png`...)!
   - Chúng ta chỉ việc lấy chuỗi query `?Policy=...&Signature=...&Key-Pair-Id=...` từ `bg1.png` và ghép vào `bg2.png` là trình duyệt nạp được 100% ảnh gốc siêu nét không bị làm mờ!

---

## 4. Chiến lược Mở khóa & Xuất PDF Đột phá (Dựa trên kiến trúc `studocuhack`)

1. **Quy tắc đánh số Hexadecimal của StuDocu (`bg{HEX}.png`):**
   - StuDocu đặt tên file ảnh nền trang bằng **hệ cơ số 16 (Hexadecimal)**:
     - Trang 1-9: `bg1.png` ... `bg9.png`
     - Trang 10: `bga.png`
     - Trang 11: `bgb.png`
     - Trang 16: `bg10.png`
   - Thuật toán trích xuất: `pageNum.toString(16)`.

2. **Trích xuất chữ ký số từ `window.__NEXT_DATA__`:**
   - Next.js chèn toàn bộ dữ liệu xác thực vào thẻ `<script id="__NEXT_DATA__">`.
   - Thuộc tính `props.pageProps.documentAccess.signedQueryParams` chứa trực tiếp các chuỗi ký hiệu hợp lệ (`sp.png`, `sp.global`, `sp.blurredPage`) và `objectKey`.
   - Có fallback tự động quét thẻ `img.bi` từ DOM nếu script bị can thiệp.

3. **Thu thập trang gia tăng (Incremental Page Capture):**
   - Bộ render React của StuDocu tự động **hủy mount (unmount)** các trang bị cuộn ra khỏi khung nhìn.
   - Do đó, thuật toán cuộn lần lượt từng thẻ `.pf`, đợi DOM ổn định (`waitForPageReady`) và `cloneNode(true)` ngay lập tức trước khi React kịp gỡ bỏ.

4. **Nhúng ảnh trực tiếp dưới dạng Base64 Data URI (`embedImages`):**
   - Toàn bộ ảnh nền HD và ảnh minh họa được tải bất đồng bộ (concurrency = 6) và chuyển đổi thành `data:image/png;base64,...`.
   - **Lợi ích:** Tránh 100% lỗi CORS, không bao giờ hết hạn chữ ký CloudFront, và Chrome Print Preview luôn hiển thị tức thì, không bị ảnh trắng.

5. **Modal Xem trước & In cách ly (`#snap-studocu-modal`):**
   - Toàn bộ các trang đã mở khóa được ghép vào một khung in `.p2hv` bên trong Modal toàn màn hình `#snap-studocu-modal`.
   - Khi gọi `window.print()`:
     ```css
     @media print {
       body > *:not(#snap-studocu-modal) { display: none !important; }
       #snap-studocu-modal { position: static !important; background: #fff !important; }
       #snap-studocu-modal .snap-modal-bar { display: none !important; }
       #snap-studocu-modal .pf { page-break-after: always !important; }
     }
     ```
   - Chặn 100% rác đề xuất, đánh giá, thanh công cụ và quảng cáo. Bản in PDF xuất ra hoàn toàn tinh khiết.
