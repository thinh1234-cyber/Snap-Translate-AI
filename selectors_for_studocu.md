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

    <!-- Trang 2 (và các trang sau): BẪY 2 LỚP CỦA STUDOCU -->
    <div data-page-index="1">
      <div class="pf w0 h0">
        <!-- LỚP 1 (NỘI DUNG GỐC SẠCH): StuDocu ẩn bằng style="display: none;"! -->
        <div class="page-content" style="display: none;">   <--- [CHÌA KHÓA MỞ KHÓA GỐC]
          <div class="pc pc2 w0 h0" style="display:block">
            <img class="bi x0 y0 w1 h1" src="https://doc-assets.studocu.com/.../html/bg2.png" loading="lazy">
            <div class="t m0 x1 h2 y1 ...">BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
            ...
          </div>
        </div>

        <!-- LỚP 2 (LỚP ẢNH MỜ GIẢ MẠO ĐÈ LÊN): StuDocu inject vào cùng cấp với class .page-content! -->
        <div class="page-content DocumentPage-module-scss-module__oGQxBa__blurredImageWrapper" 
             style="display: block; filter: blur(2px); user-select: none;">
          <img alt="blurred_content_of_page_2" 
               src="https://doc-assets.studocu.com/.../html/pages/blurred/page2.webp?Policy=..." 
               style="width:100%;height:100%" loading="lazy" fetchpriority="low" decoding="async">
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 3. Phân tích bẫy kỹ thuật "Fake Blurred Layer" mới phát hiện

1. **Bẫy trùng Class Name `.page-content`:**
   - Cả nội dung thật VÀ lớp ảnh mờ giả đều mang class `.page-content`.
   - Nếu chỉ viết CSS `.page-content { display: block !important; }` chung chung, cả **2 lớp sẽ cùng hiển thị đè lên nhau**, và lớp ảnh mờ `page2.webp` (vốn có `filter: blur(2px)`) sẽ phủ lên che mất chữ của trang thật!
   - Đặc điểm nhận diện của lớp mờ giả: Mang class chứa chuỗi `blurredImageWrapper` (`DocumentPage-module-scss-module__*__blurredImageWrapper`).

2. **Ảnh thật vs Ảnh mờ từ AWS CDN:**
   - **Ảnh gốc thật:** `.../html/bg{N}.png` nằm gọn trong `<div class="pc"> <img class="bi">`.
   - **Ảnh mờ giả:** `.../html/pages/blurred/page{N}.webp` nằm trong `blurredImageWrapper`.

---

## 4. Bộ Selector hoàn chỉnh để Bypass StuDocu

### A. Bộ chọn tiêu diệt lớp mờ giả (Blurred Image Wrapper):
- `[class*="blurredImageWrapper"]`
- `.page-content[class*="blurredImageWrapper"]`
- `img[alt*="blurred_content"]`
- `img[src*="/pages/blurred/"]`

### B. Bộ chọn tiêu diệt Banner & Paywall:
- `[class*="PremiumBannerBlobWrapper"]`
- `[class*="PremiumBanner"]`
- `[class*="overflowWrapper"]`
- `[class*="isFloating"]`
- `[class*="previewBanner"]`
- `[class*="blobContainer"]`
- `[class*="Shapes-module"]`
- `#paywall`, `#paywall-wrapper`, `.paywall-wrapper`, `[class*="paywall"]`
- `[data-test-id*="paywall"]`

### C. Bộ chọn kích hoạt hiển thị trang thật (Clean Page Content):
- `.page-content:not([class*="blurredImageWrapper"])`
- `[data-page-index] .page-content:not([class*="blurredImageWrapper"])`
- `.pf .page-content:not([class*="blurredImageWrapper"])`
- `.pc` (Page Canvas chứa text layer vector `.t` và background vector `.bi`)
