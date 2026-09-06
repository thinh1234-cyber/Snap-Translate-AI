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

    <!-- Trang 2 (và các trang sau): StuDocu ẩn bằng style="display: none;"! -->
    <div data-page-index="1">
      <div class="pf w0 h0">
        <div class="page-content" style="display: none;">   <--- [CHÌA KHÓA MỞ KHÓA]
          <div class="pc pc2 w0 h0" style="display:block">
            <img class="bi x0 y0 w1 h1" src="https://doc-assets.studocu.com/.../html/bg2.png" loading="lazy">
            <div class="t m0 x1 h2 y1 ...">BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
            ...
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 3. Phát hiện kỹ thuật cốt lõi (Key Findings)

1. **Nội dung text & ảnh ĐÃ TẢI VỀ 100% trong DOM:**
   - Dữ liệu các trang sau (chữ tiếng Việt, câu hỏi trắc nghiệm, hình vẽ) **không hề bị máy chủ cắt bỏ**.
   - Thẻ `<img class="bi ...">` chứa đúng link ảnh gốc `.../html/bg2.png` của AWS S3/CloudFront.
   - Các thẻ `<div class="t ...">` chứa toàn bộ văn bản gốc đầy đủ dấu thanh.
2. **Cơ chế khóa của StuDocu:**
   - Chỉ đơn giản là đặt inline style: `.page-content { display: none; }`!
   - Thả một khối banner nổi `[class*="PremiumBanner...isFloating"]` che lên trên.
   - Áp dụng CSS `filter: blur(4px);` và `user-select: none;`.
3. **Chiến lược giải mã & Xuất PDF:**
   - Đặt lại tất cả `.page-content` thành `display: block !important; visibility: visible !important;`.
   - Xóa bỏ khối `[class*="PremiumBanner"]` và các SVG blob đè lên.
   - Cho phép `user-select: auto !important;` và `filter: none !important;`.
   - Cuộn kích hoạt nạp ảnh lazy-loading cho các thẻ `<img>`.
   - Inject `@media print` phân trang chuẩn từng thẻ `[data-page-index]` với `page-break-after: always;`.
