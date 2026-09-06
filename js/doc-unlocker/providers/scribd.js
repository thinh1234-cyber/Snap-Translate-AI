// ═══════════════════════════════════════════════════════════
// PROVIDERS/SCRIBD.JS — Scribd Bypass & PDF Downloader Engine
// Tối ưu hóa toàn diện cho cả tài liệu ngắn lẫn tài liệu lớn (>30-100 trang):
// 1. Chuyển sang clean embed URL: https://www.scribd.com/embeds/{id}/content
// 2. Main World Bridge: Chặn triệt để cơ chế unmount/hiding trang trong window.docManager
// 3. Pipeline quét theo nhóm (Chunked Batch Pipeline) chống rớt trang đối với tài liệu lớn (60-100 trang)
// 4. Nạp đầy đủ ảnh/ký hiệu vector/absimg của từng trang
// 5. Căn chỉnh tỷ lệ in ấn A4 (printScale) chuẩn xác, chống cắt xén góc phải và không bị tách đôi trang dọc
// 6. Gán class snap-last-page để loại bỏ triệt để trang trắng thừa ở cuối
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

      // Bước 2: Kích hoạt Main World Bridge can thiệp trực tiếp vào window.docManager
      this.injectMainWorldBridge();

      // Bước 3: Tính toán tỷ lệ co giãn A4 chuẩn xác và cài đặt stylesheet
      UI.showProgress("Scribd Downloader", "Đang khởi tạo cấu trúc và tính toán tỷ lệ...");
      const { printScale, fitScale } = this.applyPrintScaleEngine();

      // Bước 4: PIPELINE QUÉT THEO TỪNG NHÓM (CHUNKED BATCH PIPELINE)
      await this.scrollFullDocument(UI, fitScale);

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
          function neutralize() {
            if (!window.docManager) return;

            // Chặn _updateDisplayOnPages & _removeUnusedPages trên ViewManager
            if (window.docManager._currentViewManager) {
              window.docManager._currentViewManager._updateDisplayOnPages = function() {};
              window.docManager._currentViewManager._removeUnusedPages = function() {};
            }

            // Tắt ViewportManager
            if (window.docManager.viewportManager && typeof window.docManager.viewportManager.disable === 'function') {
              try { window.docManager.viewportManager.disable(); } catch (e) {}
            }

            // Chặn p.hide() và p.remove() trên từng trang để Scribd không bao giờ gỡ bỏ innerPageElem
            if (window.docManager.pages) {
              Object.values(window.docManager.pages).forEach(p => {
                if (p) {
                  p.hide = function() {};
                  p.remove = function() {};
                }
              });
            }
          }

          function loadChunk(start, end) {
            neutralize();
            if (!window.docManager || !window.docManager.pages) return;
            for (let i = start; i <= end; i++) {
              const p = window.docManager.pages[i];
              if (p) {
                p.hide = function() {};
                p.remove = function() {};
                if (typeof p.load === 'function' && !p.loadHasStarted) {
                  try { p.load(); } catch (e) {}
                }
                if (typeof p.display === 'function') {
                  try { p.display(true); } catch (e) {}
                }
                if (p.containerElem && typeof window.docManager.loadImages === 'function') {
                  try { window.docManager.loadImages(p.containerElem); } catch (e) {}
                }
              }
            }
          }

          neutralize();
          setInterval(neutralize, 800);

          window.addEventListener("SNAP_SCRIBD_LOAD_CHUNK", (e) => {
            const detail = e.detail || {};
            loadChunk(detail.start || 1, detail.end || 9999);
          });

          window.addEventListener("SNAP_SCRIBD_LOAD_ALL", () => {
            neutralize();
            if (window.docManager && window.docManager.pages) {
              loadChunk(1, Object.keys(window.docManager.pages).length);
            }
          });
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
    },

    // ── Engine tính toán tỷ lệ A4 chuẩn xác chống cắt góc & chống tách đôi trang ──
    applyPrintScaleEngine() {
      const firstPage = document.querySelector(".outer_page");
      let origW = 901;
      let origH = 1275;

      if (firstPage) {
        origW = firstPage.offsetWidth || parseInt(firstPage.style.width, 10) || 901;
        origH = firstPage.offsetHeight || parseInt(firstPage.style.height, 10) || 1275;
      }

      const isLandscape = origW > origH;

      // Tiêu chuẩn in ấn A4 (pixels 96 DPI):
      // Portrait: 793.7 x 1122.5 | Landscape: 1122.5 x 793.7
      const paperW = isLandscape ? 1122.5 : 793.7;
      const paperH = isLandscape ? 793.7 : 1122.5;

      // Tỷ lệ co giãn để vừa khít cả ngang lẫn dọc tờ A4, có khoảng đệm 2% an toàn
      const scaleX = paperW / origW;
      const scaleY = paperH / origH;
      let printScale = Math.min(scaleX, scaleY) * 0.98;
      printScale = Math.round(printScale * 1000) / 1000;

      // Tỷ lệ hiển thị trên màn hình xem trước
      const targetScreenH = window.innerHeight - 30;
      let fitScale = Math.round((targetScreenH / origH) * 100) / 100;
      fitScale = Math.min(1, Math.max(0.35, fitScale));

      const docContainer = document.querySelector(".document_container") || document.querySelector(".outer_page_container");
      if (docContainer) {
        docContainer.style.setProperty("zoom", fitScale.toString());
        docContainer.style.setProperty("margin", "0 auto");
      }

      // Cập nhật Stylesheet in ấn
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
            background: #fff !important;
            overflow: visible !important;
          }
          .document_container, .outer_page_container {
            zoom: ${printScale} !important;
            margin: 0 auto !important;
            padding: 0 !important;
            width: 100% !important;
            overflow: visible !important;
          }
          .not_visible, .blurred_page, .placeholder {
            display: block !important;
            visibility: visible !important;
          }
          .outer_page {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
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
          .inner_page {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            width: 100% !important;
            height: 100% !important;
          }
          .between_page_ads, .between_page_module, .related_docs, .document_cell,
          .toolbar_drop, .mobile_overlay, header, footer, .global_header,
          .bottom_actions, #font_preload_bed, .ad_unit, .banner {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(printStyle);

      return { printScale, fitScale };
    },

    // ── Pipeline quét nạp theo từng nhóm trang (Chunked Batch Pipeline) ──
    async scrollFullDocument(UI, fitScale) {
      const scroller = document.querySelector(".document_scroller");
      const pages = Array.from(document.querySelectorAll(".outer_page"));
      const total = pages.length || 1;

      // Đánh dấu trang cuối cùng để CSS không thêm trang trắng thừa
      if (pages.length > 0) {
        pages[pages.length - 1].classList.add("snap-last-page");
      }

      // Xử lý theo từng nhóm 5 trang (Batch Size = 5)
      // Giúp không làm nghẽn hàng đợi JSONP và chống bị chặn mạng
      const CHUNK_SIZE = 5;

      for (let c = 0; c < pages.length; c += CHUNK_SIZE) {
        const chunkStart = c + 1;
        const chunkEnd = Math.min(pages.length, c + CHUNK_SIZE);

        // Kích hoạt nạp dữ liệu cho nhóm trang hiện tại qua Main World Bridge
        window.dispatchEvent(new CustomEvent("SNAP_SCRIBD_LOAD_CHUNK", {
          detail: { start: chunkStart, end: chunkEnd }
        }));

        for (let i = c; i < chunkEnd; i++) {
          const pageEl = pages[i];
          if (!pageEl) continue;

          // Cuộn trang vào tầm nhìn
          pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
          if (scroller) {
            scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
          }

          // Chờ trang có .inner_page
          let attempts = 0;
          while (!pageEl.querySelector(".inner_page") && attempts < 50) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
          }

          // Đảm bảo trạng thái hiển thị
          pageEl.classList.remove("not_visible", "blurred_page", "placeholder");
          pageEl.style.setProperty("display", "block", "important");
          pageEl.style.setProperty("visibility", "visible", "important");
          pageEl.style.setProperty("opacity", "1", "important");

          const inner = pageEl.querySelector(".inner_page");
          if (inner) {
            inner.style.setProperty("display", "block", "important");
            inner.style.setProperty("visibility", "visible", "important");
            inner.style.setProperty("opacity", "1", "important");
          }

          // Kích hoạt tất cả ảnh .absimg trên trang
          const pageImgs = Array.from(pageEl.querySelectorAll("img"));
          pageImgs.forEach(img => {
            img.style.setProperty("display", "block", "important");
            img.style.setProperty("visibility", "visible", "important");

            const orig = img.getAttribute("orig") || img.getAttribute("data-orig") || img.getAttribute("data-src");
            if (orig && (!img.src || img.src === window.location.href || img.src.startsWith("data:"))) {
              img.src = orig;
            }
          });

          // Chờ các ảnh hoàn tất nạp
          const pendingImgs = pageImgs.filter(img => !img.complete || img.naturalWidth === 0);
          if (pendingImgs.length > 0) {
            await Promise.all(pendingImgs.map(img => new Promise(res => {
              img.addEventListener("load", res, { once: true });
              img.addEventListener("error", res, { once: true });
              setTimeout(res, 600);
            })));
          }

          const pct = Math.round(((i + 1) / total) * 94);
          if (UI) UI.updateProgress(`Đang quét nạp trang ${i + 1} / ${total} (Nhóm ${Math.floor(c / CHUNK_SIZE) + 1})...`, pct);
        }

        // Nhịp nghỉ ngắn giữa các nhóm trang để trình duyệt ổn định bộ nhớ
        await new Promise(r => setTimeout(r, 150));
      }

      // Cuộn chạm đáy cuối cùng
      if (scroller) {
        scroller.scrollTop = scroller.scrollHeight;
        scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      await new Promise(resolve => setTimeout(resolve, 600));
    },

    // ── Xóa các element rác & bung toàn bộ các trang 100% ────────
    cleanupDOM() {
      // 1. Gửi tín hiệu Main World ép bảo lưu toàn bộ trang
      window.dispatchEvent(new CustomEvent("SNAP_SCRIBD_LOAD_ALL"));

      // 2. Xóa class "document_scroller" để layout bung tự do theo đúng hướng dẫn tài liệu
      const scroller = document.querySelector(".document_scroller");
      if (scroller) {
        scroller.classList.remove("document_scroller");
        scroller.style.setProperty("overflow", "visible", "important");
        scroller.style.setProperty("height", "auto", "important");
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

      document.querySelectorAll(".inner_page").forEach(el => {
        el.style.setProperty("display", "block", "important");
        el.style.setProperty("visibility", "visible", "important");
        el.style.setProperty("opacity", "1", "important");
      });
    }
  };
})();
