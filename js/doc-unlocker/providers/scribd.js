// ═══════════════════════════════════════════════════════════
// PROVIDERS/SCRIBD.JS — Scribd Bypass & PDF Downloader Engine
// Tối ưu hóa toàn diện cho cả tài liệu ngắn lẫn tài liệu lớn (>30-100 trang):
// 1. Chuyển sang clean embed URL: https://www.scribd.com/embeds/{id}/content
// 2. Main World Bridge: Chặn triệt để cơ chế unmount/hiding trang trong window.docManager
// 3. Tải song song tất cả các trang JSONP và nạp đầy đủ ảnh/ký hiệu vector
// 4. Ép buộc 100% outer_page & inner_page hiển thị đầy đủ (không sót bất kỳ trang nào)
// 5. Căn chỉnh trang in chuẩn 100vh, gán snap-last-page để loại bỏ triệt để trang trắng thừa ở cuối
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

      // Bước 2: Kích hoạt Main World Bridge vô hiệu hóa cơ chế ẩn/xóa trang ngầm của Scribd
      this.injectMainWorldBridge();

      // Bước 3: Căn fit page theo chiều dọc của window và chuẩn bị Print CSS
      UI.showProgress("Scribd Downloader", "Đang căn chỉnh tỷ lệ và nạp tài nguyên...");
      const fitScale = this.applyFitVerticalScale();

      // Bước 4: SCROLL QUÉT & NẠP TOÀN BỘ CÁC TRANG
      await this.scrollFullDocument(UI, fitScale);

      // Bước 5: DỌN DẸP & ÉP HIỂN THỊ 100% CẢ OUTER LẪN INNER PAGE
      UI.updateProgress("Đang mở khóa toàn bộ các trang...", 96);
      this.cleanupDOM();

      UI.updateProgress("Hoàn tất nạp 100%! Đang mở hộp thoại in...", 100);

      // Bước 6: Pop up Print
      setTimeout(() => {
        const btn = document.getElementById("snap-doc-floating-btn");
        if (btn) btn.remove();
        const overlay = document.getElementById("snap-doc-overlay");
        if (overlay) overlay.remove();

        // Cuộn về đỉnh trang trước khi in
        window.scrollTo({ top: 0, behavior: "instant" });

        UI.hideProgress();
        window.print();
      }, 600);
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

            // Chặn p.hide() trên từng trang (ngăn unmount DOM)
            if (window.docManager.pages) {
              Object.values(window.docManager.pages).forEach(p => {
                if (p) {
                  p.hide = function() {};
                }
              });
            }
          }

          function forceLoadAll() {
            neutralize();
            if (!window.docManager || !window.docManager.pages) return;
            Object.values(window.docManager.pages).forEach(p => {
              if (p) {
                p.hide = function() {};
                if (typeof p.load === 'function' && !p.loadHasStarted) {
                  try { p.load(); } catch (e) {}
                }
                if (typeof p.display === 'function') {
                  try { p.display(true); } catch (e) {}
                }
              }
            });
          }

          neutralize();
          const timer = setInterval(neutralize, 1000);

          window.addEventListener("SNAP_SCRIBD_LOAD_ALL", forceLoadAll);
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
    },

    // ── Căn fit page theo chiều dọc của window ────────────────
    applyFitVerticalScale() {
      const firstPage = document.querySelector(".outer_page");
      const pageH = (firstPage && firstPage.offsetHeight) ? firstPage.offsetHeight : 1167;
      const targetH = window.innerHeight - 30;
      let fitScale = Math.round((targetH / pageH) * 100) / 100;
      fitScale = Math.min(1, Math.max(0.35, fitScale));

      const docContainer = document.querySelector(".document_container") || document.querySelector(".outer_page_container");
      if (docContainer) {
        docContainer.style.setProperty("zoom", fitScale.toString());
        docContainer.style.setProperty("margin", "0 auto");
      }

      // Khi in ra giấy, sử dụng layout 100vh và snap-last-page chống tràn + chống dư trang trắng
      let printStyle = document.getElementById("snap-scribd-print-scale");
      if (!printStyle) {
        printStyle = document.createElement("style");
        printStyle.id = "snap-scribd-print-scale";
        printStyle.textContent = `
          @media print {
            @page {
              size: auto;
              margin: 0mm;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
              overflow: visible !important;
            }
            .document_container, .outer_page_container {
              margin: 0 !important;
              padding: 0 !important;
              zoom: 1 !important;
              overflow: visible !important;
              width: 100% !important;
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
              max-height: 100vh !important;
              height: 100vh !important;
              width: auto !important;
              overflow: hidden !important;
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
              max-height: 100% !important;
              height: 100% !important;
            }
            .between_page_ads, .between_page_module, .related_docs, .document_cell,
            .toolbar_drop, .mobile_overlay, header, footer, .global_header,
            .bottom_actions, #font_preload_bed {
              display: none !important;
            }
          }
        `;
        document.head.appendChild(printStyle);
      }

      return fitScale;
    },

    // ── Scroll quét trước và chờ nạp 100% trang (cả tài liệu lớn) ──
    async scrollFullDocument(UI, fitScale) {
      const scroller = document.querySelector(".document_scroller");

      // Báo hiệu Main World nạp trước toàn bộ JSONP
      window.dispatchEvent(new CustomEvent("SNAP_SCRIBD_LOAD_ALL"));

      const pages = Array.from(document.querySelectorAll(".outer_page"));
      const total = pages.length || 1;
      const pctScale = Math.round(fitScale * 100);

      // Đánh dấu trang cuối để chống dư 1 trang trắng ở cuối
      if (pages.length > 0) {
        pages[pages.length - 1].classList.add("snap-last-page");
      }

      // Điều chỉnh nhịp quét phù hợp: tài liệu dài quét nhanh hơn
      const delay = total > 25 ? 120 : 280;

      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];
        if (!pageEl) continue;

        // Cuộn trang hiện tại vào tầm nhìn
        pageEl.scrollIntoView({ behavior: "smooth", block: "center" });

        if (scroller) {
          scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
        }

        // Chờ trang render xong .inner_page
        if (!pageEl.querySelector(".inner_page") || pageEl.querySelector(".page_missing, .page_loading")) {
          window.dispatchEvent(new CustomEvent("SNAP_SCRIBD_LOAD_ALL"));
          let waitAttempts = 0;
          while (!pageEl.querySelector(".inner_page") && waitAttempts < 30) {
            await new Promise(r => setTimeout(r, 80));
            waitAttempts++;
          }
        }

        // Đảm bảo các thuộc tính hiển thị trên trang hiện tại
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

        // Nạp và kích hoạt ảnh absimg / công thức
        const pageImgs = Array.from(pageEl.querySelectorAll("img"));
        pageImgs.forEach(img => {
          img.style.setProperty("display", "block", "important");
          img.style.setProperty("visibility", "visible", "important");

          if (!img.src || img.src === window.location.href || img.src.startsWith("data:")) {
            const orig = img.getAttribute("orig") || img.getAttribute("data-orig") || img.getAttribute("data-src");
            if (orig) {
              img.src = orig;
            }
          }
        });

        // Chờ các ảnh chưa nạp xong
        const pendingImgs = pageImgs.filter(img => !img.complete || img.naturalWidth === 0);
        if (pendingImgs.length > 0) {
          await Promise.all(pendingImgs.map(img => {
            return new Promise(resolve => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
              setTimeout(resolve, 800);
            });
          }));
        }

        await new Promise(resolve => setTimeout(resolve, delay));

        const pct = Math.round(((i + 1) / total) * 92);
        if (UI) UI.updateProgress(`Đang quét nạp trang ${i + 1} / ${total} (Fit ${pctScale}%)...`, pct);
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
      // 1. Gửi tín hiệu Main World ép hiển thị toàn bộ trang
      window.dispatchEvent(new CustomEvent("SNAP_SCRIBD_LOAD_ALL"));

      // 2. Xóa class "document_scroller" để layout bung tự do theo đúng hướng dẫn tài liệu
      const scroller = document.querySelector(".document_scroller");
      if (scroller) {
        scroller.classList.remove("document_scroller");
        scroller.style.setProperty("overflow", "visible", "important");
        scroller.style.setProperty("height", "auto", "important");
      }

      // 3. Xóa các div overlay/toolbar rác
      document.querySelectorAll(".toolbar_drop").forEach(el => el.remove());
      document.querySelectorAll(".mobile_overlay").forEach(el => el.remove());
      document.querySelectorAll("#between_page_ads, .between_page_ads, .brand_header, .sticky_header, header, footer, .global_header, .bottom_actions, .related_docs, .document_cell").forEach(el => el.remove());

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
