// ═══════════════════════════════════════════════════════════
// PROVIDERS/SCRIBD.JS — Scribd Bypass & PDF Downloader Engine
// Tự động hóa chuẩn theo quy trình thủ công:
// 1. Chuyển sang clean embed URL: https://www.scribd.com/embeds/{id}/content
// 2. Lướt full từ trên xuống dưới để kích hoạt nạp tự nhiên tất cả các trang
// 3. Xóa class document_scroller, xóa toolbar_drop, mobile_overlay và quảng cáo
// 4. Mở popup print (window.print)
// ═══════════════════════════════════════════════════════════

(() => {
  window.__SnapDocScribd = {
    name: "Scribd",

    isMatch(host) {
      return host.includes("scribd.com");
    },

    async execute(UI) {
      const pathname = window.location.pathname;

      // Bước 1: Nếu ở trang xem thường -> Mở Clean Embed URL
      const docMatch = pathname.match(/\/(?:document|doc)\/(\d+)/);
      if (docMatch && !pathname.includes("/embeds/")) {
        const docId = docMatch[1];
        const embedUrl = `https://www.scribd.com/embeds/${docId}/content#snap_autodownload=1`;
        window.open(embedUrl, "_blank");
        return;
      }

      // Bước 2: Ở trang Embed -> Lướt full để nạp hết các trang
      UI.showProgress("Scribd Downloader", "Đang lướt nạp toàn bộ trang tài liệu...");

      await this.scrollFullDocument((msg, pct) => {
        UI.updateProgress(msg, pct);
      });

      UI.updateProgress("Đang dọn dẹp giao diện và chuẩn bị in...", 95);

      // Bước 3: Xóa bla bla (Xóa class document_scroller, toolbar_drop, mobile_overlay...)
      this.cleanupDOM();
      this.injectPrintStyles();

      UI.updateProgress("Hoàn tất! Đang mở hộp thoại in...", 100);

      // Bước 4: Pop up Print
      setTimeout(() => {
        UI.hideProgress();
        window.print();
      }, 600);
    },

    // ── Lướt full từ trên xuống dưới ──────────────────────────
    async scrollFullDocument(onProgress) {
      const scroller = document.querySelector(".document_scroller") || document.scrollingElement || document.documentElement;

      // Khởi động nạp các trang nếu Scribd docManager sẵn sàng
      if (window.docManager && window.docManager.pages) {
        try {
          Object.values(window.docManager.pages).forEach(page => {
            if (page && !page.loadHasStarted && typeof page.load === "function") {
              page.load();
            }
          });
        } catch (e) {}
      }

      // Quét tuần tự từng trang .outer_page
      let pages = Array.from(document.querySelectorAll(".outer_page"));
      const total = pages.length || 1;

      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
          if (scroller && typeof scroller.scrollTop === "number") {
            scroller.scrollTop = pageEl.offsetTop;
            scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
          }
          if (window.docManager && typeof window.docManager.gotoPage === "function") {
            try { window.docManager.gotoPage(i + 1); } catch (e) {}
          }
        }

        // Kích hoạt lazyLoad bản địa của Scribd cho ảnh trên trang này nếu có
        if (pageEl) {
          pageEl.querySelectorAll("img.absimg, img[orig]").forEach(img => {
            if (!img.src || img.src === window.location.href) {
              if (window.docManager && typeof window.docManager.lazyLoad === "function") {
                try { window.docManager.lazyLoad(img); } catch (e) {}
              }
            }
          });
        }

        const pct = Math.round(((i + 1) / total) * 85);
        if (onProgress) onProgress(`Đang lướt nạp trang ${i + 1} / ${total}...`, pct);

        // Nhịp lướt vừa phải 800ms để Scribd nạp element
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Cuộn chạm đáy cuối cùng để kích hoạt trang cuối cùng (như trang 4)
      if (scroller && typeof scroller.scrollTop === "number") {
        scroller.scrollTop = scroller.scrollHeight;
        scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      }

      // Đợi thêm 1.2s cho trang cuối ổn định
      await new Promise(resolve => setTimeout(resolve, 1200));
    },

    // ── Xóa bla bla theo đúng hướng dẫn DOCX ───────────────────
    cleanupDOM() {
      // 1. Xóa floating button và overlay của extension để không bị dính vào bản in
      const btn = document.getElementById("snap-doc-floating-btn");
      if (btn) btn.remove();
      const overlay = document.getElementById("snap-doc-overlay");
      if (overlay) overlay.remove();

      // 2. Bước 6: Xóa đúng class "document_scroller"
      // Giúp khung scroller trở thành div tự do, không bị khóa cứng chiều cao và cuộn
      const scroller = document.querySelector(".document_scroller");
      if (scroller) {
        scroller.classList.remove("document_scroller");
        scroller.style.overflow = "visible";
        scroller.style.height = "auto";
        scroller.style.position = "static";
      }

      // 3. Bước 7 & 8: Xóa toolbar_drop, mobile_overlay và các div rác/quảng cáo
      const garbageSelectors = [
        ".toolbar_drop",
        ".mobile_overlay",
        "#between_page_ads",
        ".between_page_ads",
        ".autogen_class_views_read_autogen_embed_toolbar",
        ".brand_header",
        ".sticky_header",
        "header",
        "footer",
        ".global_header",
        ".bottom_actions",
        "#font_preload_bed",
        ".page_missing",
        ".loading_page"
      ];
      garbageSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });

      // 4. Đảm bảo tất cả các trang .outer_page đều hiển thị (gỡ not_visible, blurred_page)
      document.querySelectorAll(".outer_page").forEach(pageEl => {
        pageEl.classList.remove("not_visible", "placeholder", "blurred_page");
        pageEl.style.setProperty("display", "block", "important");
        pageEl.style.setProperty("visibility", "visible", "important");
        pageEl.style.setProperty("opacity", "1", "important");
        pageEl.style.setProperty("contain", "none", "important");
      });

      document.querySelectorAll(".newpage, .text_layer, .image_layer, .absimg").forEach(el => {
        el.style.setProperty("display", "block", "important");
        el.style.setProperty("visibility", "visible", "important");
        el.style.setProperty("opacity", "1", "important");
      });

      // 5. Ngắt break trang cuối để không bị dư trang trắng ở cuối file
      const pages = Array.from(document.querySelectorAll(".outer_page"));
      if (pages.length > 0) {
        const lastPage = pages[pages.length - 1];
        lastPage.style.setProperty("page-break-after", "auto", "important");
        lastPage.style.setProperty("break-after", "auto", "important");
      }
    },

    // ── CSS Print Chuẩn ───────────────────────────────────────
    injectPrintStyles() {
      if (document.getElementById("snap-scribd-print-style")) return;

      const style = document.createElement("style");
      style.id = "snap-scribd-print-style";
      style.innerHTML = `
        @media print {
          @page {
            size: portrait;
            margin: 0mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            height: auto !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .auto__embeds_new_show,
          .document_container,
          .outer_page_container {
            overflow: visible !important;
            height: auto !important;
            position: static !important;
            margin: 0 auto !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .outer_page {
            contain: none !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          .outer_page:last-child,
          .outer_page:last-of-type {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .outer_page.not_visible,
          .outer_page .not_visible,
          .outer_page .text_layer,
          .outer_page .image_layer,
          .outer_page .newpage,
          .outer_page .ie_fix,
          .outer_page img,
          .outer_page .absimg {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          .toolbar_drop,
          .mobile_overlay,
          #between_page_ads,
          .between_page_ads,
          #font_preload_bed,
          #snap-doc-floating-btn,
          #snap-doc-overlay {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  };
})();
