// ═══════════════════════════════════════════════════════════
// PROVIDERS/SLIDESHARE.JS — SlideShare Downloader & PDF Engine
// Extracts 2048px high-res slides, lazy-hydration scanner,
// and auto-scales to A4 Landscape for pristine PDF printing.
// ═══════════════════════════════════════════════════════════

(() => {
  window.__SnapDocSlideShare = {
    name: "SlideShare",

    isMatch(host) {
      return host.includes("slideshare.net");
    },

    execute(UI) {
      this.generatePDF(UI);
    },

    // ── Document Title ────────────────────────────────────────
    getTitle() {
      const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
      if (ogTitle && ogTitle.trim().toLowerCase() !== "slideshare") {
        return ogTitle.trim();
      }

      const h1 = document.querySelector("h1");
      if (h1 && h1.innerText.trim()) {
        return h1.innerText.trim();
      }

      const cleanDocTitle = (document.title || "SlideShare_Presentation")
        .replace(/\s*\|\s*SlideShare/i, "")
        .replace(/[<>:"/\\|?*]/g, "")
        .trim();

      return cleanDocTitle || "SlideShare_Presentation";
    },

    // ── Detect Total Slides from Metadata or DOM ──────────────
    detectTotalPages() {
      // 1. Check JSON-LD metadata
      const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of ldScripts) {
        try {
          const data = JSON.parse(s.textContent);
          const count = data.numberOfPages || data.pageCount;
          if (count && Number(count) > 0) return Number(count);
        } catch (e) {}
      }

      // 2. Check DOM indicators (e.g. "1 of 35" or total count badges)
      const totalEl = document.querySelector('[data-testid="total-slides"], [class*="total-slides"], [class*="totalPages"]');
      if (totalEl) {
        const num = parseInt(totalEl.textContent.replace(/\D+/g, ""), 10);
        if (num > 0) return num;
      }

      // 3. Fallback: count current slide elements in DOM
      const currentImgs = document.querySelectorAll(
        'img[data-testid="vertical-slide-image"], img[class*="VerticalSlideImage"], img[class*="slide-image"], img[data-full], .slide_image'
      );
      return currentImgs.length || 0;
    },

    // ── High-Resolution 2048px URL Resolution ────────────────
    resolveHighResUrl(img) {
      if (!img) return null;

      // Check srcset for 2048w URL
      const srcset = img.getAttribute("srcset");
      if (srcset) {
        const parts = srcset.split(",").map(p => p.trim());
        // Look for 2048w explicitly
        const match2048 = parts.find(p => p.includes("2048w"));
        if (match2048) {
          return match2048.split(" ")[0].trim();
        }
        // Fallback: take the last (highest resolution) entry in srcset
        if (parts.length > 0) {
          const lastPart = parts[parts.length - 1];
          const candidate = lastPart.split(" ")[0].trim();
          if (candidate.startsWith("http")) {
            return candidate.replace("-1024.jpg", "-2048.jpg").replace("-638.jpg", "-2048.jpg").replace("-320.jpg", "-2048.jpg").split("?")[0];
          }
        }
      }

      // Check data-full / data-normal / currentSrc / src
      const rawUrl = img.getAttribute("data-full") || img.getAttribute("data-normal") || img.currentSrc || img.src || "";
      if (rawUrl && rawUrl.startsWith("http")) {
        return rawUrl.replace("-1024.jpg", "-2048.jpg").replace("-638.jpg", "-2048.jpg").replace("-320.jpg", "-2048.jpg").split("?")[0];
      }

      return null;
    },

    // ── Extract SlideShare CDN Image Prefix ───────────────────
    extractUrlPrefix(sampleUrl) {
      if (!sampleUrl) return null;
      // Example: https://image.slidesharecdn.com/flinktroubleshooting-new-150528082323-lva1-app6892/75/Apache-Flink-Hands-On-1-2048.jpg
      const match = sampleUrl.match(/^(.*?)-\d+-2048\.jpg/);
      if (match) {
        return match[1];
      }
      return null;
    },

    // ── Scan & Hydrate All Slides in Presentation ─────────────
    async scanAllSlideUrls(onProgress) {
      let totalPages = this.detectTotalPages();
      const slideSelector = 'img[data-testid="vertical-slide-image"], img[class*="VerticalSlideImage"], img[class*="slide-image"], img[data-full], .slide_image';

      // 1. Initial DOM check
      let currentImgs = Array.from(document.querySelectorAll(slideSelector));
      let samplePrefix = null;

      for (const img of currentImgs) {
        const u = this.resolveHighResUrl(img);
        if (u) {
          samplePrefix = this.extractUrlPrefix(u);
          if (samplePrefix) break;
        }
      }

      // 2. Perform smooth scroll scan down the page to trigger lazy loading
      const originalScrollPos = window.pageYOffset || document.documentElement.scrollTop;
      const scrollStep = 1000;
      const maxScrolls = Math.max(20, Math.min(60, totalPages || 30));

      let lastPos = 0;
      for (let i = 0; i < maxScrolls; i++) {
        window.scrollBy(0, scrollStep);
        await new Promise(r => setTimeout(r, 220));

        currentImgs = Array.from(document.querySelectorAll(slideSelector));
        if (!samplePrefix) {
          for (const img of currentImgs) {
            const u = this.resolveHighResUrl(img);
            if (u) {
              samplePrefix = this.extractUrlPrefix(u);
              if (samplePrefix) break;
            }
          }
        }

        const newPos = window.pageYOffset || document.documentElement.scrollTop;
        const count = currentImgs.length;
        if (onProgress) {
          const pct = Math.min(50, Math.round(((i + 1) / maxScrolls) * 50));
          onProgress(count, totalPages || count, pct);
        }

        // If we found all expected slides or hit page bottom, break early
        if (totalPages > 0 && count >= totalPages) break;
        if (newPos === lastPos && i > 10) break;
        lastPos = newPos;
      }

      // Restore original scroll
      window.scrollTo(0, originalScrollPos);

      // 3. Compile list of slide URLs
      if (!totalPages || totalPages < currentImgs.length) {
        totalPages = currentImgs.length;
      }

      const finalUrls = [];
      const seen = new Set();

      // Collect URLs from hydrated DOM elements
      currentImgs.forEach((img, idx) => {
        const u = this.resolveHighResUrl(img);
        if (u && !seen.has(u)) {
          seen.add(u);
          finalUrls.push(u);
        }
      });

      // If we have an exact prefix and totalPages > finalUrls.length,
      // synthesize any missing tail slides using the standard SlideShare pattern
      if (samplePrefix && totalPages > finalUrls.length) {
        const synthesizedList = [];
        for (let i = 1; i <= totalPages; i++) {
          synthesizedList.push(`${samplePrefix}-${i}-2048.jpg`);
        }
        return synthesizedList;
      }

      return finalUrls;
    },

    // ── Autoscale Engine (Optimized for SlideShare Landscape 16:9 / 4:3) ──
    applyAutoscale(container, modalUI) {
      const firstPf = container.querySelector(".pf");
      let origW = 0;
      let origH = 0;

      const firstImg = firstPf ? firstPf.querySelector("img") : null;
      if (firstImg && firstImg.naturalWidth && firstImg.naturalHeight) {
        origW = firstImg.naturalWidth;
        origH = firstImg.naturalHeight;
      }

      // Default fallback: standard 16:9 presentation dimensions (2048 x 1152)
      if (!origW || origW <= 0) origW = 2048;
      if (!origH || origH <= 0) origH = 1152;

      const isLandscape = origW >= origH;

      // Standard A4 printable dimensions in CSS 96-DPI pixels
      // A4 = 210mm x 297mm => (297/25.4)*96 = ~1122.5px, (210/25.4)*96 = ~793.7px
      const targetW = isLandscape ? 1122.5 : 793.7;
      const targetH = isLandscape ? 793.7 : 1122.5;

      const scaleX = targetW / origW;
      const scaleY = targetH / origH;

      // 98.5% safety margin ensures no subpixel overflow creates blank pages
      let scaleFactor = Math.min(scaleX, scaleY) * 0.985;
      scaleFactor = Math.round(scaleFactor * 10000) / 10000;

      console.log(`[SnapDoc] SlideShare AutoScale synchronized: ${scaleFactor} (orig: ${origW}x${origH}, target: ${targetW}x${targetH}, ${isLandscape ? "landscape" : "portrait"})`);

      // Apply scale factor to all slide elements
      const allPfs = container.querySelectorAll(".pf");
      allPfs.forEach(pf => {
        pf.style.setProperty("width", `${origW}px`, "important");
        pf.style.setProperty("height", `${origH}px`, "important");
        pf.style.setProperty("zoom", scaleFactor.toString(), "important");
        pf.style.setProperty("margin", "0 auto", "important");
      });

      // Inject / replace dynamic print stylesheet
      const prevDynamic = document.getElementById("snap-slideshare-autoscale-style");
      if (prevDynamic) prevDynamic.remove();

      const dynamicStyle = document.createElement("style");
      dynamicStyle.id = "snap-slideshare-autoscale-style";
      dynamicStyle.textContent = `
        @media print {
          @page {
            size: ${isLandscape ? "landscape" : "portrait"};
            margin: 0mm;
          }
          #snap-slideshare-modal .snap-modal-pages .pf {
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
          #snap-slideshare-modal .snap-modal-pages .pf:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
        #snap-slideshare-modal .snap-modal-pages .pf {
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
        modalUI.pageBadge.textContent = `📄 ${allPfs.length} slides`;
      }
    },

    // ── Build In-Tab Modal UI ─────────────────────────────────
    createModal(title) {
      const modal = document.createElement("div");
      modal.id = "snap-slideshare-modal";
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
        const dynamicStyle = document.getElementById("snap-slideshare-autoscale-style");
        if (dynamicStyle) dynamicStyle.remove();
      };
      closeBtn.addEventListener("click", doClose);

      // Smooth mouse wheel handling preventing page scrolling behind
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
      msg.textContent = "Đang quét và thu thập toàn bộ slide độ phân giải 2048px...";

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

    // ── Inject Overlay Styles ─────────────────────────────────
    injectOverlayStyles() {
      if (document.getElementById("snap-slideshare-modal-style")) return;

      const style = document.createElement("style");
      style.id = "snap-slideshare-modal-style";
      style.textContent = `
        #snap-slideshare-modal {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background: #1e1e1e !important;
          z-index: 2147483647 !important;
          display: flex !important;
          flex-direction: column !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          box-sizing: border-box !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          color: #fff !important;
          outline: none !important;
        }

        #snap-slideshare-modal .snap-modal-bar {
          position: sticky !important;
          top: 0 !important;
          z-index: 100 !important;
          background: #252526 !important;
          border-bottom: 1px solid #3c3c3c !important;
          padding: 10px 20px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          flex-shrink: 0 !important;
          gap: 16px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
        }

        #snap-slideshare-modal .snap-modal-title-group {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          overflow: hidden !important;
          flex: 1 !important;
        }

        #snap-slideshare-modal .snap-badge-logo {
          background: linear-gradient(135deg, #ff7043, #d84315) !important;
          color: #fff !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          padding: 4px 10px !important;
          border-radius: 20px !important;
          letter-spacing: 0.5px !important;
          flex-shrink: 0 !important;
        }

        #snap-slideshare-modal .snap-modal-title {
          font-size: 14px !important;
          font-weight: 600 !important;
          color: #e0e0e0 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        #snap-slideshare-modal .snap-badge-count {
          background: #333333 !important;
          color: #aaa !important;
          font-size: 11px !important;
          padding: 3px 8px !important;
          border-radius: 12px !important;
          flex-shrink: 0 !important;
        }

        #snap-slideshare-modal .snap-modal-actions {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          flex-shrink: 0 !important;
        }

        #snap-slideshare-modal .snap-btn-print {
          background: linear-gradient(135deg, #1a73e8, #0d47a1) !important;
          color: #fff !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 8px 18px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }

        #snap-slideshare-modal .snap-btn-print.ready:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 14px rgba(26, 115, 232, 0.5) !important;
        }

        #snap-slideshare-modal .snap-btn-close {
          background: #333333 !important;
          color: #ccc !important;
          border: 1px solid #444 !important;
          border-radius: 8px !important;
          padding: 8px 14px !important;
          font-size: 13px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }

        #snap-slideshare-modal .snap-btn-close:hover {
          background: #444 !important;
          color: #fff !important;
        }

        #snap-slideshare-modal .snap-modal-loading {
          padding: 40px 20px !important;
          text-align: center !important;
          flex-shrink: 0 !important;
        }

        #snap-slideshare-modal .snap-bar-track {
          background: #333 !important;
          height: 8px !important;
          border-radius: 4px !important;
          overflow: hidden !important;
          max-width: 420px !important;
          margin: 16px auto 10px !important;
        }

        #snap-slideshare-modal .snap-bar-fill {
          height: 100% !important;
          width: 0% !important;
          background: linear-gradient(90deg, #ff7043, #ffab40) !important;
          border-radius: 4px !important;
          transition: width 0.25s ease !important;
        }

        #snap-slideshare-modal .snap-modal-pages {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 20px !important;
          padding: 24px 0 80px !important;
          min-height: 200px !important;
        }

        #snap-slideshare-modal .snap-modal-pages .pf {
          background: #ffffff !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
          position: relative !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow: hidden !important;
        }

        #snap-slideshare-modal .snap-modal-pages .pf img {
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
          display: block !important;
        }

        @media print {
          body > *:not(#snap-slideshare-modal) {
            display: none !important;
          }
          #snap-slideshare-modal {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            background: #fff !important;
            overflow: visible !important;
          }
          #snap-slideshare-modal .snap-modal-bar,
          #snap-slideshare-modal .snap-modal-loading {
            display: none !important;
          }
          #snap-slideshare-modal .snap-modal-pages {
            padding: 0 !important;
            gap: 0 !important;
          }
        }
      `;
      document.head.appendChild(style);
    },

    // ── Full Pipeline Execution ───────────────────────────────
    async generatePDF(UI) {
      const title = this.getTitle();

      this.injectOverlayStyles();
      const modalUI = this.createModal(title);
      document.body.appendChild(modalUI.modal);

      // Step 1: Scan and resolve all 2048px slide URLs
      modalUI.sub.textContent = "Đang quét các slide trên trang...";
      const slideUrls = await this.scanAllSlideUrls((done, total, pct) => {
        modalUI.fill.style.width = `${pct}%`;
        modalUI.sub.textContent = `Đang quét nạp slide ${done} / ${total}...`;
        if (modalUI.pageBadge) modalUI.pageBadge.textContent = `${done}/${total} slides`;
        if (UI) UI.updateProgress(`Quét slide ${done} / ${total}`, pct);
      });

      if (!slideUrls || slideUrls.length === 0) {
        alert("SnapDoc: Không tìm thấy slide nào trên bài thuyết trình này. Hãy thử cuộn trang rồi bấm lại nhé!");
        modalUI.modal.remove();
        return;
      }

      const total = slideUrls.length;
      if (modalUI.pageBadge) modalUI.pageBadge.textContent = `0/${total} slides`;

      // Step 2: Render slide image containers
      const imgElements = [];
      slideUrls.forEach((url, idx) => {
        const pf = document.createElement("div");
        pf.className = "pf";
        pf.setAttribute("data-slide-index", (idx + 1).toString());

        const img = document.createElement("img");
        img.alt = `Slide ${idx + 1}`;
        img.crossOrigin = "anonymous";
        img.setAttribute("loading", "eager");
        img.src = url;

        pf.appendChild(img);
        modalUI.pages.appendChild(pf);
        imgElements.push(img);
      });

      // Step 3: Wait for all images to complete loading
      let loadedCount = 0;
      const onImageLoad = () => {
        loadedCount++;
        const pct = 50 + Math.round((loadedCount / total) * 50);
        modalUI.fill.style.width = `${pct}%`;
        modalUI.sub.textContent = `Đang tải ảnh chất lượng 2048px (${loadedCount} / ${total})...`;
        if (modalUI.pageBadge) modalUI.pageBadge.textContent = `${loadedCount}/${total} slides`;

        if (loadedCount === 1) {
          // Autoscale as soon as slide 1 dimensions are ready
          this.applyAutoscale(modalUI.pages, modalUI);
        }

        if (loadedCount >= total) {
          modalUI.sub.textContent = `✅ Đã sẵn sàng in ${total} slide!`;
          modalUI.loading.style.display = "none";
          this.applyAutoscale(modalUI.pages, modalUI);

          // Auto-trigger print after short settling delay
          setTimeout(() => {
            if (modalUI.printBtn) modalUI.printBtn.click();
          }, 800);
        }
      };

      imgElements.forEach(img => {
        if (img.complete && img.naturalWidth > 0) {
          onImageLoad();
        } else {
          img.addEventListener("load", onImageLoad, { once: true });
          img.addEventListener("error", () => {
            console.warn("[SnapDoc] Slide image load error:", img.src);
            onImageLoad();
          }, { once: true });
        }
      });
    }
  };
})();
