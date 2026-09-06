// ═══════════════════════════════════════════════════════════
// PROVIDERS/STUDOCU.JS — Advanced StuDocu Unlocker & PDF Engine
// Powered by pdf2htmlEX cloning, Next.js __NEXT_DATA__ extraction,
// Hex-page background reconstruction, and Data-URI image embedding.
// ═══════════════════════════════════════════════════════════

(() => {
  let cleanupTimer = null;

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

          const pageParams = {};
          if (Array.isArray(sp.pages)) {
            sp.pages.forEach(pg => {
              if (pg?.pageNumber && typeof pg.signedQueryParams === "string") {
                pageParams[pg.pageNumber] = pg.signedQueryParams;
              }
            });
          }

          const blurParam = (typeof sp.blurredPage === "string" && sp.blurredPage) ||
                            (typeof sp.global === "string" && sp.global) || "";

          if (base && bgParam) {
            return {
              bgPrefix: `${base}/html/bg`,
              bgSuffix: `.png${bgParam}`,
              blurPrefix: blurParam ? `${base}/html/pages/blurred/page` : "",
              blurSuffix: `.webp${blurParam}`,
              pageParams: pageParams,
              hasTextLayer: Array.isArray(sp.pages)
            };
          }
        }
      } catch (e) {
        console.warn("[SnapDoc] Could not read __NEXT_DATA__, using DOM fallback:", e);
      }

      // Fallback: derive pattern from an active high-res image in DOM
      const imgs = document.querySelectorAll(".pf img, img.bi, img[src*='/bg']");
      for (let i = 0; i < imgs.length; i++) {
        const s = imgs[i].src || "";
        if (s.includes("/bg") && s.includes("doc-assets")) {
          const match = s.match(/(.*?\/bg)[0-9a-f]+(\.png\?.*)/i);
          if (match) {
            return {
              bgPrefix: match[1],
              bgSuffix: match[2],
              blurPrefix: "",
              blurSuffix: "",
              pageParams: {},
              hasTextLayer: true
            };
          }
        }
      }
      return null;
    },

    deblurUrl(url) {
      if (!url || !url.includes("/blurred/")) return null;
      return url.replace("/pages/blurred/", "/pages/").replace("/blurred/", "/");
    },

    pageRendered(pf) {
      const hasSpans = pf.querySelectorAll("span").length > 3;
      const img = pf.querySelector("img");
      const imgLoaded = img && img.complete && img.naturalWidth > 0;
      return pf.innerHTML.length > 400 && (hasSpans || imgLoaded);
    },

    waitForPageReady(pf) {
      return new Promise(resolve => {
        let lastLen = -1;
        let stable = 0;
        let tries = 0;
        const check = () => {
          const len = pf.innerHTML.length;
          if (this.pageRendered(pf)) {
            if (len === lastLen) {
              stable++;
            } else {
              stable = 0;
              lastLen = len;
            }
            if (stable >= 2) {
              resolve();
              return;
            }
          }
          if (tries++ > 25) {
            resolve();
            return;
          }
          setTimeout(check, 120);
        };
        check();
      });
    },

    // ── Incremental Capture to Defeat Virtualized React Scroller ──
    captureAllPages(onProgress) {
      const pfs = Array.from(document.querySelectorAll(".pf"));
      const container = document.getElementById("viewer-wrapper") ||
                        document.getElementById("document-wrapper") ||
                        document.scrollingElement || document.documentElement;
      const savedTop = container ? container.scrollTop : 0;
      const captured = [];

      return new Promise(resolve => {
        let i = 0;
        const next = () => {
          if (i >= pfs.length) {
            if (container) container.scrollTop = savedTop;
            resolve(captured);
            return;
          }
          const pf = pfs[i];
          pf.scrollIntoView({ behavior: "instant", block: "center" });

          this.waitForPageReady(pf).then(() => {
            captured.push(pf.cloneNode(true));
            i++;
            if (onProgress) onProgress(i, pfs.length);
            next();
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

    // ── Assemble Pure `.p2hv` Container ───────────────────────
    assembleContainer(capturedPages, pattern) {
      const container = document.createElement("div");
      container.className = "p2hv";

      capturedPages.forEach((pf, idx) => {
        pf.removeAttribute("style");
        pf.querySelectorAll("[class*='ClarificationBanner'], [class*='Banner'], [class*='BlobWrapper']").forEach(e => e.remove());

        // Unhide all inner contents
        pf.querySelectorAll("[style]").forEach(e => {
          const st = e.getAttribute("style") || "";
          if (/display:\s*none/i.test(st)) {
            e.setAttribute("style", st.replace(/display:\s*none/gi, "display:block"));
          }
        });

        const pageNum = idx + 1;
        const gated = !!(pattern && pattern.hasTextLayer && !pattern.pageParams[pageNum]);

        if (pattern && pattern.bgSuffix) {
          let img = pf.querySelector("img.bi") || pf.querySelector("img");
          const cur = img ? (img.getAttribute("src") || "") : "";

          if (!img) {
            img = document.createElement("img");
            img.className = "bi x0 y0 w1 h1";
            (pf.querySelector(".pc") || pf).appendChild(img);
          }

          if (gated) {
            if (!cur.includes("/pages/blurred/") && pattern.blurPrefix) {
              img.setAttribute("src", `${pattern.blurPrefix}${pageNum}${pattern.blurSuffix}`);
            }
          } else {
            const clear = this.deblurUrl(cur);
            // StuDocu uses Hexadecimal numbering for background images (/html/bg{HEX}.png)
            const hexPage = pageNum.toString(16);
            img.setAttribute("src", clear || `${pattern.bgPrefix}${hexPage}${pattern.bgSuffix}`);
          }
          img.removeAttribute("srcset");
          img.removeAttribute("data-src");
        }

        pf.querySelectorAll(".page-content, .pc").forEach(pc => {
          pc.style.setProperty("display", "block", "important");
          pc.style.setProperty("filter", "none", "important");
          pc.style.setProperty("visibility", "visible", "important");
          pc.style.setProperty("opacity", "1", "important");
        });

        container.appendChild(pf);
      });

      return container;
    },

    // ── Inject Print & Overlay Styles ─────────────────────────
    injectOverlayStyles() {
      if (document.getElementById("snap-studocu-modal-style")) return;

      const style = document.createElement("style");
      style.id = "snap-studocu-modal-style";
      style.textContent = `
        #snap-studocu-modal {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483647 !important;
          background: #323639 !important;
          overflow: auto !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
        #snap-studocu-modal .snap-modal-bar {
          position: sticky !important;
          top: 0 !important;
          z-index: 100 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 16px !important;
          background: #1e1e24 !important;
          color: #ffffff !important;
          padding: 12px 24px !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.5) !important;
        }
        #snap-studocu-modal .snap-modal-title {
          font-size: 15px !important;
          font-weight: 600 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        #snap-studocu-modal .snap-modal-actions {
          display: flex !important;
          gap: 10px !important;
          flex-shrink: 0 !important;
        }
        #snap-studocu-modal button {
          border: none !important;
          border-radius: 8px !important;
          padding: 9px 18px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }
        #snap-studocu-modal .snap-btn-print {
          background: #1a73e8 !important;
          color: #ffffff !important;
        }
        #snap-studocu-modal .snap-btn-print:hover {
          background: #1557b0 !important;
        }
        #snap-studocu-modal .snap-btn-close {
          background: #444746 !important;
          color: #ffffff !important;
        }
        #snap-studocu-modal .snap-btn-close:hover {
          background: #5e6260 !important;
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
        #snap-studocu-modal .snap-modal-pages .p2hv {
          margin: 0 auto !important;
        }
        #snap-studocu-modal .snap-modal-pages .pf {
          margin: 16px auto !important;
          background: #ffffff !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
          display: block !important;
          filter: none !important;
          opacity: 1 !important;
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

        /* ── Isolated Print Stylesheet ── */
        @media print {
          body > *:not(#snap-studocu-modal) {
            display: none !important;
            visibility: hidden !important;
          }
          html, body {
            background: #ffffff !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #snap-studocu-modal {
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #snap-studocu-modal .snap-modal-bar {
            display: none !important;
          }
          #snap-studocu-modal .snap-modal-pages .pf {
            margin: 0 !important;
            box-shadow: none !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          #snap-studocu-modal .snap-modal-pages .pf:last-child {
            page-break-after: auto !important;
          }
          @page {
            size: auto;
            margin: 0mm;
          }
        }
      `;
      document.head.appendChild(style);
    },

    // ── Build In-Tab Modal UI ─────────────────────────────────
    createModal(title) {
      const modal = document.createElement("div");
      modal.id = "snap-studocu-modal";

      const bar = document.createElement("div");
      bar.className = "snap-modal-bar";

      const titleEl = document.createElement("div");
      titleEl.className = "snap-modal-title";
      titleEl.textContent = `⚡ SnapDoc: ${title}`;

      const actions = document.createElement("div");
      actions.className = "snap-modal-actions";

      const printBtn = document.createElement("button");
      printBtn.className = "snap-btn-print";
      printBtn.textContent = "🖨️ In / Lưu PDF";
      printBtn.disabled = true;
      printBtn.style.opacity = "0.5";
      printBtn.addEventListener("click", () => window.print());

      const closeBtn = document.createElement("button");
      closeBtn.className = "snap-btn-close";
      closeBtn.textContent = "✕ Đóng";
      closeBtn.addEventListener("click", () => modal.remove());

      actions.appendChild(printBtn);
      actions.appendChild(closeBtn);
      bar.appendChild(titleEl);
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

      return { modal, fill, sub, loading, pages, printBtn };
    },

    // ── Full Pipeline Execution ───────────────────────────────
    generatePDF(UI) {
      const title = this.getTitle();

      if (!document.querySelector(".p2hv") || document.querySelectorAll(".pf").length === 0) {
        alert("SnapDoc: Không tìm thấy khung tài liệu (.pf). Hãy cuộn tài liệu một chút rồi bấm Tải lại nhé.");
        return;
      }

      this.injectOverlayStyles();
      const modalUI = this.createModal(title);
      document.body.appendChild(modalUI.modal);

      const pattern = this.getImagePattern();

      // Step 1: Incremental page capture
      this.captureAllPages((done, total) => {
        const pct = Math.round((done / total) * 65);
        modalUI.fill.style.width = `${pct}%`;
        modalUI.sub.textContent = `Đang mở khóa trang ${done} / ${total}...`;
        if (UI) UI.updateProgress(`Mở khóa trang ${done} / ${total}`, pct);
      })
        .then(capturedPages => {
          if (!capturedPages.length) throw new Error("No pages captured");

          // Step 2: Assemble pure .p2hv container with Hex-backgrounds
          const container = this.assembleContainer(capturedPages, pattern);

          // Step 3: Embed all images as Base64 Data URIs
          return this.embedImages(container, (done, total) => {
            const pct = 65 + Math.round((total ? done / total : 1) * 35);
            modalUI.fill.style.width = `${pct}%`;
            modalUI.sub.textContent = `Đang nạp ảnh HD chất lượng cao (${done} / ${total})...`;
            if (UI) UI.updateProgress(`Nạp ảnh HD (${done} / ${total})`, pct);
          }).then(() => container);
        })
        .then(container => {
          modalUI.loading.remove();
          modalUI.pages.appendChild(container);
          modalUI.printBtn.disabled = false;
          modalUI.printBtn.style.opacity = "1";

          if (UI) UI.hideProgress();

          // Auto-trigger clean print
          setTimeout(() => {
            window.print();
          }, 600);
        })
        .catch(err => {
          console.error("[SnapDoc] Pipeline failed:", err);
          modalUI.sub.textContent = "Không thể biên dịch tài liệu. Vui lòng thử tải lại trang.";
        });
    }
  };
})();
