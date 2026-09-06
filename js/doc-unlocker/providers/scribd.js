// ═══════════════════════════════════════════════════════════
// PROVIDERS/SCRIBD.JS — Scribd Bypass & PDF Downloader Engine
// Clean embed converter, robust lazy-load scroller & print formatter
// ═══════════════════════════════════════════════════════════

(() => {
  window.__SnapDocScribd = {
    name: "Scribd",

    isMatch(host) {
      return host.includes("scribd.com");
    },

    execute(UI) {
      const pathname = window.location.pathname;

      // Case 1: On regular document page -> Open Clean Embed URL
      const docMatch = pathname.match(/\/(?:document|doc)\/(\d+)/);
      if (docMatch && !pathname.includes("/embeds/")) {
        const docId = docMatch[1];
        const embedUrl = `https://www.scribd.com/embeds/${docId}/content#snap_autodownload=1`;
        window.open(embedUrl, "_blank");
        return;
      }

      // Case 2: In Embed View -> Scroll and Print
      UI.showProgress("Scribd Downloader", "Đang khởi tạo nạp toàn bộ trang...");
      this.cleanDOM();

      this.waitForAllPagesLoaded((msg, pct) => {
        UI.updateProgress(msg, pct);
      }).then(() => {
        UI.updateProgress("Hoàn tất nạp 100% tài liệu!", 100);
        setTimeout(() => {
          this.preparePrint();
          this.injectPrintStyles();
          UI.hideProgress();
          window.print();
        }, 500);
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
        "#font_preload_bed",
        ".page_missing",
        ".loading_page"
      ];

      selectorsToRemove.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });
    },

    // ── Ensure 100% of Pages are Loaded (including the last lazy-loaded page) ──
    waitForAllPagesLoaded(onProgress) {
      const scroller = document.querySelector(".document_scroller") || document.scrollingElement || document.documentElement;
      const pageElements = Array.from(document.querySelectorAll(".outer_page"));
      const total = pageElements.length || 1;

      // 1. If Scribd's DocumentManager is present, actively trigger page.load() on all pages
      if (window.docManager && window.docManager.pages) {
        try {
          Object.values(window.docManager.pages).forEach(page => {
            if (page && !page.loadHasStarted && typeof page.load === "function") {
              page.load();
            }
          });
          const docContainer = document.querySelector(".document_container");
          if (docContainer && typeof window.docManager.observeImages === "function") {
            window.docManager.observeImages(docContainer);
          }
        } catch (e) {
          console.warn("[SnapDoc] docManager force load:", e);
        }
      }

      // 2. Sequentially scroll each page into view to trigger Scribd viewport observers
      return new Promise(resolve => {
        let idx = 0;

        const scrollNext = () => {
          if (idx >= pageElements.length) {
            // Reached the last page! Now wait and verify every page is fully hydrated
            verifyContentRendered();
            return;
          }

          const el = pageElements[idx];
          if (el) {
            el.scrollIntoView({ behavior: "instant", block: "center" });
            if (scroller && typeof scroller.scrollTop === "number") {
              scroller.scrollTop = el.offsetTop;
              scroller.dispatchEvent(new Event("scroll"));
            }
          }

          idx++;
          const pct = Math.round((idx / total) * 70);
          if (onProgress) onProgress(`Đang cuộn nạp trang ${idx} / ${total}...`, pct);

          setTimeout(scrollNext, 350);
        };

        // 3. Verification loop: ensures the last page and all images finish loading
        const verifyContentRendered = () => {
          let checks = 0;
          const maxChecks = 25; // max 5 seconds

          const checkInterval = setInterval(() => {
            checks++;

            // Force eager loading on all images
            document.querySelectorAll(".outer_page img").forEach(img => {
              img.removeAttribute("loading");
              img.setAttribute("loading", "eager");
              img.style.display = "block";
            });

            // Check if any outer_page is still an empty placeholder (only contains the 8 border divs)
            const pendingPages = pageElements.filter(el => {
              const hasInner = el.querySelector(".page, .page_missing, .inner_page, .text_layer, img, svg");
              return !hasInner && el.children.length <= 8;
            });

            // Check if any images are still downloading
            const pendingImages = Array.from(document.querySelectorAll(".outer_page img")).filter(img => !img.complete);

            const pct = 70 + Math.min(29, checks * 2);
            if (onProgress) {
              onProgress(`Đang nạp ảnh & nội dung (${total - pendingPages.length}/${total} trang)...`, pct);
            }

            if ((pendingPages.length === 0 && pendingImages.length === 0) || checks >= maxChecks) {
              clearInterval(checkInterval);
              window.scrollTo(0, 0);
              if (scroller && typeof scroller.scrollTop === "number") scroller.scrollTop = 0;
              resolve();
            }
          }, 200);
        };

        scrollNext();
      });
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

      // 3. Make scroller overflow visible so all pages render smoothly in print
      const scroller = document.querySelector(".document_scroller");
      if (scroller) {
        scroller.style.overflow = "visible";
        scroller.style.height = "auto";
        scroller.style.position = "static";
      }

      // 4. Eliminate trailing blank page by resetting break on the last page
      const pages = Array.from(document.querySelectorAll(".outer_page"));
      if (pages.length > 0) {
        const lastPage = pages[pages.length - 1];
        lastPage.style.setProperty("page-break-after", "auto", "important");
        lastPage.style.setProperty("break-after", "auto", "important");
      }
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
