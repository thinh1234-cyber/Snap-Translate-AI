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
          UI.hideProgress();
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
        "footer"
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
          @page { size: auto; margin: 0; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            height: auto !important;
          }
          .document_scroller {
            overflow: visible !important;
            height: auto !important;
            position: static !important;
          }
          .outer_page {
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
          }
          .page_missing, .loading_page {
            display: none !important;
          }
          .toolbar_drop, .mobile_overlay, #between_page_ads, .between_page_ads,
          .autogen_class_views_read_autogen_embed_toolbar,
          #snap-doc-floating-btn, #snap-doc-overlay {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  };
})();
