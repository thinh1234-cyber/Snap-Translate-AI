// ═══════════════════════════════════════════════════════════
// PROVIDERS/SLIDESHARE.JS — SlideShare Downloader & PDF Engine
// Tự động thu thập toàn bộ slide độ nét cao, tương thích cả
// chuẩn 2048px và chuẩn cũ 1024px, chống lỗi CORS CDN,
// tự động căn chỉnh khổ ngang A4 Landscape chuẩn in ấn.
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

      // 2. Check DOM indicators (e.g. "1 of 14" or total count badges)
      const totalEl = document.querySelector('[data-testid="total-slides"], [class*="total-slides"], [class*="totalPages"], [data-testid*="page-count"]');
      if (totalEl) {
        const num = parseInt(totalEl.textContent.replace(/\D+/g, ""), 10);
        if (num > 0) return num;
      }

      // 3. Fallback: count current slide elements in DOM
      const slideSelector = 'img[data-testid*="slide"], img[class*="SlideImage"], img[class*="vertical-slide"], img[class*="VerticalSlide"], img[src*="slidesharecdn.com"], img[srcset*="slidesharecdn.com"], img[data-full], .slide_image';
      const currentImgs = document.querySelectorAll(slideSelector);
      return currentImgs.length || 0;
    },

    // ── URL Resolution (Lấy độ phân giải cao nhất thực tế có sẵn) ──
    resolveHighResUrl(img) {
      if (!img) return null;

      // 1. Kiểm tra srcset: lấy URL có độ phân giải lớn nhất thực tế được CDN cung cấp
      const srcset = img.getAttribute("srcset");
      if (srcset) {
        const entries = srcset.split(",").map(p => {
          const parts = p.trim().split(/\s+/);
          const u = parts[0];
          const wMatch = parts[1] ? parseInt(parts[1].replace(/\D/g, ""), 10) : 0;
          return { url: u, width: wMatch };
        }).filter(e => e.url && e.url.startsWith("http"));

        if (entries.length > 0) {
          entries.sort((a, b) => b.width - a.width);
          // Lấy URL lớn nhất thực tế (nếu có 2048 thì lấy 2048, nếu chỉ có 1024 thì lấy 1024)
          return entries[0].url.split("?")[0];
        }
      }

      // 2. Kiểm tra các data attribute hoặc src trực tiếp
      const rawUrl = img.getAttribute("data-full") ||
                     img.getAttribute("data-normal") ||
                     img.getAttribute("data-src") ||
                     img.currentSrc ||
                     img.src || "";

      if (rawUrl && rawUrl.startsWith("http") && !rawUrl.startsWith("data:")) {
        return rawUrl.split("?")[0];
      }

      return null;
    },

    // ── Extract SlideShare CDN Image Prefix & Format ──────────
    extractUrlPrefix(sampleUrl) {
      if (!sampleUrl) return null;

      // Hỗ trợ dạng: https://image.slidesharecdn.com/xxx/75/Title-1-2048.jpg hoặc -1-1024.jpg
      const matchWithRes = sampleUrl.match(/^(.*?)-\d+-(2048|1024|638)\.(jpg|webp|png)/i);
      if (matchWithRes) {
        return {
          prefix: matchWithRes[1],
          res: matchWithRes[2],
          ext: matchWithRes[3]
        };
      }

      // Hỗ trợ dạng không có hậu tố kích thước: Title-1.jpg
      const matchSimple = sampleUrl.match(/^(.*?)-\d+\.(jpg|webp|png)/i);
      if (matchSimple) {
        return {
          prefix: matchSimple[1],
          res: "",
          ext: matchSimple[2]
        };
      }

      return null;
    },

    // ── Scan & Hydrate All Slides in Presentation ─────────────
    async scanAllSlideUrls(onProgress) {
      let totalPages = this.detectTotalPages();
      const slideSelector = 'img[data-testid*="slide"], img[class*="SlideImage"], img[class*="vertical-slide"], img[class*="VerticalSlide"], img[src*="slidesharecdn.com"], img[srcset*="slidesharecdn.com"], img[data-full], .slide_image';

      // 1. Kiểm tra DOM hiện tại
      let currentImgs = Array.from(document.querySelectorAll(slideSelector));
      let samplePrefix = null;

      for (const img of currentImgs) {
        const u = this.resolveHighResUrl(img);
        if (u) {
          samplePrefix = this.extractUrlPrefix(u);
          if (samplePrefix) break;
        }
      }

      // 2. Cuộn quét trang xuống dưới để kích hoạt lazy loading tự nhiên của SlideShare
      const originalScrollPos = window.pageYOffset || document.documentElement.scrollTop;
      const scrollStep = 900;
      const maxScrolls = Math.max(15, Math.min(50, totalPages || 25));

      let lastPos = 0;
      for (let i = 0; i < maxScrolls; i++) {
        window.scrollBy(0, scrollStep);
        await new Promise(r => setTimeout(r, 200));

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

        if (totalPages > 0 && count >= totalPages) break;
        if (newPos === lastPos && i > 8) break;
        lastPos = newPos;
      }

      // Khôi phục vị trí cuộn ban đầu
      window.scrollTo(0, originalScrollPos);

      // 3. Tập hợp danh sách URL
      if (!totalPages || totalPages < currentImgs.length) {
        totalPages = currentImgs.length;
      }

      const finalUrls = [];
      const seen = new Set();

      currentImgs.forEach(img => {
        const u = this.resolveHighResUrl(img);
        if (u && !seen.has(u)) {
          seen.add(u);
          finalUrls.push(u);
        }
      });

      // Nếu còn thiếu slide và đã trích xuất được prefix chuẩn của tài liệu,
      // tự động sinh URL cho các slide còn thiếu theo đúng mẫu CDN thực tế
      if (samplePrefix && totalPages > finalUrls.length) {
        const synthesizedList = [];
        const resSuffix = samplePrefix.res ? `-${samplePrefix.res}` : "";
        for (let i = 1; i <= totalPages; i++) {
          synthesizedList.push(`${samplePrefix.prefix}-${i}${resSuffix}.${samplePrefix.ext}`);
        }
        return synthesizedList;
      }

      return finalUrls;
    },

    // ── Autoscale Engine (Khổ Ngang A4 Landscape 16:9 / 4:3) ──
    applyAutoscale(container, modalUI) {
      const firstPf = container.querySelector(".pf");
      let origW = 0;
      let origH = 0;

      const firstImg = firstPf ? firstPf.querySelector("img") : null;
      if (firstImg && firstImg.naturalWidth && firstImg.naturalHeight) {
        origW = firstImg.naturalWidth;
        origH = firstImg.naturalHeight;
      }

      // Kích thước mặc định nếu ảnh đang nạp: 16:9 (1024 x 576 hoặc 2048 x 1152)
      if (!origW || origW <= 0) origW = 1024;
      if (!origH || origH <= 0) origH = 576;

      const isLandscape = origW >= origH;

      // Tiêu chuẩn in ấn A4 (pixels 96 DPI): 1122.5 x 793.7
      const targetW = isLandscape ? 1122.5 : 793.7;
      const targetH = isLandscape ? 793.7 : 1122.5;

      const scaleX = targetW / origW;
      const scaleY = targetH / origH;
      let scaleFactor = Math.min(scaleX, scaleY) * 0.985;
      scaleFactor = Math.round(scaleFactor * 10000) / 10000;

      // Căn chỉnh tỉ lệ cho tất cả khung chứa slide
      const allPfs = container.querySelectorAll(".pf");
      allPfs.forEach(pf => {
        pf.style.setProperty("width", `${origW}px`, "important");
        pf.style.setProperty("height", `${origH}px`, "important");
        pf.style.setProperty("aspect-ratio", `${origW} / ${origH}`, "important");
        pf.style.setProperty("zoom", scaleFactor.toString(), "important");
        pf.style.setProperty("margin", "0 auto", "important");
      });

      // Cập nhật stylesheet in ấn
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
            display: flex !important;
            visibility: visible !important;
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

      // Cập nhật nhãn nút in
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

      modal.addEventListener("wheel", (e) => {
        e.stopPropagation();
        modal.scrollTop += e.deltaY;
      }, { passive: false });

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
      msg.textContent = "Đang quét và thu thập toàn bộ slide độ phân giải cao...";

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
          width: 100% !important;
          max-width: 1024px !important;
          aspect-ratio: 16 / 9 !important;
          min-height: 180px !important;
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

      // Step 1: Quét và giải mã tất cả URL slide
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

      // Step 2: Render các container slide
      const imgElements = [];
      slideUrls.forEach((url, idx) => {
        const pf = document.createElement("div");
        pf.className = "pf";
        pf.setAttribute("data-slide-index", (idx + 1).toString());

        const img = document.createElement("img");
        img.alt = `Slide ${idx + 1}`;
        // TUYỆT ĐỐI KHÔNG set img.crossOrigin = "anonymous" vì CDN SlideShare không gửi header Access-Control-Allow-Origin
        img.setAttribute("loading", "eager");
        img.setAttribute("data-original-src", url);

        // Fallback nhiều tầng nếu link độ phân giải cao bị 404 (VD: bản trình chiếu cũ chỉ có 1024 hoặc 638)
        img.addEventListener("error", function handleImgError() {
          const cur = this.src || "";
          if (cur.includes("-2048.jpg") || cur.includes("-2048.webp")) {
            console.log(`[SnapDoc] 2048px không tồn tại cho slide ${idx + 1}, tự động chuyển sang 1024px`);
            this.src = cur.replace("-2048.jpg", "-1024.jpg").replace("-2048.webp", "-1024.webp");
          } else if (cur.includes("-1024.jpg") || cur.includes("-1024.webp")) {
            console.log(`[SnapDoc] 1024px không tồn tại cho slide ${idx + 1}, tự động chuyển sang 638px`);
            this.src = cur.replace("-1024.jpg", "-638.jpg").replace("-1024.webp", "-638.webp");
          } else {
            console.warn(`[SnapDoc] Lỗi không thể tải ảnh slide ${idx + 1}:`, cur);
            onImageLoad();
          }
        });

        img.src = url;

        pf.appendChild(img);
        modalUI.pages.appendChild(pf);
        imgElements.push(img);
      });

      // Step 3: Đợi toàn bộ ảnh nạp xong vào bộ nhớ trình duyệt
      let loadedCount = 0;
      const onImageLoad = () => {
        loadedCount++;
        const pct = 50 + Math.round((loadedCount / total) * 50);
        modalUI.fill.style.width = `${pct}%`;
        modalUI.sub.textContent = `Đang nạp ảnh slide (${loadedCount} / ${total})...`;
        if (modalUI.pageBadge) modalUI.pageBadge.textContent = `${loadedCount}/${total} slides`;

        if (loadedCount === 1) {
          // Tính lại autoscale theo kích thước thực của slide đầu tiên
          this.applyAutoscale(modalUI.pages, modalUI);
        }

        if (loadedCount >= total) {
          modalUI.sub.textContent = `✅ Đã sẵn sàng in ${total} slide!`;
          modalUI.loading.style.display = "none";
          this.applyAutoscale(modalUI.pages, modalUI);

          // Tự động mở hộp thoại in sau nhịp nghỉ ngắn
          setTimeout(() => {
            if (modalUI.printBtn) modalUI.printBtn.click();
          }, 600);
        }
      };

      imgElements.forEach(img => {
        if (img.complete && img.naturalWidth > 0) {
          onImageLoad();
        } else {
          img.addEventListener("load", onImageLoad, { once: true });
        }
      });
    }
  };
})();
