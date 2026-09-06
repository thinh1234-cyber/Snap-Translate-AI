// ═══════════════════════════════════════════════════════════
// PROVIDERS/STUDOCU.JS — Advanced StuDocu Unlocker & PDF Engine
// Powered by pdf2htmlEX cloning, Next.js __NEXT_DATA__ extraction,
// Hex-page background reconstruction, and Data-URI image embedding.
// ═══════════════════════════════════════════════════════════

(() => {
  const BANNER_SELECTORS = [
    '[class*="PremiumBannerBlobWrapper"]',
    '[class*="InlineBanner"]',
    '[class*="PremiumPageClarificationBanner"]',
    '[class*="PremiumBanner"]',
    '[class*="BlobWrapper"]',
    '[class*="overflowWrapper"]',
    '[class*="previewBanner"]',
    '[class*="isFloating"]',
    '[class*="blobContainer"]',
    '[class*="Shapes-module"]',
    '[class*="PremiumBadge"]',
    '[class*="premiumBadge"]',
    '[class*="PremiumLabel"]',
    '[class*="premiumLabel"]',
    '[class*="PremiumTag"]',
    '[class*="premiumTag"]',
    '[data-test-selector*="preview"]',
    '#paywall', '#paywall-wrapper', '.paywall-wrapper',
    '#premium-page-header',
    '.banner-wrapper',
    '[class*="viewer-banner"]',
    '[class*="upsell"]',
    '[class*="bottomSectionWrapper"]',
    '[class*="DocumentBottomSection"]',
    '[class*="RatingSection"]',
    '[class*="DocumentEndIndicator"]',
    '[class*="RelatedDocuments"]',
    '[class*="CourseSection"]',
    '#visible-content-bottom-section'
  ];

  window.__SnapDocStudocu = {
    name: "StuDocu",

    isMatch(host) {
      return host.includes("studocu.com") || host.includes("studocu.vn") || host.includes("studeersnel.nl");
    },

    execute(UI) {
      this.purgeBanners();
      this.injectCoreStyles();

      // Launch full document capture and compilation pipeline
      this.generatePDF(UI);
    },

    // ── Document Title ────────────────────────────────────────
    getTitle() {
      const h1 = document.querySelector("h1");
      return h1 ? h1.textContent.trim() : (document.title || "studocu_document");
    },

    // ── Continuous Banner & Paywall Purge ─────────────────────
    purgeBanners() {
      BANNER_SELECTORS.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach(el => el.remove());
        } catch (e) {}
      });
    },

    // ── Inject Core Unblur & Visibility Styles ────────────────
    injectCoreStyles() {
      if (document.getElementById("snap-studocu-core-style")) return;

      const style = document.createElement("style");
      style.id = "snap-studocu-core-style";
      style.innerHTML = `
        .page-content,
        [class*="blurred"],
        [class*="Blurred"],
        .pf, .pc {
          filter: none !important;
          -webkit-filter: none !important;
          opacity: 1 !important;
          visibility: visible !important;
          user-select: auto !important;
          -webkit-user-select: auto !important;
          pointer-events: auto !important;
          clip-path: none !important;
          -webkit-clip-path: none !important;
          mask-image: none !important;
          -webkit-mask-image: none !important;
        }

        .pf img, .page-content img {
          filter: none !important;
          -webkit-filter: none !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        /* Hide all banners and paywalls on the main page */
        [class*="PremiumBanner"],
        [class*="InlineBanner"],
        [class*="PremiumPageClarificationBanner"],
        [class*="BlobWrapper"],
        [class*="overflowWrapper"],
        [class*="previewBanner"],
        [class*="isFloating"],
        [class*="Shapes-module"],
        [class*="bottomSectionWrapper"],
        [class*="DocumentBottomSection"],
        [class*="RatingSection"],
        [class*="DocumentEndIndicator"],
        [class*="RelatedDocuments"],
        [class*="CourseSection"],
        #visible-content-bottom-section {
          display: none !important;
          height: 0 !important;
          overflow: hidden !important;
        }
      `;
      document.head.appendChild(style);
    },

    // ── Extract CloudFront Image Pattern & Signatures ─────────
    getImagePattern() {
      try {
        const nextScript = document.querySelector("#__NEXT_DATA__");
        if (nextScript) {
          const nd = JSON.parse(nextScript.textContent);
          const da = nd.props?.pageProps?.documentAccess;
          const sp = da?.signedQueryParams || {};
          const base = da?.objectKey ? `https://doc-assets.studocu.com/${da.objectKey}` : null;
          const bgParam = (typeof sp.png === "string" && sp.png) ||
                          (typeof sp.global === "string" && sp.global) || "";

          if (base && bgParam) {
            return {
              bgPrefix: `${base}/html/bg`,
              bgSuffix: `.png${bgParam}`
            };
          }
        }
      } catch (e) {
        console.warn("[SnapDoc] Could not read __NEXT_DATA__, using DOM fallback:", e);
      }

      // Fallback: derive pattern from an active high-res image in DOM
      const imgs = document.querySelectorAll(".pf img, img.bi, img[src*='/bg']");
      for (let i = 0; i < imgs.length; i++) {
        const s = imgs[i].src || imgs[i].getAttribute("src") || "";
        if (s.includes("/bg") && s.includes("doc-assets")) {
          const match = s.match(/(.*?\/bg)[0-9a-f]+(\.png\?.*)/i);
          if (match) {
            return {
              bgPrefix: match[1],
              bgSuffix: match[2]
            };
          }
        }
      }
      return null;
    },

    pageRendered(pf) {
      const hasSpans = pf.querySelectorAll("span").length > 3;
      const img = pf.querySelector("img");
      const imgLoaded = img && (img.complete || img.naturalWidth > 0);
      return pf.innerHTML.length > 300 && (hasSpans || imgLoaded);
    },

    waitForPageReady(wrapper) {
      return new Promise(resolve => {
        let lastLen = -1;
        let stable = 0;
        let tries = 0;
        const check = () => {
          const len = wrapper.innerHTML.length;
          if (this.pageRendered(wrapper)) {
            if (len === lastLen) {
              stable++;
            } else {
              stable = 0;
              lastLen = len;
            }
            if (stable >= 3) {
              resolve();
              return;
            }
          }
          if (tries++ > 25) {
            resolve(); // ~3s timeout cap per page for thorough hydration
            return;
          }
          setTimeout(check, 120);
        };
        check();
      });
    },

    // ── Incremental Capture to Defeat Virtualized React Scroller ──
    captureAllPages(onProgress) {
      // Find all page wrappers using [data-page-index] to avoid missing virtualized pages
      let pageWrappers = Array.from(
        document.querySelectorAll("#page-container > [data-page-index]")
      );
      if (!pageWrappers.length) {
        pageWrappers = Array.from(document.querySelectorAll("[data-page-index]"));
      }
      if (!pageWrappers.length) {
        pageWrappers = Array.from(document.querySelectorAll(".pf"));
      }

      const total = pageWrappers.length || 1;
      const captured = [];
      const container = document.getElementById("viewer-wrapper") ||
                        document.getElementById("document-wrapper") ||
                        document.scrollingElement || document.documentElement;
      const savedTop = container ? container.scrollTop : 0;

      return new Promise(resolve => {
        let i = 0;
        const next = () => {
          if (i >= pageWrappers.length) {
            if (container) container.scrollTop = savedTop;
            resolve(captured);
            return;
          }

          const wrapper = pageWrappers[i];

          // 1. Force unhide wrapper and its children BEFORE scrolling
          wrapper.style.setProperty("display", "block", "important");
          wrapper.style.setProperty("visibility", "visible", "important");
          wrapper.style.setProperty("opacity", "1", "important");

          wrapper.querySelectorAll(".page-content, [class*='blurred'], [class*='Blurred'], .pf, .pc").forEach(el => {
            el.style.setProperty("display", "block", "important");
            el.style.setProperty("visibility", "visible", "important");
            el.style.setProperty("opacity", "1", "important");
            el.style.setProperty("filter", "none", "important");
            el.style.setProperty("-webkit-filter", "none", "important");
          });

          // 2. Remove lazy loading on all images inside this page
          wrapper.querySelectorAll("img").forEach(img => {
            img.removeAttribute("loading");
            img.setAttribute("loading", "eager");
            img.style.setProperty("filter", "none", "important");
            img.style.setProperty("opacity", "1", "important");
          });

          // 3. Scroll this page into view to trigger content hydration
          wrapper.scrollIntoView({ behavior: "instant", block: "center" });

          // 4. Wait for page stability and capture
          this.waitForPageReady(wrapper).then(() => {
            const pf = wrapper.classList.contains("pf") ? wrapper : wrapper.querySelector(".pf");
            if (pf) {
              captured.push(pf.cloneNode(true));
            } else {
              captured.push(wrapper.cloneNode(true));
            }

            i++;
            if (onProgress) onProgress(i, total);
            setTimeout(next, 100);
          });
        };
        next();
      });
    },

    // ── Convert Images to Data URIs (Prevents Print 403 & Blank Pages) ──
    fetchDataUri(url) {
      return fetch(url, { credentials: "omit" })
        .then(r => (r.ok ? r.blob() : null))
        .then(blob => {
          if (!blob || blob.size === 0) return null;
          return new Promise(res => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result);
            fr.onerror = () => res(null);
            fr.readAsDataURL(blob);
          });
        })
        .catch(() => null);
    },

    embedImages(root, onProgress) {
      const imgs = Array.from(root.querySelectorAll("img"));
      const targets = imgs.filter(img => {
        const s = img.getAttribute("src") || "";
        return s.includes("doc-assets") || s.includes("/bg");
      });

      const unique = {};
      targets.forEach(img => {
        const src = img.getAttribute("src");
        if (src) unique[src] = true;
      });

      const urls = Object.keys(unique);
      const map = {};
      let next = 0;
      let done = 0;
      const CONCURRENCY = 6;

      return new Promise(resolve => {
        const worker = () => {
          if (next >= urls.length) return Promise.resolve();
          const url = urls[next++];
          return this.fetchDataUri(url).then(dataUri => {
            if (dataUri) map[url] = dataUri;
            done++;
            if (onProgress) onProgress(done, urls.length);
            return worker();
          });
        };

        if (urls.length === 0) {
          resolve();
          return;
        }

        const starters = [];
        for (let c = 0; c < Math.min(CONCURRENCY, urls.length); c++) {
          starters.push(worker());
        }

        Promise.all(starters).then(() => {
          targets.forEach(img => {
            const s = img.getAttribute("src");
            if (map[s]) {
              img.setAttribute("src", map[s]);
              img.removeAttribute("srcset");
            }
          });
          resolve();
        });
      });
    },

    // ── Assemble Pure `.p2hv` Container with HD Images ────────
    assembleContainer(capturedPages, pattern) {
      const container = document.createElement("div");
      container.className = "p2hv";

      capturedPages.forEach((item, idx) => {
        const pf = item.classList.contains("pf") ? item : (item.querySelector(".pf") || item);

        pf.removeAttribute("style");
        // Remove paywall banners and clarification banners
        pf.querySelectorAll("[class*='ClarificationBanner'], [class*='Banner'], [class*='BlobWrapper'], [class*='Shapes']").forEach(e => e.remove());

        // Remove any inline display:none
        pf.querySelectorAll("[style]").forEach(e => {
          const st = e.getAttribute("style") || "";
          if (/display:\s*none/i.test(st)) {
            e.setAttribute("style", st.replace(/display:\s*none/gi, "display:block"));
          }
        });

        // Ensure all page-content and pc layers are visible and unblurred
        pf.querySelectorAll(".page-content, .pc").forEach(pc => {
          pc.style.setProperty("display", "block", "important");
          pc.style.setProperty("visibility", "visible", "important");
          pc.style.setProperty("filter", "none", "important");
          pc.style.setProperty("opacity", "1", "important");
        });

        const pageNum = idx + 1;
        const hexPage = pageNum.toString(16);

        // Always point background image to HD URL with CloudFront wildcard signature
        if (pattern && pattern.bgPrefix && pattern.bgSuffix) {
          let img = pf.querySelector("img.bi") || pf.querySelector("img");
          if (!img) {
            img = document.createElement("img");
            img.className = "bi x0 y0 w1 h1";
            (pf.querySelector(".pc") || pf).appendChild(img);
          }

          const hdUrl = `${pattern.bgPrefix}${hexPage}${pattern.bgSuffix}`;
          img.setAttribute("src", hdUrl);
          img.removeAttribute("srcset");
          img.removeAttribute("data-src");
          img.removeAttribute("loading");
          img.style.setProperty("filter", "none", "important");
          img.style.setProperty("-webkit-filter", "none", "important");
          img.style.setProperty("opacity", "1", "important");
          img.style.setProperty("visibility", "visible", "important");
        }

        container.appendChild(pf);
      });

      return container;
    },

    // ── Inject Print & Overlay Styles (Perfect Centering + Portrait) ──
    injectOverlayStyles() {
      if (document.getElementById("snap-studocu-modal-style")) return;

      const style = document.createElement("style");
      style.id = "snap-studocu-modal-style";
      style.textContent = `
        #snap-studocu-modal {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          max-height: 100vh !important;
          z-index: 2147483647 !important;
          background: #18191c !important;
          overflow-x: hidden !important;
          overflow-y: scroll !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior: contain !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          outline: none !important;
          box-sizing: border-box !important;
        }

        /* ── Modern Custom Visible Scrollbar ── */
        #snap-studocu-modal::-webkit-scrollbar {
          width: 12px !important;
          display: block !important;
        }
        #snap-studocu-modal::-webkit-scrollbar-track {
          background: #18191c !important;
          border-left: 1px solid rgba(255, 255, 255, 0.08) !important;
        }
        #snap-studocu-modal::-webkit-scrollbar-thumb {
          background: #4e515d !important;
          border-radius: 6px !important;
          border: 3px solid #18191c !important;
          min-height: 48px !important;
        }
        #snap-studocu-modal::-webkit-scrollbar-thumb:hover {
          background: #1a73e8 !important;
        }
        #snap-studocu-modal::-webkit-scrollbar-thumb:active {
          background: #1557b0 !important;
        }

        #snap-studocu-modal .snap-modal-bar {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 16px !important;
          background: rgba(24, 25, 28, 0.96) !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: #ffffff !important;
          padding: 10px 24px !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
        }
        #snap-studocu-modal .snap-modal-title-group {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          min-width: 0 !important;
          flex: 1 !important;
        }
        #snap-studocu-modal .snap-badge-logo {
          background: linear-gradient(135deg, #ff6b35, #f7c59f) !important;
          color: #1e1e24 !important;
          font-weight: 800 !important;
          font-size: 11px !important;
          padding: 3px 8px !important;
          border-radius: 6px !important;
          letter-spacing: 0.5px !important;
          text-transform: uppercase !important;
          flex-shrink: 0 !important;
        }
        #snap-studocu-modal .snap-badge-count {
          background: rgba(255, 255, 255, 0.12) !important;
          color: #e0e0e0 !important;
          font-weight: 600 !important;
          font-size: 12px !important;
          padding: 3px 10px !important;
          border-radius: 12px !important;
          flex-shrink: 0 !important;
        }
        #snap-studocu-modal .snap-modal-title {
          font-size: 14px !important;
          font-weight: 600 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          color: #f1f3f4 !important;
        }
        #snap-studocu-modal .snap-modal-actions {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          flex-shrink: 0 !important;
        }
        #snap-studocu-modal button {
          border: none !important;
          border-radius: 8px !important;
          padding: 9px 18px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 8px !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        #snap-studocu-modal .snap-btn-print {
          background: #1a73e8 !important;
          color: #ffffff !important;
          box-shadow: 0 2px 8px rgba(26, 115, 232, 0.4) !important;
        }
        #snap-studocu-modal .snap-btn-print:hover:not(:disabled) {
          background: #1557b0 !important;
          box-shadow: 0 4px 14px rgba(26, 115, 232, 0.6) !important;
          transform: translateY(-1px) !important;
        }
        #snap-studocu-modal .snap-btn-print:active:not(:disabled) {
          transform: translateY(0) !important;
        }
        #snap-studocu-modal .snap-btn-print.ready {
          animation: snap-pulse 2.4s infinite !important;
        }
        @keyframes snap-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(26, 115, 232, 0.7); }
          50% { box-shadow: 0 0 0 8px rgba(26, 115, 232, 0); }
        }
        #snap-studocu-modal .snap-btn-close {
          background: #3c4043 !important;
          color: #ffffff !important;
        }
        #snap-studocu-modal .snap-btn-close:hover {
          background: #5f6368 !important;
        }
        #snap-studocu-modal .snap-modal-loading {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 18px !important;
          height: 75vh !important;
          color: #ffffff !important;
        }
        #snap-studocu-modal .snap-bar-track {
          width: 340px !important;
          height: 10px !important;
          background: #2a2a36 !important;
          border-radius: 6px !important;
          overflow: hidden !important;
        }
        #snap-studocu-modal .snap-bar-fill {
          height: 100% !important;
          width: 0% !important;
          background: linear-gradient(90deg, #1a73e8, #00d2ff) !important;
          transition: width 0.2s !important;
        }

        /* ── Modal Page Layout (Centered & Infinitely Scrollable) ── */
        #snap-studocu-modal .snap-modal-pages {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          width: 100% !important;
          height: auto !important;
          min-height: calc(100vh - 60px) !important;
          padding: 24px 0 100px !important;
          box-sizing: border-box !important;
          overflow: visible !important;
        }
        #snap-studocu-modal .snap-modal-pages .p2hv {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          width: 100% !important;
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
          margin: 0 auto !important;
          padding: 0 !important;
          transform: none !important;
          box-sizing: border-box !important;
        }
        #snap-studocu-modal .snap-modal-pages .pf {
          margin: 18px auto !important;
          background: #ffffff !important;
          box-shadow: 0 6px 30px rgba(0, 0, 0, 0.55) !important;
          border-radius: 2px !important;
          display: block !important;
          filter: none !important;
          opacity: 1 !important;
          position: relative !important;
        }
        #snap-studocu-modal .snap-modal-pages .page-content,
        #snap-studocu-modal .snap-modal-pages .pc {
          display: block !important;
          visibility: visible !important;
          filter: none !important;
          opacity: 1 !important;
        }
        #snap-studocu-modal .snap-modal-pages .pf img {
          filter: none !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        /* ── Isolated Print Stylesheet (Fixes Shifted / Off-Center Bug) ── */
        @media print {
          @page {
            size: portrait;
            margin: 0mm;
          }

          html, body {
            background: #ffffff !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body > *:not(#snap-studocu-modal) {
            display: none !important;
            visibility: hidden !important;
          }

          #snap-studocu-modal {
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }

          #snap-studocu-modal .snap-modal-bar {
            display: none !important;
          }

          #snap-studocu-modal .snap-modal-pages {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }

          #snap-studocu-modal .snap-modal-pages .p2hv {
            width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            display: block !important;
            transform: none !important;
          }

          #snap-studocu-modal .snap-modal-pages .pf {
            margin: 0 auto !important; /* PERFECT HORIZONTAL CENTERING */
            box-shadow: none !important;
            border: none !important;
            page-break-after: always !important;
            break-after: page !important;
            position: relative !important;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            transform: none !important;
            transform-origin: top center !important;
          }

          #snap-studocu-modal .snap-modal-pages .pf:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          #snap-studocu-modal .snap-modal-pages .pf img.bi,
          #snap-studocu-modal .snap-modal-pages .pf [class*="blurred"] img,
          #snap-studocu-modal .snap-modal-pages .pf [class*="Blurred"] img {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            object-fit: fill !important;
          }
        }
      `;
      document.head.appendChild(style);
    },

    // ── Autoscale Engine (Synchronized to First Page Dimensions) ──
    applyAutoscale(container, modalUI) {
      const firstPf = container.querySelector(".pf");
      let origW = 0;
      let origH = 0;

      // 1. Try reading dimensions from the first page element in DOM
      if (firstPf) {
        origW = firstPf.offsetWidth || parseFloat(window.getComputedStyle(firstPf).width);
        origH = firstPf.offsetHeight || parseFloat(window.getComputedStyle(firstPf).height);
      }

      // 2. Fallback to original StuDocu DOM element if available
      if (!origW || !origH) {
        const domPf = document.querySelector("#page-container .pf") || document.querySelector(".pf");
        if (domPf) {
          origW = domPf.offsetWidth || parseFloat(window.getComputedStyle(domPf).width);
          origH = domPf.offsetHeight || parseFloat(window.getComputedStyle(domPf).height);
        }
      }

      // 3. Fallback to first image's natural dimensions if available
      if (!origW || !origH) {
        const firstImg = (firstPf && firstPf.querySelector("img")) || document.querySelector("#page-container img");
        if (firstImg && firstImg.naturalWidth && firstImg.naturalHeight) {
          origW = firstImg.naturalWidth;
          origH = firstImg.naturalHeight;
        }
      }

      // 4. Default fallback: pdf2htmlEX standard A4 dimensions (595.28 x 841.89 pt/px)
      if (!origW || origW <= 0) origW = 595.28;
      if (!origH || origH <= 0) origH = 841.89;

      const isLandscape = origW > origH;

      // Standard A4 printable dimensions in CSS 96-DPI pixels
      // A4 = 210mm x 297mm => (210/25.4)*96 = ~793.7px, (297/25.4)*96 = ~1122.5px
      const targetW = isLandscape ? 1122.5 : 793.7;
      const targetH = isLandscape ? 793.7 : 1122.5;

      const scaleX = targetW / origW;
      const scaleY = targetH / origH;

      // 98.5% safety margin ensures no subpixel overflow creates blank pages
      let scaleFactor = Math.min(scaleX, scaleY) * 0.985;
      scaleFactor = Math.round(scaleFactor * 10000) / 10000;

      console.log(`[SnapDoc] AutoScale synchronized from Page 1: ${scaleFactor} (orig: ${origW}x${origH}, target: ${targetW}x${targetH}, ${isLandscape ? "landscape" : "portrait"})`);

      // Apply single synchronized scale factor to ALL pages across document
      const allPfs = container.querySelectorAll(".pf");
      allPfs.forEach(pf => {
        pf.style.setProperty("zoom", scaleFactor.toString(), "important");
        pf.style.setProperty("margin", "0 auto", "important");
      });

      // Inject / replace dynamic print stylesheet
      const prevDynamic = document.getElementById("snap-studocu-autoscale-style");
      if (prevDynamic) prevDynamic.remove();

      const dynamicStyle = document.createElement("style");
      dynamicStyle.id = "snap-studocu-autoscale-style";
      dynamicStyle.textContent = `
        @media print {
          @page {
            size: ${isLandscape ? "landscape" : "portrait"};
            margin: 0mm;
          }
          #snap-studocu-modal .snap-modal-pages .pf {
            zoom: ${scaleFactor} !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: always !important;
            break-after: page !important;
            position: relative !important;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            transform: none !important;
            transform-origin: top center !important;
          }
          #snap-studocu-modal .snap-modal-pages .pf:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
        #snap-studocu-modal .snap-modal-pages .pf {
          zoom: ${scaleFactor} !important;
        }
      `;
      document.head.appendChild(dynamicStyle);

      // Update button label and badge with precise scale and total count
      if (modalUI && modalUI.printBtn) {
        const pct = Math.round(scaleFactor * 100);
        const oriLabel = isLandscape ? "Khổ Ngang" : "Khổ Dọc";
        modalUI.printBtn.textContent = `🖨️ In / Lưu PDF (${oriLabel} • Fit ${pct}%)`;
        modalUI.printBtn.disabled = false;
        modalUI.printBtn.style.opacity = "1";
        modalUI.printBtn.classList.add("ready");
      }

      if (modalUI && modalUI.pageBadge) {
        modalUI.pageBadge.textContent = `📄 ${allPfs.length} trang`;
      }
    },

    // ── Build In-Tab Modal UI ─────────────────────────────────
    createModal(title) {
      const modal = document.createElement("div");
      modal.id = "snap-studocu-modal";
      modal.setAttribute("tabindex", "0");

      const bar = document.createElement("div");
      bar.className = "snap-modal-bar";

      const titleGroup = document.createElement("div");
      titleGroup.className = "snap-modal-title-group";

      const logo = document.createElement("span");
      logo.className = "snap-badge-logo";
      logo.textContent = "⚡ SnapDoc";

      const titleEl = document.createElement("div");
      titleEl.className = "snap-modal-title";
      titleEl.textContent = title;
      titleEl.setAttribute("title", title);

      const pageBadge = document.createElement("span");
      pageBadge.className = "snap-badge-count";
      pageBadge.textContent = "Đang nạp...";

      titleGroup.appendChild(logo);
      titleGroup.appendChild(titleEl);
      titleGroup.appendChild(pageBadge);

      const actions = document.createElement("div");
      actions.className = "snap-modal-actions";

      const printBtn = document.createElement("button");
      printBtn.className = "snap-btn-print";
      printBtn.textContent = "⏳ Đang chuẩn bị...";
      printBtn.disabled = true;
      printBtn.style.opacity = "0.5";
      printBtn.addEventListener("click", () => window.print());

      const closeBtn = document.createElement("button");
      closeBtn.className = "snap-btn-close";
      closeBtn.textContent = "✕ Đóng";

      const doClose = () => {
        modal.remove();
        const dynamicStyle = document.getElementById("snap-studocu-autoscale-style");
        if (dynamicStyle) dynamicStyle.remove();
      };
      closeBtn.addEventListener("click", doClose);

      // Smooth mouse wheel handling preventing StuDocu hijack
      modal.addEventListener("wheel", (e) => {
        e.stopPropagation();
        modal.scrollTop += e.deltaY;
      }, { passive: false });

      // Keyboard navigation support
      modal.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          doClose();
        } else if (e.key === "ArrowDown") {
          modal.scrollTop += 90;
          e.preventDefault();
        } else if (e.key === "ArrowUp") {
          modal.scrollTop -= 90;
          e.preventDefault();
        } else if (e.key === "PageDown" || (e.key === " " && !e.shiftKey)) {
          modal.scrollTop += window.innerHeight * 0.85;
          e.preventDefault();
        } else if (e.key === "PageUp" || (e.key === " " && e.shiftKey)) {
          modal.scrollTop -= window.innerHeight * 0.85;
          e.preventDefault();
        }
      });

      actions.appendChild(printBtn);
      actions.appendChild(closeBtn);
      bar.appendChild(titleGroup);
      bar.appendChild(actions);

      const loading = document.createElement("div");
      loading.className = "snap-modal-loading";

      const msg = document.createElement("div");
      msg.style.cssText = "font-size: 16px; font-weight: 500;";
      msg.textContent = "Đang thu thập và mở khóa toàn bộ trang tài liệu...";

      const track = document.createElement("div");
      track.className = "snap-bar-track";
      const fill = document.createElement("div");
      fill.className = "snap-bar-fill";
      track.appendChild(fill);

      const sub = document.createElement("div");
      sub.style.cssText = "font-size: 13px; opacity: 0.8;";
      sub.textContent = "Khởi tạo...";

      loading.appendChild(msg);
      loading.appendChild(track);
      loading.appendChild(sub);

      const pages = document.createElement("div");
      pages.className = "snap-modal-pages";

      modal.appendChild(bar);
      modal.appendChild(loading);
      modal.appendChild(pages);

      return { modal, fill, sub, loading, pages, printBtn, pageBadge };
    },

    // ── Full Pipeline Execution ───────────────────────────────
    generatePDF(UI) {
      const title = this.getTitle();

      if (!document.querySelector(".p2hv") && document.querySelectorAll("[data-page-index]").length === 0) {
        alert("SnapDoc: Không tìm thấy khung tài liệu. Hãy cuộn tài liệu một chút rồi bấm Tải lại nhé.");
        return;
      }

      this.injectOverlayStyles();
      const modalUI = this.createModal(title);
      document.body.appendChild(modalUI.modal);

      const pattern = this.getImagePattern();

      // Step 1: Incremental page capture across all pages
      this.captureAllPages((done, total) => {
        const pct = Math.round((done / total) * 60);
        modalUI.fill.style.width = `${pct}%`;
        modalUI.sub.textContent = `Đang thu thập và unblur trang ${done} / ${total}...`;
        if (modalUI.pageBadge) modalUI.pageBadge.textContent = `${done}/${total} trang`;
        if (UI) UI.updateProgress(`Thu thập trang ${done} / ${total}`, pct);
      })
        .then(capturedPages => {
          if (!capturedPages.length) throw new Error("No pages captured");

          // Step 2: Assemble pure .p2hv container with HD Hex-backgrounds
          const container = this.assembleContainer(capturedPages, pattern);

          // Step 3: Embed all images as Base64 Data URIs
          return this.embedImages(container, (done, total) => {
            const pct = 60 + Math.round((total ? done / total : 1) * 40);
            modalUI.fill.style.width = `${pct}%`;
            modalUI.sub.textContent = `Đang nạp ảnh HD chất lượng cao (${done} / ${total})...`;
            if (UI) UI.updateProgress(`Nạp ảnh HD (${done} / ${total})`, pct);
          }).then(() => container);
        })
        .then(container => {
          modalUI.loading.remove();
          modalUI.pages.appendChild(container);

          // Step 4: Measure Page 1 & Apply Synchronized Autoscale across all pages
          this.applyAutoscale(container, modalUI);

          if (UI) UI.hideProgress();

          // Focus modal for immediate keyboard & wheel scrolling
          setTimeout(() => {
            modalUI.modal.focus();
          }, 100);
        })
        .catch(err => {
          console.error("[SnapDoc] Pipeline failed:", err);
          modalUI.sub.textContent = "Không thể biên dịch tài liệu. Vui lòng thử tải lại trang.";
        });
    }
  };
})();

