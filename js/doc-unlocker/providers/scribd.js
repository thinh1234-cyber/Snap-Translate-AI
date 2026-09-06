// ═══════════════════════════════════════════════════════════
// PROVIDERS/SCRIBD.JS — Scribd Bypass & PDF Downloader Engine
// Tối ưu hóa toàn diện cho cả tài liệu ngắn lẫn tài liệu lớn (>30-100 trang):
// 1. Chuyển sang clean embed URL: https://www.scribd.com/embeds/{id}/content
// 2. Main World Bridge: Hook trực tiếp vào DocumentManager & Page Prototype:
//    - Chặn hoàn toàn p.hide() và p.remove()
//    - Hook _renderLoadedPage để tự động nạp 100% ảnh absimg (HTTPS + token chuẩn)
//    - Hỗ trợ loadPageRange từng trang an toàn, không gọi lại trang đã load tránh nghẽn socket/CDN ở trang >35
// 3. A4 AutoFit Engine chuẩn xác:
//    - Triệt tiêu inline style transform: scale(...) của Scribd (loại bỏ lỗi double-scaling co nhỏ 35%)
//    - contain: none trên .outer_page loại bỏ lỗi cắt xén in ấn của Chromium
//    - margin: 0 auto cân đối hoàn hảo lề trái/phải, vừa khít 98.5% trang giấy A4
// 4. Gán class snap-last-page triệt tiêu hoàn toàn trang trắng thừa ở cuối
// ═══════════════════════════════════════════════════════════

(() => {
  window.__SnapDocScribd = {
    name: "Scribd",

    isMatch(host) {
      return host.includes("scribd.com");
    },

    async execute(UI) {
      const pathname = window.location.pathname;

      // Bước 1: Nếu đang ở trang xem tài liệu thường -> Mở Clean Embed URL
      const docMatch = pathname.match(/\/(?:document|doc)\/(\d+)/);
      if (docMatch && !pathname.includes("/embeds/")) {
        const docId = docMatch[1];
        const embedUrl = `https://www.scribd.com/embeds/${docId}/content#snap_autodownload=1`;
        window.open(embedUrl, "_blank");
        return;
      }

      // Bước 2: Kích hoạt Main World Bridge can thiệp trực tiếp vào scope thực của Scribd
      this.injectMainWorldBridge();

      // Bước 3: Tính toán tỷ lệ co giãn A4 AutoFit chuẩn xác
      UI.showProgress("Scribd Downloader", "Đang khởi tạo cấu trúc và tính toán tỷ lệ...");
      this.setupAutoFitPrintEngine();

      // Bước 4: PIPELINE TUẦN TỰ NẠP TỪNG TRANG VÀ NẠP TOÀN BỘ ẢNH ABSIMG
      await this.scrollFullDocument(UI);

      // Bước 5: DỌN DẸP & ÉP HIỂN THỊ 100% CẢ OUTER LẪN INNER PAGE
      UI.updateProgress("Đang hoàn tất đóng gói toàn bộ các trang...", 96);
      this.cleanupDOM();

      UI.updateProgress("Hoàn tất nạp 100%! Đang mở hộp thoại in...", 100);

      // Bước 6: Mở hộp thoại in sau nhịp nghỉ ngắn
      setTimeout(() => {
        const btn = document.getElementById("snap-doc-floating-btn");
        if (btn) btn.remove();
        const overlay = document.getElementById("snap-doc-overlay");
        if (overlay) overlay.remove();

        // Cuộn về đỉnh trang trước khi in
        const scroller = document.querySelector(".document_scroller");
        if (scroller) scroller.scrollTop = 0;
        window.scrollTo({ top: 0, behavior: "instant" });

        UI.hideProgress();
        window.print();
      }, 700);
    },

    // ── Main World Bridge: Can thiệp trực tiếp vào scope thực của Scribd ──
    injectMainWorldBridge() {
      if (document.getElementById("snap-scribd-main-bridge")) return;

      const script = document.createElement("script");
      script.id = "snap-scribd-main-bridge";
      script.textContent = `
        (() => {
          function resolveImagesInElem(elem, dm) {
            if (!elem) return;
            const imgs = elem.querySelectorAll("img");
            for (let j = 0; j < imgs.length; j++) {
              const img = imgs[j];
              img.style.setProperty("display", "block", "important");
              img.style.setProperty("visibility", "visible", "important");
              img.style.setProperty("opacity", "1", "important");

              if (dm && typeof dm.lazyLoad === "function") {
                try { dm.lazyLoad(img); } catch (e) {}
              }
              const orig = img.getAttribute("orig") || img.getAttribute("data-orig") || img.getAttribute("data-src");
              if (orig && (!img.src || img.src === window.location.href || img.src.startsWith("data:"))) {
                let u = orig;
                if (dm && typeof dm.subImageSrc === "function") {
                  try { u = dm.subImageSrc(orig) || u; } catch (e) {}
                }
                if (u.startsWith("http://html.scribd.com/")) {
                  u = u.replace("http://html.scribd.com/", "https://html.scribdassets.com/");
                }
                if (dm && typeof dm._appendToken === "function") {
                  try { u = dm._appendToken(u); } catch (e) {}
                }
                img.src = u;
              }
            }
          }

          function hookDocManager() {
            if (!window.docManager) return;

            // 1. Chặn _updateDisplayOnPages & _removeUnusedPages trên ViewManager
            if (window.docManager._currentViewManager) {
              window.docManager._currentViewManager._updateDisplayOnPages = function() {};
              window.docManager._currentViewManager._removeUnusedPages = function() {};
            }

            // 2. Chặn p.hide() và p.remove() trên từng trang
            if (window.docManager.pages) {
              const samplePage = Object.values(window.docManager.pages)[0];
              if (samplePage && samplePage.constructor && samplePage.constructor.prototype) {
                const proto = samplePage.constructor.prototype;

                // Vô hiệu hóa xóa DOM
                proto.remove = function() {};
                proto.hide = function() {};

                // Hook _renderLoadedPage để tự động nạp toàn bộ ảnh ngay khi JSONP render
                if (!proto.__snapHooked) {
                  proto.__snapHooked = true;
                  const origRender = proto._renderLoadedPage;
                  proto._renderLoadedPage = function(content) {
                    origRender.call(this, content);
                    this.displayOn = true;
                    this.displayDirty = false;
                    this._innerPageVisible = true;

                    if (this.containerElem) {
                      this.containerElem.classList.remove("placeholder", "not_visible", "blurred_page");
                      this.containerElem.style.setProperty("display", "block", "important");
                      this.containerElem.style.setProperty("visibility", "visible", "important");
                      this.containerElem.style.setProperty("opacity", "1", "important");
                    }
                    if (this.innerPageElem) {
                      this.innerPageElem.style.setProperty("display", "block", "important");
                      this.innerPageElem.style.setProperty("visibility", "visible", "important");
                      this.innerPageElem.style.setProperty("opacity", "1", "important");
                    }

                    // Tự động nạp toàn bộ ảnh qua Scribd Native API
                    if (this.containerElem && this.docManager) {
                      try {
                        if (typeof this.docManager.loadImages === "function") {
                          this.docManager.loadImages(this.containerElem);
                        }
                        resolveImagesInElem(this.containerElem, this.docManager);
                      } catch (err) {}
                    }
                  };
                }
              }

              // Áp dụng bảo vệ cho tất cả các trang đã tạo
              Object.values(window.docManager.pages).forEach(p => {
                if (p) {
                  p.hide = function() {};
                  p.remove = function() {};
                }
              });
            }
          }

          function loadPageRange(start, end) {
            hookDocManager();
            if (!window.docManager || !window.docManager.pages) return;
            for (let i = start; i <= end; i++) {
              const p = window.docManager.pages[i];
              if (p) {
                p.hide = function() {};
                p.remove = function() {};

                // Nếu trang chưa có DOM: gọi load() nạp JSONP an toàn
                if (!p.innerPageElem) {
                  if (typeof p.load === 'function' && !p.loadHasStarted) {
                    try { p.load(); } catch (e) {}
                  }
                } else {
                  // Trang đã có DOM: đảm bảo hiển thị và kích hoạt ảnh
                  p.displayOn = true;
                  p.displayDirty = false;
                  p._innerPageVisible = true;
                  if (p.containerElem) {
                    p.containerElem.classList.remove("placeholder", "not_visible", "blurred_page");
                    p.containerElem.style.setProperty("display", "block", "important");
                    p.containerElem.style.setProperty("visibility", "visible", "important");
                  }
                  if (p.innerPageElem) {
                    p.innerPageElem.style.setProperty("display", "block", "important");
                    p.innerPageElem.style.setProperty("visibility", "visible", "important");
                  }
                  if (typeof window.docManager.loadImages === "function") {
                    try { window.docManager.loadImages(p.containerElem); } catch (e) {}
                  }
                  resolveImagesInElem(p.containerElem, window.docManager);
                }
              }
            }
          }

          function resolveAll() {
            hookDocManager();
            if (window.docManager && window.docManager.pages) {
              const total = Object.keys(window.docManager.pages).length;
              loadPageRange(1, total);
            }
            if (window.docManager && typeof window.docManager.loadImages === "function") {
              try { window.docManager.loadImages(document.body); } catch (e) {}
            }
            resolveImagesInElem(document.body, window.docManager);
          }

          hookDocManager();
          setInterval(hookDocManager, 500);

          // Lắng nghe sự kiện nạp nhóm trang từ Content Script qua DOM Attribute
          window.addEventListener("SNAP_SCRIBD_LOAD_CHUNK", () => {
            const start = parseInt(document.documentElement.getAttribute("data-snap-chunk-start") || "1", 10);
            const end = parseInt(document.documentElement.getAttribute("data-snap-chunk-end") || "9999", 10);
            loadPageRange(start, end);
          });

          window.addEventListener("SNAP_SCRIBD_LOAD_ALL", resolveAll);
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
    },

    // ── Engine tính toán tỷ lệ A4 AutoFit đối xứng chuẩn xác ──
    setupAutoFitPrintEngine() {
      // Đọc kích thước gốc thực sự của tài liệu từ .newpage hoặc docManager
      // Tránh đọc nhầm width bị Scribd co nhỏ khi hiển thị trên màn hình
      let origW = 901;
      let origH = 1275;

      const newpageEl = document.querySelector(".newpage");
      if (newpageEl) {
        origW = parseInt(newpageEl.style.width, 10) || parseInt(newpageEl.getAttribute("data-orig-width"), 10) || origW;
        origH = parseInt(newpageEl.style.height, 10) || parseInt(newpageEl.getAttribute("data-orig-height"), 10) || origH;
      } else {
        const firstPage = document.querySelector(".outer_page");
        if (firstPage) {
          origW = parseInt(firstPage.style.width, 10) || firstPage.offsetWidth || 901;
          origH = parseInt(firstPage.style.height, 10) || firstPage.offsetHeight || 1275;
        }
      }

      const isLandscape = origW > origH;

      // Tiêu chuẩn in ấn A4 (pixels 96 DPI):
      // Portrait: 793.7 x 1122.5 | Landscape: 1122.5 x 793.7
      const paperW = isLandscape ? 1122.5 : 793.7;
      const paperH = isLandscape ? 793.7 : 1122.5;

      // Tỷ lệ co giãn để vừa khít 98.5% khổ A4 (căn đều lề trên/dưới/trái/phải)
      const scaleX = paperW / origW;
      const scaleY = paperH / origH;
      let printScale = Math.min(scaleX, scaleY) * 0.985;
      printScale = Math.round(printScale * 1000) / 1000;

      // Cập nhật Stylesheet in ấn AutoFit
      const prevPrintStyle = document.getElementById("snap-scribd-print-scale");
      if (prevPrintStyle) prevPrintStyle.remove();

      const printStyle = document.createElement("style");
      printStyle.id = "snap-scribd-print-scale";
      printStyle.textContent = `
        @media print {
          @page {
            size: ${isLandscape ? "landscape" : "portrait"};
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #fff !important;
            overflow: visible !important;
          }
          .auto__embeds_new_show,
          .document_scroller,
          .document_container,
          .outer_page_container {
            position: static !important;
            top: auto !important;
            left: auto !important;
            right: auto !important;
            bottom: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
          }
          .document_container {
            zoom: ${printScale} !important;
          }
          .not_visible, .blurred_page, .placeholder {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            filter: none !important;
          }
          .outer_page.blurred_page .text_layer {
            text-shadow: none !important;
            color: #000 !important;
          }
          .outer_page.blurred_page .text_layer [style] {
            color: inherit !important;
          }
          .outer_page.blurred_page .image_layer img {
            opacity: 1 !important;
          }
          .outer_page {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            contain: none !important;
            margin: 0 auto !important;
            padding: 0 !important;
            width: ${origW}px !important;
            height: ${origH}px !important;
            box-shadow: none !important;
            border: none !important;
            box-sizing: border-box !important;
            background: #fff !important;
          }
          .outer_page.snap-last-page,
          .outer_page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .inner_page, .newpage {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            transform: none !important;
            transform-origin: top left !important;
            width: ${origW}px !important;
            height: ${origH}px !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }
          .image_layer .absimg {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          .between_page_ads, .between_page_module, .related_docs, .document_cell,
          .toolbar_drop, .mobile_overlay, header, footer, .global_header,
          .bottom_actions, #font_preload_bed, .ad_unit, .banner {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(printStyle);
    },

    // ── Pipeline quét nạp theo từng nhóm trang (Chunked Batch Pipeline) ──
    async scrollFullDocument(UI) {
      const scroller = document.querySelector(".document_scroller");
      const pages = Array.from(document.querySelectorAll(".outer_page"));
      const total = pages.length || 1;

      // Đánh dấu trang cuối cùng để CSS không thêm trang trắng thừa
      if (pages.length > 0) {
        pages[pages.length - 1].classList.add("snap-last-page");
      }

      // Xử lý nạp tuần tự theo nhóm 3 trang để tối ưu socket pool và tránh bị CDN rate limit
      const CHUNK_SIZE = 3;

      for (let c = 0; c < pages.length; c += CHUNK_SIZE) {
        const chunkStart = c + 1;
        const chunkEnd = Math.min(pages.length, c + CHUNK_SIZE);

        // Truyền thông tin nhóm trang qua DOM attribute an toàn tuyệt đối qua Chrome worlds
        document.documentElement.setAttribute("data-snap-chunk-start", chunkStart.toString());
        document.documentElement.setAttribute("data-snap-chunk-end", chunkEnd.toString());
        window.dispatchEvent(new CustomEvent("SNAP_SCRIBD_LOAD_CHUNK"));

        for (let i = c; i < chunkEnd; i++) {
          const pageEl = pages[i];
          if (!pageEl) continue;

          // Cuộn trực tiếp document_scroller để kích hoạt viewport của Scribd
          if (scroller) {
            scroller.scrollTop = pageEl.offsetTop;
            scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
          }

          // Chờ trang render xong .inner_page / .newpage (tối đa 4s cho mỗi trang)
          let attempts = 0;
          while (!pageEl.querySelector(".inner_page, .newpage") && attempts < 40) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
            // Nếu chờ 2s mà chưa có, phát lại tín hiệu nạp riêng trang đó
            if (attempts === 20) {
              document.documentElement.setAttribute("data-snap-chunk-start", (i + 1).toString());
              document.documentElement.setAttribute("data-snap-chunk-end", (i + 1).toString());
              window.dispatchEvent(new CustomEvent("SNAP_SCRIBD_LOAD_CHUNK"));
            }
          }

          // Đảm bảo trạng thái hiển thị của khung trang
          pageEl.classList.remove("not_visible", "blurred_page", "placeholder");
          pageEl.style.setProperty("display", "block", "important");
          pageEl.style.setProperty("visibility", "visible", "important");
          pageEl.style.setProperty("opacity", "1", "important");

          const inner = pageEl.querySelector(".inner_page, .newpage");
          if (inner) {
            inner.style.setProperty("display", "block", "important");
            inner.style.setProperty("visibility", "visible", "important");
            inner.style.setProperty("opacity", "1", "important");
            inner.style.setProperty("transform", "none", "important");
          }

          // Ép nạp toàn bộ ảnh .absimg trên trang với domain HTTPS hợp lệ
          const pageImgs = Array.from(pageEl.querySelectorAll("img"));
          pageImgs.forEach(img => {
            img.style.setProperty("display", "block", "important");
            img.style.setProperty("visibility", "visible", "important");

            const orig = img.getAttribute("orig") || img.getAttribute("data-orig") || img.getAttribute("data-src");
            if (orig && (!img.src || img.src === window.location.href || img.src.startsWith("data:"))) {
              let u = orig;
              if (u.startsWith("http://html.scribd.com/")) {
                u = u.replace("http://html.scribd.com/", "https://html.scribdassets.com/");
              }
              img.src = u;
            }
          });

          // Chờ các ảnh hoàn tất nạp (tối đa 600ms)
          const pendingImgs = pageImgs.filter(img => !img.complete || img.naturalWidth === 0);
          if (pendingImgs.length > 0) {
            await Promise.all(pendingImgs.map(img => new Promise(res => {
              img.addEventListener("load", res, { once: true });
              img.addEventListener("error", res, { once: true });
              setTimeout(res, 600);
            })));
          }

          const pct = Math.round(((i + 1) / total) * 94);
          if (UI) UI.updateProgress(`Đang quét nạp trang ${i + 1} / ${total}...`, pct);
        }

        // Nhịp nghỉ ngắn giữa các nhóm
        await new Promise(r => setTimeout(r, 80));
      }

      // Cuộn chạm đáy cuối cùng để kích hoạt trang chót
      if (scroller) {
        scroller.scrollTop = scroller.scrollHeight;
        scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
      await new Promise(resolve => setTimeout(resolve, 400));
    },

    // ── Xóa các element rác & bung toàn bộ các trang 100% ────────
    cleanupDOM() {
      // 1. Gửi tín hiệu Main World ép nạp toàn bộ ảnh và bảo lưu các trang
      window.dispatchEvent(new CustomEvent("SNAP_SCRIBD_LOAD_ALL"));

      // 2. Xóa class "document_scroller" để layout bung tự do
      const scroller = document.querySelector(".document_scroller");
      if (scroller) {
        scroller.classList.remove("document_scroller");
        scroller.style.setProperty("overflow", "visible", "important");
        scroller.style.setProperty("height", "auto", "important");
        scroller.style.setProperty("position", "static", "important");
      }

      // 3. Xóa các div overlay/toolbar/quảng cáo rác
      document.querySelectorAll(".toolbar_drop").forEach(el => el.remove());
      document.querySelectorAll(".mobile_overlay").forEach(el => el.remove());
      document.querySelectorAll("#between_page_ads, .between_page_ads, .brand_header, .sticky_header, header, footer, .global_header, .bottom_actions, .related_docs, .document_cell, .ad_unit, .banner").forEach(el => el.remove());

      // 4. Đảm bảo 100% outer_page VÀ inner_page đều display: block
      const allOuterPages = Array.from(document.querySelectorAll(".outer_page"));
      allOuterPages.forEach((el, idx) => {
        el.classList.remove("not_visible", "blurred_page", "placeholder");
        el.style.setProperty("display", "block", "important");
        el.style.setProperty("visibility", "visible", "important");
        el.style.setProperty("opacity", "1", "important");

        if (idx === allOuterPages.length - 1) {
          el.classList.add("snap-last-page");
        }
      });

      document.querySelectorAll(".inner_page, .newpage").forEach(el => {
        el.style.setProperty("display", "block", "important");
        el.style.setProperty("visibility", "visible", "important");
        el.style.setProperty("opacity", "1", "important");
        el.style.setProperty("transform", "none", "important");
      });

      // 5. Nạp toàn diện ảnh lần chót trên toàn bộ document
      document.querySelectorAll("img").forEach(img => {
        img.style.setProperty("display", "block", "important");
        img.style.setProperty("visibility", "visible", "important");
        const orig = img.getAttribute("orig") || img.getAttribute("data-orig") || img.getAttribute("data-src");
        if (orig && (!img.src || img.src === window.location.href || img.src.startsWith("data:"))) {
          let u = orig;
          if (u.startsWith("http://html.scribd.com/")) {
            u = u.replace("http://html.scribd.com/", "https://html.scribdassets.com/");
          }
          img.src = u;
        }
      });
    }
  };
})();
