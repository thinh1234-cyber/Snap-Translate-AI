// ═══════════════════════════════════════════════════════════
// PROVIDERS/STUDOCU.JS — StuDocu Bypass & PDF Unlocker Engine
// Specific selectors & unblocking strategies for Next.js StuDocu
// ═══════════════════════════════════════════════════════════

(() => {
  let cleanupTimer = null;

  window.__SnapDocStudocu = {
    name: "StuDocu",

    isMatch(host) {
      return host.includes("studocu.com") || host.includes("studocu.vn");
    },

    execute(UI) {
      UI.showProgress("StuDocu Unlocker", "Đang phá bỏ lớp che phủ & mở khóa các trang...");

      // 1. Permanently inject CSS overrides
      this.injectStyles();

      // 2. Start continuous cleanup loop to delete any newly mounted paywall banners
      this.purgeBanners();
      cleanupTimer = setInterval(() => this.purgeBanners(), 250);

      // 3. Scroll through all pages to trigger lazy-load and render all content
      this.scrollAllPages(UI, () => {
        // Final pass: ensure all page-content elements are visible and clean
        this.revealAllPages();
        this.purgeBanners();

        UI.updateProgress("Hoàn tất mở khóa 100%!", 100);
        setTimeout(() => {
          if (cleanupTimer) clearInterval(cleanupTimer);
          UI.hideProgress();
          this.injectPrintStyles();
          window.print();
        }, 800);
      });
    },

    // ── CSS Injection to Force Visibility & Strip Overlays ─────
    injectStyles() {
      if (document.getElementById("snap-studocu-core-style")) return;

      const style = document.createElement("style");
      style.id = "snap-studocu-core-style";
      style.innerHTML = `
        /* 1. Force reveal all hidden page contents */
        .page-content,
        [data-page-index] .page-content,
        .pf .page-content,
        .pc {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          height: auto !important;
        }

        /* 2. Strip all blur filters */
        div, p, span, img, section, article,
        .blurred-page, [class*="blurred"], [class*="blur-"], [style*="filter: blur"] {
          filter: none !important;
          -webkit-filter: none !important;
          opacity: 1 !important;
        }

        /* 3. Re-enable user text selection */
        html, body, div, p, span, * {
          user-select: auto !important;
          -webkit-user-select: auto !important;
          pointer-events: auto !important;
        }

        /* 4. Completely eliminate the Premium Banner overlay */
        [class*="PremiumBanner"],
        [class*="BlobWrapper"],
        [class*="overflowWrapper"],
        [class*="previewBanner"],
        [class*="isFloating"],
        [class*="blobContainer"],
        [class*="Shapes-module"],
        #paywall, #paywall-wrapper, .paywall, [class*="paywall"],
        [data-test-id*="paywall"], .banner-wrapper, [class*="banner"],
        div[class*="viewer-banner"], div[id*="banner"],
        div[class*="upsell"], div[class*="Upsell"],
        #premium-page-header {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          max-height: 0 !important;
          overflow: hidden !important;
          pointer-events: none !important;
          position: absolute !important;
          top: -9999px !important;
        }
      `;
      document.head.appendChild(style);
    },

    // ── Direct DOM Purge for Banners & Overlays ────────────────
    purgeBanners() {
      // 1. Delete all known banner classes (matching temp.txt findings)
      const bannerSelectors = [
        "[class*='PremiumBanner']",
        "[class*='BlobWrapper']",
        "[class*='previewBanner']",
        "[class*='isFloating']",
        "[class*='overflowWrapper']",
        "[class*='blobContainer']",
        "[class*='Shapes-module']",
        "#paywall",
        "#paywall-wrapper",
        ".paywall-wrapper",
        "#premium-page-header",
        "[class*='paywall']",
        "[data-test-id*='paywall']",
        ".banner-wrapper",
        "[class*='viewer-banner']",
        "[class*='upsell']",
        "[class*='Upsell']"
      ];

      bannerSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          try {
            el.remove();
          } catch (e) {
            el.style.display = "none";
          }
        });
      });

      // 2. Remove sticky/fixed modal overlays inside page container
      const container = document.getElementById("page-container-wrapper") || document.getElementById("document-wrapper") || document.body;
      if (container) {
        container.querySelectorAll("div").forEach(div => {
          try {
            const s = window.getComputedStyle(div);
            if (s.position === "sticky" || s.position === "fixed") {
              const txt = (div.innerText || "").toLowerCase();
              if (txt.includes("premium") || txt.includes("preview") || txt.includes("unlock") || txt.includes("access")) {
                div.remove();
              }
            }
          } catch (e) {}
        });
      }

      // 3. Force inline display: block on all .page-content
      this.revealAllPages();
    },

    revealAllPages() {
      document.querySelectorAll(".page-content").forEach(el => {
        el.style.setProperty("display", "block", "important");
        el.style.setProperty("visibility", "visible", "important");
        el.style.setProperty("opacity", "1", "important");
      });

      // Swap any blurred image URLs to original bg{N}.png
      let bgTemplate = null;
      const allImgs = Array.from(document.querySelectorAll("img"));

      for (const img of allImgs) {
        const match = img.src && img.src.match(/(.*\/)bg[0-9]+\.png(\?.*)?$/);
        if (match) {
          bgTemplate = match[1];
          break;
        }
      }

      if (bgTemplate) {
        allImgs.forEach(img => {
          if (!img.src) return;
          const blurMatch = img.src.match(/blurred\/page([0-9]+)\.webp(\?.*)?$/);
          if (blurMatch) {
            const pageIdx = blurMatch[1];
            img.src = `${bgTemplate}bg${pageIdx}.png`;
          }
        });
      }
    },

    // ── Auto-scroll all document pages ────────────────────────
    scrollAllPages(UI, onComplete) {
      const pageElements = Array.from(
        document.querySelectorAll("[data-page-index], [data-page-no], .pf, .page-container")
      );
      const totalPages = pageElements.length || Math.max(1, Math.floor(document.documentElement.scrollHeight / window.innerHeight));
      let currentIdx = 0;

      const step = () => {
        this.purgeBanners();

        if (currentIdx >= pageElements.length && pageElements.length > 0) {
          window.scrollTo(0, 0);
          onComplete();
          return;
        }

        if (pageElements.length > 0) {
          const el = pageElements[currentIdx];
          el.scrollIntoView({ behavior: "smooth", block: "center" });

          // Ensure child page-content is visible
          const content = el.querySelector(".page-content");
          if (content) {
            content.style.setProperty("display", "block", "important");
          }

          currentIdx++;
          const percent = Math.min(100, Math.round((currentIdx / totalPages) * 100));
          UI.updateProgress(`Đang mở khóa trang ${currentIdx} / ${totalPages}...`, percent);
          setTimeout(step, 300);
        } else {
          // Fallback scroll by viewport
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          if (window.scrollY >= maxScroll) {
            window.scrollTo(0, 0);
            onComplete();
            return;
          }
          window.scrollBy(0, window.innerHeight * 0.85);
          const percent = Math.min(99, Math.round((window.scrollY / maxScroll) * 100));
          UI.updateProgress(`Đang nạp trang... (${percent}%)`, percent);
          setTimeout(step, 300);
        }
      };

      step();
    },

    // ── Print-to-PDF Stylesheet ───────────────────────────────
    injectPrintStyles() {
      if (document.getElementById("snap-studocu-print-style")) return;

      const style = document.createElement("style");
      style.id = "snap-studocu-print-style";
      style.innerHTML = `
        @media print {
          @page { size: auto; margin: 0; }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
          }
          #page-container-wrapper, #page-container, #document-wrapper, .document-wrapper {
            width: 100% !important;
            transform: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          [data-page-index], .pf, .page-container {
            page-break-after: always !important;
            break-after: page !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 auto !important;
            width: 100% !important;
          }
          .page-content, .pc {
            display: block !important;
            visibility: visible !important;
          }
          nav, header, footer, aside, .sidebar, #sidebar, [class*="sidebar"],
          [class*="PremiumBanner"], [class*="BlobWrapper"], [class*="previewBanner"],
          [class*="isFloating"], [class*="overflowWrapper"], [class*="blobContainer"],
          [class*="Shapes"], [class*="paywall"],
          #snap-doc-floating-btn, #snap-doc-overlay {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  };
})();
