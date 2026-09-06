// ═══════════════════════════════════════════════════════════
// PROVIDERS/SCRIBD.JS — Scribd Bypass & PDF Downloader Engine
// Tối ưu hóa toàn diện cho cả tài liệu ngắn lẫn tài liệu lớn (>60 trang):
// 1. Chuyển sang clean embed URL: https://www.scribd.com/embeds/{id}/content
// 2. Chặn triệt để cơ chế ẩn trang ngầm (page hiding/purging) của Scribd
// 3. Tải song song tất cả các trang JSONP và nạp đầy đủ ảnh/ký hiệu
// 4. Ép buộc 100% outer_page & inner_page hiển thị đầy đủ (không sót bất kỳ trang nào)
// 5. Scale fit vertical theo chiều dọc và xuất file PDF chuẩn
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

      // Bước 2: Vô hiệu hóa cơ chế ẩn trang ngầm (unloading / hiding) của Scribd đối với tài liệu lớn
      this.neutralizeScribdPageHider();

      // Bước 3: Căn fit page theo chiều dọc của window
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

    // ── Vô hiệu hóa cơ chế ẩn trang ngầm của Scribd ────────────
    neutralizeScribdPageHider() {
      if (!window.docManager) return;

      // 1. Chặn _updateDisplayOnPages & _removeUnusedPages trên ViewManager
      if (window.docManager._currentViewManager) {
        window.docManager._currentViewManager._updateDisplayOnPages = function() {};
        window.docManager._currentViewManager._removeUnusedPages = function() {};
      }

      // 2. Chặn hàm p.hide() trên từng trang (ngăn Scribd thêm class not_visible và display:none)
      if (window.docManager.pages) {
        Object.values(window.docManager.pages).forEach(p => {
          if (p) {
            p.hide = function() {}; // No-op
          }
        });
      }
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

      // Khi in ra giấy (Ctrl + P), zoom trở về 1 để fill trang giấy chuẩn tỉ lệ A4/Letter
      let printStyle = document.getElementById("snap-scribd-print-scale");
      if (!printStyle) {
        printStyle = document.createElement("style");
        printStyle.id = "snap-scribd-print-scale";
        printStyle.textContent = `
          @media print {
            .document_container { zoom: 1 !important; margin: 0 !important; }
            .not_visible, .blurred_page, .placeholder { display: block !important; visibility: visible !important; }
            .outer_page { break-after: page !important; page-break-after: always !important; display: block !important; visibility: visible !important; }
            .inner_page { display: block !important; visibility: visible !important; }
            .outer_page:last-child { break-after: auto !important; page-break-after: auto !important; }
          }
        `;
        document.head.appendChild(printStyle);
      }

      return fitScale;
    },

    // ── Scroll quét trước và chờ nạp 100% trang (cả tài liệu lớn) ──
    async scrollFullDocument(UI, fitScale) {
      const scroller = document.querySelector(".document_scroller");

      // 1. Kích hoạt tải trước toàn bộ các trang JSONP song song
      if (window.docManager && window.docManager.pages) {
        try {
          Object.values(window.docManager.pages).forEach(page => {
            if (page && !page.loadHasStarted && typeof page.load === "function") {
              page.load();
            }
          });
        } catch (e) {}
      }

      const pages = Array.from(document.querySelectorAll(".outer_page"));
      const total = pages.length || (window.docManager?.pages ? Object.keys(window.docManager.pages).length : 1);
      const pctScale = Math.round(fitScale * 100);

      // Điều chỉnh nhịp quét thông minh theo độ dài tài liệu
      const delay = total > 20 ? 120 : 350;

      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];
        if (!pageEl) continue;

        // Cuộn trang hiện tại vào tầm nhìn
        pageEl.scrollIntoView({ behavior: "smooth", block: "center" });

        if (scroller) {
          scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
        }

        if (window.docManager && typeof window.docManager.gotoPage === "function") {
          try { window.docManager.gotoPage(i + 1); } catch (e) {}
        }

        // Chờ trang render xong .inner_page
        if (!pageEl.querySelector(".inner_page") || pageEl.querySelector(".page_missing, .page_loading")) {
          if (window.docManager && window.docManager.pages) {
            const pageObj = window.docManager.pages[i + 1];
            if (pageObj && typeof pageObj.load === "function" && !pageObj.loadHasStarted) {
              try { pageObj.load(); } catch (e) {}
            }
          }
          let waitAttempts = 0;
          while (!pageEl.querySelector(".inner_page") && waitAttempts < 25) {
            await new Promise(r => setTimeout(r, 80));
            waitAttempts++;
          }
        }

        // Kích hoạt display(true) để hiển thị trang
        if (window.docManager && window.docManager.pages && window.docManager.pages[i + 1]) {
          try { window.docManager.pages[i + 1].display(true); } catch (e) {}
        }

        // Kích hoạt docManager nạp ảnh cho cả trang
        if (window.docManager && typeof window.docManager.loadImages === "function") {
          try { window.docManager.loadImages(pageEl); } catch (e) {}
        }

        // Đảm bảo các thuộc tính hiển thị trên trang hiện tại
        pageEl.classList.remove("not_visible", "blurred_page", "placeholder");
        pageEl.style.setProperty("display", "block", "important");
        pageEl.style.setProperty("visibility", "visible", "important");

        const inner = pageEl.querySelector(".inner_page");
        if (inner) {
          inner.style.setProperty("display", "block", "important");
          inner.style.setProperty("visibility", "visible", "important");
        }

        // Nạp và kích hoạt ảnh absimg / công thức
        const pageImgs = Array.from(pageEl.querySelectorAll("img"));
        pageImgs.forEach(img => {
          img.style.setProperty("display", "block", "important");
          img.style.setProperty("visibility", "visible", "important");

          if (!img.src || img.src === window.location.href || img.src.startsWith("data:")) {
            if (window.docManager && typeof window.docManager.lazyLoad === "function") {
              try { window.docManager.lazyLoad(img); } catch (e) {}
            }
            if (!img.src || img.src === window.location.href || img.src.startsWith("data:")) {
              const orig = img.getAttribute("orig") || img.getAttribute("data-orig") || img.getAttribute("data-src");
              if (orig) {
                if (window.docManager && typeof window.docManager.subImageSrc === "function") {
                  try {
                    const subbed = window.docManager.subImageSrc(orig);
                    if (subbed) img.src = subbed;
                  } catch (e) {}
                }
                if (!img.src || img.src === window.location.href) {
                  img.src = orig;
                }
              }
            }
          }
        });

        // Chờ các ảnh chưa tải nạp xong
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
      await new Promise(resolve => setTimeout(resolve, 800));
    },

    // ── Xóa các element rác & bung toàn bộ các trang 100% ────────
    cleanupDOM() {
      // 1. Tắt ViewportManager để Scribd không tự động ẩn trang khi cuộn về đỉnh
      if (window.docManager && window.docManager.viewportManager && typeof window.docManager.viewportManager.disable === "function") {
        try { window.docManager.viewportManager.disable(); } catch (e) {}
      }

      // 2. Kích hoạt display(true) cho toàn bộ các trang trong docManager
      if (window.docManager && window.docManager.pages) {
        Object.values(window.docManager.pages).forEach(p => {
          try { p.display(true); } catch (e) {}
        });
      }

      // 3. Xóa class "document_scroller" để layout bung tự do
      const scroller = document.querySelector(".document_scroller");
      if (scroller) {
        scroller.classList.remove("document_scroller");
        scroller.style.overflow = "visible";
        scroller.style.height = "auto";
      }

      // 4. Xóa các div overlay/toolbar rác
      document.querySelectorAll(".toolbar_drop").forEach(el => el.remove());
      document.querySelectorAll(".mobile_overlay").forEach(el => el.remove());
      document.querySelectorAll("#between_page_ads, .between_page_ads, .brand_header, .sticky_header, header, footer, .global_header, .bottom_actions").forEach(el => el.remove());

      // 5. Đảm bảo 100% outer_page VÀ inner_page đều display: block
      document.querySelectorAll(".outer_page").forEach(el => {
        el.classList.remove("not_visible", "blurred_page", "placeholder");
        el.style.setProperty("display", "block", "important");
        el.style.setProperty("visibility", "visible", "important");
        el.style.setProperty("opacity", "1", "important");
      });

      document.querySelectorAll(".inner_page").forEach(el => {
        el.style.setProperty("display", "block", "important");
        el.style.setProperty("visibility", "visible", "important");
        el.style.setProperty("opacity", "1", "important");
      });

      // LƯU Ý: Luôn giữ nguyên #font_preload_bed
    }
  };
})();
