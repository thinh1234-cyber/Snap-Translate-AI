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

      // 2. Start continuous cleanup loop to delete any paywall/clarification banners
      this.purgeBanners();
      cleanupTimer = setInterval(() => this.purgeBanners(), 250);

      // 3. Scroll through all pages to trigger lazy-load and render all content
      this.scrollAllPages(UI, () => {
        // Final pass: ensure all page contents & HD images are loaded
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
        /* 1. Force reveal all page contents (both vector text & image wrappers) */
        .page-content,
        [class*="blurredImageWrapper"],
        [data-page-index],
        .pf, .pc {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          filter: none !important;
          -webkit-filter: none !important;
        }

        /* 2. Strip all blur filters completely from document */
        div, p, span, img, section, article,
        [class*="blurredImageWrapper"],
        img[alt*="blurred_content"],
        img[src*="/pages/blurred/"],
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

        /* 4. Completely eliminate Paywall Banners & Clarification Cards */
        [class*="InlineBanner"],
        [class*="PremiumPageClarificationBanner"],
        [class*="PremiumBanner"],
        [class*="BlobWrapper"],
        [class*="overflowWrapper"],
        [class*="previewBanner"],
        [class*="isFloating"],
        [class*="blobContainer"],
        [class*="Shapes-module"],
        #paywall, #paywall-wrapper, .paywall, [class*="paywall"],
        [data-test-id*="paywall"], .banner-wrapper,
        div[class*="viewer-banner"], div[id*="banner"],
        div[class*="upsell"], div[class*="Upsell"],
        #premium-page-header,
        #visible-content-bottom-section {
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
      // 1. Delete all known banner elements
      const bannerSelectors = [
        "[class*='InlineBanner']",
        "[class*='PremiumPageClarificationBanner']",
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
        "[class*='Upsell']",
        "#visible-content-bottom-section"
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

      // 3. Force inline display: block on all page contents & swap to HD images
      this.revealAllPages();
    },

    revealAllPages() {
      // Unhide all page-content and blurred wrappers
      document.querySelectorAll(".page-content, [class*='blurredImageWrapper']").forEach(el => {
        el.style.setProperty("display", "block", "important");
        el.style.setProperty("visibility", "visible", "important");
        el.style.setProperty("opacity", "1", "important");
        el.style.setProperty("filter", "none", "important");
        el.style.setProperty("-webkit-filter", "none", "important");
      });

      // Extract CloudFront Wildcard Signature from bg1.png
      let bgTemplatePrefix = null;
      let bgQueryString = "";
      const allImgs = Array.from(document.querySelectorAll("img"));

      for (const img of allImgs) {
        const src = img.src || img.getAttribute("src") || "";
        const match = src.match(/(.*\/)bg([0-9]+)\.png(\?.*)?$/);
        if (match) {
          bgTemplatePrefix = match[1]; // e.g. "https://doc-assets.studocu.com/hash/html/"
          bgQueryString = match[3] || ""; // e.g. "?Policy=...&Signature=...&Key-Pair-Id=..."
          break;
        }
      }

      // Upgrade blurred webp placeholder images to HD bg{N}.png with CloudFront signature
      allImgs.forEach(img => {
        const src = img.src || img.getAttribute("src") || "";
        img.style.setProperty("filter", "none", "important");
        img.style.setProperty("-webkit-filter", "none", "important");
        img.style.setProperty("opacity", "1", "important");

        const blurMatch = src.match(/blurred\/page([0-9]+)\.webp/);
        if (blurMatch && bgTemplatePrefix) {
          const pageIdx = blurMatch[1];
          const hdUrl = `${bgTemplatePrefix}bg${pageIdx}.png${bgQueryString}`;
          if (img.dataset.swappedHd !== "true") {
            img.dataset.swappedHd = "true";
            const testImg = new Image();
            testImg.onload = () => {
              img.src = hdUrl;
            };
            testImg.src = hdUrl;
          }
        }
      });
    },

    // ── Auto-scroll all document pages ────────────────────────
    scrollAllPages(UI, onComplete) {
      let pageElements = Array.from(
        document.querySelectorAll("#page-container > [data-page-index]")
      );
      if (!pageElements.length) {
        pageElements = Array.from(document.querySelectorAll("[data-page-index]"));
      }
      if (!pageElements.length) {
        pageElements = Array.from(document.querySelectorAll(".pf"));
      }

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

          // Ensure child real page-content or image wrapper is visible
          el.querySelectorAll(".page-content, [class*='blurredImageWrapper']").forEach(content => {
            content.style.setProperty("display", "block", "important");
            content.style.setProperty("filter", "none", "important");
            content.style.setProperty("visibility", "visible", "important");
          });

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
            max-width: 100% !important;
            transform: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #page-container > [data-page-index],
          [data-page-index] {
            page-break-after: always !important;
            break-after: page !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 auto !important;
            width: 100% !important;
            display: block !important;
            visibility: visible !important;
            height: auto !important;
          }
          .page-content,
          [class*="blurredImageWrapper"],
          .pf, .pc {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            filter: none !important;
          }
          img {
            filter: none !important;
            opacity: 1 !important;
          }
          nav, header, footer, aside, .sidebar, #sidebar, [class*="sidebar"],
          [class*="InlineBanner"],
          [class*="PremiumPageClarificationBanner"],
          [class*="PremiumBanner"], [class*="BlobWrapper"], [class*="previewBanner"],
          [class*="isFloating"], [class*="overflowWrapper"], [class*="blobContainer"],
          [class*="Shapes"], [class*="paywall"],
          #visible-content-bottom-section,
          #snap-doc-floating-btn, #snap-doc-overlay {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  };
})();
