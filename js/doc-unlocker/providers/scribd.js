// ═══════════════════════════════════════════════════════════
// PROVIDERS/SCRIBD.JS — Scribd Bypass & PDF Downloader Engine
// Implements proven Scribd embed unlocking:
// 1. Clean embed URL converter (https://www.scribd.com/embeds/{id}/content)
// 2. Smooth sequential scroll pass ensuring 100% native page & image hydration
// 3. Precise DOM cleanup: remove document_scroller class, toolbar_drop, mobile_overlay
// 4. Zero-margin, print-color-adjust exact, zero trailing blank pages print formatter
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

      this.waitForAllPagesLoaded((msg, pct) => {
        UI.updateProgress(msg, pct);
      }).then(() => {
        UI.updateProgress("Hoàn tất nạp 100% tài liệu!", 100);
        setTimeout(() => {
          this.preparePrint();
          this.injectPrintStyles();
          UI.hideProgress();
          window.print();
        }, 1000);
      });
    },

    // ── Trigger Scribd Native Image Loader ────────────────────
    triggerNativeLazyLoad(container) {
      const target = container || document;
      const images = target.querySelectorAll("img.absimg, img[orig]");
      images.forEach(img => {
        if (!img.src || img.src === window.location.href) {
          if (window.docManager && typeof window.docManager.lazyLoad === "function") {
            try {
              window.docManager.lazyLoad(img);
            } catch (e) {}
          }
        }
      });
    },

    // ── Ensure 100% of Pages are Loaded (including tail lazy-loaded pages) ──
    waitForAllPagesLoaded(onProgress) {
      const scroller = document.querySelector(".document_scroller") || document.scrollingElement || document.documentElement;
      const pageElements = Array.from(document.querySelectorAll(".outer_page"));
      const total = pageElements.length || 1;

      // 1. Tell Scribd to load any lazy JSONP pages immediately
      if (window.docManager && window.docManager.pages) {
        try {
          Object.values(window.docManager.pages).forEach(page => {
            if (page && !page.loadHasStarted && typeof page.load === "function") {
              page.load();
            }
          });
        } catch (e) {
          console.warn("[SnapDoc] docManager pre-load:", e);
        }
      }

      // 2. Sequential scroll pass at moderate speed (Step 4 from manual guide)
      return new Promise(resolve => {
        let idx = 0;

        const scrollNext = () => {
          if (idx >= pageElements.length) {
            // Finished scrolling all pages! Now verify final hydration
            verifyAllContent();
            return;
          }

          const el = pageElements[idx];
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            if (scroller && typeof scroller.scrollTop === "number") {
              scroller.scrollTop = el.offsetTop;
              scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
            }
            // Navigate via docManager if available
            if (window.docManager && typeof window.docManager.gotoPage === "function") {
              try { window.docManager.gotoPage(idx + 1); } catch (e) {}
            }
          }

          // Trigger native lazy load on this page
          this.triggerNativeLazyLoad(el);

          idx++;
          const pct = Math.round((idx / total) * 60);
          if (onProgress) onProgress(`Đang cuộn nạp trang ${idx} / ${total}...`, pct);

          // Paced at 950ms so Scribd's native observers and network keep up
          setTimeout(scrollNext, 950);
        };

        // 3. Verification loop: ensures all pages and images are completely rendered
        const verifyAllContent = () => {
          let checks = 0;
          const maxChecks = 50; // max ~15 seconds

          const checkInterval = setInterval(() => {
            checks++;

            // Trigger Scribd native lazy load across all pages
            document.querySelectorAll(".outer_page").forEach(pageEl => {
              this.triggerNativeLazyLoad(pageEl);
            });

            // Check if any outer_page is still an empty placeholder
            const pendingPages = pageElements.filter(el => {
              const hasInner = el.querySelector(".page, .newpage, .inner_page, .text_layer, img, svg");
              return !hasInner && el.children.length <= 8;
            });

            // Check if any images are still downloading or haven't decoded
            const allImages = Array.from(document.querySelectorAll(".outer_page img"));
            const pendingImages = allImages.filter(img => {
              if (img.getAttribute("orig") && !img.src) return true;
              return !img.complete || img.naturalWidth === 0;
            });

            const pct = 60 + Math.min(39, Math.round(checks * 0.8));
            if (onProgress) {
              const imgMsg = pendingImages.length > 0 ? ` [đợi ${pendingImages.length} ảnh tải]` : "";
              onProgress(`Đang kiểm tra tài liệu (${total - pendingPages.length}/${total} trang)${imgMsg}...`, pct);
            }

            if ((pendingPages.length === 0 && pendingImages.length === 0) || checks >= maxChecks) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 300);
        };

        scrollNext();
      });
    },

    // ── Prepare Print (Strictly follows Steps 6, 7, 8 from manual guide) ──
    preparePrint() {
      // 1. Remove extension UI overlays to prevent blank page 1
      const btn = document.getElementById("snap-doc-floating-btn");
      if (btn) btn.remove();
      const overlay = document.getElementById("snap-doc-overlay");
      if (overlay) overlay.remove();

      // 2. Step 6: Delete class "document_scroller" from scroller element
      // This converts the fixed-height absolute scroll container into a normal block container
      const scroller = document.querySelector(".document_scroller");
      if (scroller) {
        scroller.classList.remove("document_scroller");
        scroller.style.overflow = "visible";
        scroller.style.height = "auto";
        scroller.style.position = "static";
      }

      // 3. Step 7 & 8: Remove toolbar_drop, mobile_overlay, and ads
      const elementsToDelete = [
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
      elementsToDelete.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });

      // 4. Ensure all pages and layers are visible
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

      // 5. Reset page break on the last page to eliminate trailing blank page
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
