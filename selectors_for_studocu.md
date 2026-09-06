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

## 4. Chiến lược Mở khóa & Xuất PDF Hoàn hảo

1. **Hiển thị lại khung trang & gỡ bỏ Blur filter:**
   - Đặt `.page-content, [class*="blurredImageWrapper"], .pf, .pc { display: block !important; visibility: visible !important; filter: none !important; opacity: 1 !important; }`.
2. **Loại bỏ triệt để các Banner che khuất:**
   - Xóa `[class*="InlineBanner"]`.
   - Xóa `[class*="PremiumPageClarificationBanner"]` ("Why is this page out of focus?").
   - Xóa `[class*="PremiumBanner"]`, `[class*="BlobWrapper"]`, `[class*="overflowWrapper"]`.
   - Xóa `#visible-content-bottom-section` (khối feedback cuối trang).
3. **Thay thế ảnh mờ Webp bằng ảnh HD Gốc (`bg{N}.png`):**
   - Trích xuất `bgTemplate` và signed query params từ `bg1.png`.
   - Với mọi thẻ `img` đang load `blurred/page{N}.webp`, trỏ `src` sang `bg{N}.png?{signed_params}`.
4. **Chuẩn hóa In ấn Print Stylesheet (`@media print`):**
   - Phân trang chuẩn xác theo `#page-container > [data-page-index]` với `page-break-after: always;`.
   - Giữ nguyên ảnh gốc sắc nét, ẩn các thanh công cụ, banner và nút floating.
