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
        }, 1200);
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

    // ── Force Hydrate Every Image (Resolves orig -> src) ──────
    forceHydrateAllImages() {
      const images = Array.from(document.querySelectorAll(".outer_page img, .image_layer img, img.absimg, img[orig], img[data-src]"));
      images.forEach(img => {
        const orig = img.getAttribute("orig") || img.getAttribute("data-src") || img.getAttribute("data-orig");
        
        // If image has no src or has empty src, resolve it from orig
        if (orig && (!img.src || img.src === window.location.href || img.src.startsWith("data:image/svg") || img.src === "")) {
          let resolvedUrl = "";
          if (window.docManager && typeof window.docManager.subImageSrc === "function") {
            try {
              resolvedUrl = window.docManager.subImageSrc(orig);
            } catch (e) {}
          }
          if (!resolvedUrl) {
            const base = orig.replace("http://html.scribd.com", "https://html.scribdassets.com");
            resolvedUrl = (window.docManager && typeof window.docManager._appendToken === "function")
              ? window.docManager._appendToken(base)
              : base;
          }
          if (resolvedUrl) {
            img.src = resolvedUrl;
          }
        }

        // Also trigger docManager lazyLoad method if present
        if (window.docManager && typeof window.docManager.lazyLoad === "function") {
          try {
            window.docManager.lazyLoad(img);
          } catch (e) {}
        }

        // Force eager display styles
        img.removeAttribute("loading");
        img.setAttribute("loading", "eager");
        img.style.setProperty("display", "block", "important");
        img.style.setProperty("visibility", "visible", "important");
        img.style.setProperty("opacity", "1", "important");

        const parentLayer = img.closest(".image_layer");
        if (parentLayer) {
          parentLayer.style.setProperty("display", "block", "important");
          parentLayer.style.setProperty("visibility", "visible", "important");
          parentLayer.style.setProperty("opacity", "1", "important");
        }
      });
    },

    // ── Prevent Scribd from Culling / Hiding Pages ─────────────
    preventPageCulling() {
      if (!window.docManager) return;

      // 1. Neuter viewManager scroll culling
      if (window.docManager.viewManagers && window.docManager.viewManagers.scroll) {
        window.docManager.viewManagers.scroll._updateDisplayOnPages = function() {};
        window.docManager.viewManagers.scroll.checkAndUpdateVisiblePages = function() {};
        window.docManager.viewManagers.scroll._removeUnusedPages = function() {};
      }

      // 2. Disable viewportManager to prevent scroll/resize callbacks
      if (window.docManager.viewportManager && typeof window.docManager.viewportManager.disable === "function") {
        try {
          window.docManager.viewportManager.disable();
        } catch (e) {}
      }

      // 3. For every registered page: disable hide() and force display(true)
      if (window.docManager.pages) {
        Object.values(window.docManager.pages).forEach(page => {
          if (!page) return;
          page.hide = function() {}; // Disallow hiding
          if (typeof page.display === "function") {
            try { page.display(true); } catch (e) {}
          }
          if (page.containerElem) {
            page.containerElem.classList.remove("not_visible", "placeholder");
            page.containerElem.style.setProperty("display", "block", "important");
            page.containerElem.style.setProperty("visibility", "visible", "important");
          }
          if (page.innerPageElem) {
            page.innerPageElem.style.setProperty("display", "block", "important");
            page.innerPageElem.style.setProperty("visibility", "visible", "important");
            page.innerPageElem.style.setProperty("opacity", "1", "important");
          }
        });
      }
    },

    // ── Ensure 100% of Pages are Loaded (including the last lazy-loaded page) ──
    waitForAllPagesLoaded(onProgress) {
      const scroller = document.querySelector(".document_scroller") || document.scrollingElement || document.documentElement;
      const pageElements = Array.from(document.querySelectorAll(".outer_page"));
      const total = pageElements.length || 1;

      // 1. Actively trigger page.load() on all pages in docManager immediately
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

      // 2. Sequentially scroll each page into view with deliberate delays to trigger observers
      return new Promise(resolve => {
        let idx = 0;

        const scrollNext = () => {
          this.forceHydrateAllImages();

          if (idx >= pageElements.length) {
            // Reached the last page! Neutralize culling before verifying
            this.preventPageCulling();
            verifyContentRendered();
            return;
          }

          const el = pageElements[idx];
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            if (scroller && typeof scroller.scrollTop === "number") {
              scroller.scrollTop = el.offsetTop;
              scroller.dispatchEvent(new Event("scroll"));
            }
            // Micro-scroll after 350ms to kick any stubborn IntersectionObservers
            setTimeout(() => {
              if (scroller && typeof scroller.scrollTop === "number") {
                scroller.scrollTop = el.offsetTop + 10;
                scroller.dispatchEvent(new Event("scroll"));
              }
              this.forceHydrateAllImages();
            }, 350);
          }

          idx++;
          const pct = Math.round((idx / total) * 50);
          if (onProgress) onProgress(`Đang quét nạp trang ${idx} / ${total}...`, pct);

          // Paced at 900ms per page so DOM, JSONP & network keeps up thoroughly
          setTimeout(scrollNext, 900);
        };

        // 3. Verification loop: ensures all pages and all images finish loading
        const verifyContentRendered = () => {
          let checks = 0;
          const maxChecks = 75; // max ~30 seconds headroom for slower networks

          const checkInterval = setInterval(() => {
            checks++;

            // Hydrate images and ensure page visibility on each check cycle
            this.forceHydrateAllImages();
            this.preventPageCulling();

            // Check if any outer_page is still an empty placeholder (only contains the 8 border divs)
            const pendingPages = pageElements.filter(el => {
              const hasInner = el.querySelector(".page, .newpage, .inner_page, .text_layer, img, svg");
              return !hasInner && el.children.length <= 8;
            });

            // Check if any images are still missing src, downloading or haven't decoded
            const allImages = Array.from(document.querySelectorAll(".outer_page img, .image_layer img, img.absimg"));
            const pendingImages = allImages.filter(img => {
              if (!img.src || img.src === window.location.href) return true;
              return !img.complete || img.naturalWidth === 0;
            });

            const pct = 50 + Math.min(49, Math.round(checks * 0.7));
            if (onProgress) {
              const imgStatus = pendingImages.length > 0 ? ` [còn ${pendingImages.length} ảnh đang tải]` : "";
              onProgress(`Đang đợi nạp nội dung & ảnh (${total - pendingPages.length}/${total} trang)${imgStatus}...`, pct);
            }

            if ((pendingPages.length === 0 && pendingImages.length === 0) || checks >= maxChecks) {
              clearInterval(checkInterval);
              // Clean up blurring and culling across the document
              document.querySelectorAll(".blurred_page").forEach(b => b.classList.remove("blurred_page"));
              document.querySelectorAll(".not_visible").forEach(nv => nv.classList.remove("not_visible"));
              this.preventPageCulling();
              this.forceHydrateAllImages();
              resolve();
            }
          }, 400);
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

      // 3. Final hydration & anti-culling pass
      this.preventPageCulling();
      this.forceHydrateAllImages();

      // 4. Remove blurred_page and not_visible classes
      document.querySelectorAll(".blurred_page").forEach(b => b.classList.remove("blurred_page"));
      document.querySelectorAll(".not_visible").forEach(nv => nv.classList.remove("not_visible"));

      // 5. Make scroller overflow visible so all pages render smoothly in print
      const scroller = document.querySelector(".document_scroller");
      if (scroller) {
        scroller.style.overflow = "visible";
        scroller.style.height = "auto";
        scroller.style.position = "static";
      }

      // 6. Eliminate trailing blank page by resetting break on the last page
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
            contain: none !important; /* Overrides Scribd's contain:strict which hides offscreen print elements */
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
          .outer_page .not_visible {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          .outer_page .text_layer,
          .outer_page .image_layer,
          .outer_page .newpage,
          .outer_page .ie_fix {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          .outer_page img,
          .outer_page .absimg {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          .outer_page.blurred_page .image_layer img {
            opacity: 1 !important;
          }
          .outer_page.blurred_page .text_layer {
            text-shadow: none !important;
            color: #000 !important;
          }
          .outer_page.blurred_page .text_layer [style] {
            color: inherit !important;
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
