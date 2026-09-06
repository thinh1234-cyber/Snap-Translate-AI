// ═══════════════════════════════════════════════════════════
// PROVIDERS/SCRIBD.JS — Scribd Bypass & PDF Downloader Engine
// Embed converter, lazy-load scroller & clean print formatter
// ═══════════════════════════════════════════════════════════

(() => {
  window.__SnapDocScribd = {
    name: "Scribd",

    isMatch(host) {
      return host.includes("scribd.com");
    },

    execute(UI) {
      const pathname = window.location.pathname;

      // Case 1: On regular document page -> Open Embed URL
      const docMatch = pathname.match(/\/(?:document|doc)\/(\d+)/);
      if (docMatch && !pathname.includes("/embeds/")) {
        const docId = docMatch[1];
        const embedUrl = `https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll#snap_autodownload=1`;
        window.open(embedUrl, "_blank");
        return;
      }

      // Case 2: In Embed View -> Scroll and Print
      UI.showProgress("Scribd Downloader", "Đang khởi tạo nạp tài liệu...");
      this.cleanDOM();

      this.scrollAllPages(UI, () => {
        UI.updateProgress("Hoàn tất nạp!", 100);
        setTimeout(() => {
          this.preparePrint();
          this.injectPrintStyles();
          window.print();
        }, 800);
      });
    },

    cleanDOM() {
      const selectorsToRemove = [
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
        ".page_missing",
        ".loading_page"
      ];

      selectorsToRemove.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });

      const scroller = document.querySelector(".document_scroller");
      if (scroller) {
        scroller.style.overflow = "visible";
        scroller.style.height = "auto";
        scroller.style.position = "static";
      }

      document.documentElement.style.overflow = "visible";
      document.body.style.overflow = "visible";
    },

    preparePrint() {
      // 1. Remove UI overlays and floating action button to eliminate blank page 1
      const btn = document.getElementById("snap-doc-floating-btn");
      if (btn) btn.remove();
      const overlay = document.getElementById("snap-doc-overlay");
      if (overlay) overlay.remove();

      // 2. Remove known intrusive elements before printing
      const garbageSelectors = [
        ".toolbar_drop",
        ".mobile_overlay",
        "#between_page_ads",
        ".between_page_ads",
        ".autogen_class_views_read_autogen_embed_toolbar",
        "#font_preload_bed",
        ".page_missing",
        ".loading_page"
      ];
      garbageSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });

      // 3. Eliminate trailing blank page by resetting break on the last page
      const pages = Array.from(document.querySelectorAll(".outer_page"));
      if (pages.length > 0) {
        const lastPage = pages[pages.length - 1];
        lastPage.style.setProperty("page-break-after", "auto", "important");
        lastPage.style.setProperty("break-after", "auto", "important");
      }
    },

    scrollAllPages(UI, onComplete) {
      const pages = Array.from(document.querySelectorAll(".outer_page, .page_missing, [data-page]"));
      const totalPages = pages.length || 1;
      let currentIdx = 0;

      const interval = setInterval(() => {
        if (currentIdx >= pages.length) {
          clearInterval(interval);
          window.scrollTo(0, 0);
          onComplete();
          return;
        }

        const pageEl = pages[currentIdx];
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        currentIdx++;
        const percent = Math.min(100, Math.round((currentIdx / totalPages) * 100));
        UI.updateProgress(`Đang nạp trang ${currentIdx} / ${totalPages}...`, percent);
      }, 250);
    },

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
          .document_scroller,
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
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
          }
          .outer_page:last-child,
          .outer_page:last-of-type {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .toolbar_drop,
          .mobile_overlay,
          #between_page_ads,
          .between_page_ads,
          .autogen_class_views_read_autogen_embed_toolbar,
          #font_preload_bed,
          .page_missing,
          .loading_page,
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
