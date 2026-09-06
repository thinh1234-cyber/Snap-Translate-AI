// ═══════════════════════════════════════════════════════════
// PROVIDERS/SLIDESHARE.JS — SlideShare Downloader & PDF Engine
// Tự động thu thập toàn bộ slide độ nét cao (HD 2048px/1024px),
// cơ chế 3 tầng: Next.js Store -> slidesharedownloader.top API -> DOM Fallback,
// cơ chế tải tuần tự song song (concurrency pool) chống nghẽn mạng đối với tài liệu lớn (>80-150 trang),
// chống trang trắng / mất trang, căn chuẩn khổ giấy A4 Ngang/Dọc 100vw x 100vh không bao giờ thừa trang trắng.
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
    getTitle(defaultTitle = "") {
      if (defaultTitle && defaultTitle.trim() && defaultTitle.trim().toLowerCase() !== "slideshare") {
        return defaultTitle.trim();
      }

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

    // ── Tầng 1: Trích xuất trực tiếp từ Next.js Store (__NEXT_DATA__) ──
    extractFromNextData() {
      try {
        const nextDataEl = document.getElementById("__NEXT_DATA__");
        if (!nextDataEl || !nextDataEl.textContent) return null;

        const data = JSON.parse(nextDataEl.textContent);
        const ss = data?.props?.pageProps?.slideshow;
        if (!ss) return null;

        const totalSlides = ss.totalSlides || ss.total_slides || ss.page_count;
        if (!totalSlides || totalSlides <= 0) return null;

        const title = ss.title || ss.strippedTitle || "";
        const dimensions = ss.slideDimensions || null;
        const slidesInfo = ss.slides;

        if (slidesInfo && slidesInfo.imageLocation && Array.isArray(slidesInfo.imageSizes)) {
          const host = slidesInfo.host || "https://image.slidesharecdn.com";
          const loc = slidesInfo.imageLocation;
          const sTitle = slidesInfo.title;

          // Sắp xếp các độ phân giải từ lớn nhất đến nhỏ nhất (2048 -> 1024 -> 638 -> 320)
          const sortedSizes = [...slidesInfo.imageSizes].sort((a, b) => (b.width || 0) - (a.width || 0));

          const slideCandidates = [];
          for (let i = 1; i <= totalSlides; i++) {
            const cands = sortedSizes.map(size => {
              return `${host}/${loc}/${size.quality}/${sTitle}-${i}-${size.width}.jpg`;
            });
            slideCandidates.push(cands);
          }

          return {
            source: "__NEXT_DATA__",
            title,
            totalSlides,
            dimensions,
            slideCandidates
          };
        }
      } catch (e) {
        console.warn("[SnapDoc] Next.js Store parse error:", e);
      }
      return null;
    },

    // ── Tầng 2: Gọi API dự phòng (slidesharedownloader.top / slidesvapi) ──
    async extractFromApiFallback() {
      const cleanUrl = window.location.href.split("?")[0].replace(/\/+$/, "");
      const endpoints = [
        "https://api.slidesharedownloader.top/",
        "https://slidesvapi.vercel.app/"
      ];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              slideshareUrl: cleanUrl,
              downloadFormat: "pdf",
              quality: "hd"
            })
          });

          if (!res.ok) continue;
          const data = await res.json();
          if (data && data.success && Array.isArray(data.images) && data.images.length > 0) {
            const totalSlides = data.totalSlides || data.images.length;
            const slideCandidates = data.images.map(imgUrl => [imgUrl]);
            return {
              source: "API_FALLBACK",
              title: data.title || "",
              totalSlides,
              dimensions: null,
              slideCandidates
            };
          }
        } catch (e) {
          console.warn(`[SnapDoc] API fallback error on ${ep}:`, e);
        }
      }
      return null;
    },

    // ── Tầng 3: Quét DOM dự phòng (Chỉ nhận diện ảnh slide thật, loại bỏ thumbnail) ──
    extractFromDOMFallback() {
      // Tìm số lượng trang từ JSON-LD
      let totalSlides = 0;
      const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of ldScripts) {
        try {
          const data = JSON.parse(s.textContent);
          const count = data.numberOfPages || data.pageCount;
          if (count && Number(count) > 0) {
            totalSlides = Number(count);
            break;
          }
        } catch (e) {}
      }

      if (!totalSlides) {
        const totalEl = document.querySelector('[data-testid="total-slides"]');
        if (totalEl) {
          const num = parseInt(totalEl.textContent.replace(/\D+/g, ""), 10);
          if (num > 0) totalSlides = num;
        }
      }

      // Tìm ảnh slide thật trên trang (BẮT BUỘC host image.slidesharecdn.com, KHÔNG phải thumbnail)
      const sampleImg = document.querySelector(
        'img[data-testid="vertical-slide-image"], img[id*="slide-image-0"], section[data-testid*="slide"] img, .slide-preview-thumbnail-module img'
      );

      let pattern = null;
      if (sampleImg) {
        const candidates = [];
        const srcset = sampleImg.getAttribute("srcset");
        if (srcset) {
          const parts = srcset.split(",");
          for (const p of parts) {
            const tokens = p.trim().split(/\s+/);
            if (tokens.length > 0 && tokens[0].startsWith("http")) {
              candidates.push(tokens[0].split("?")[0]);
            }
          }
        }
        if (sampleImg.src && sampleImg.src.startsWith("http")) {
          candidates.push(sampleImg.src.split("?")[0]);
        }

        for (const u of candidates) {
          if (!u.includes("image.slidesharecdn.com") || u.includes("ss_thumbnails") || u.includes("-thumbnail.jpg")) {
            continue;
          }
          // Mẫu: https://image.slidesharecdn.com/<loc>/<quality>/<title>-<index>-<width>.jpg
          const m = u.match(/^(https?:\/\/image\.slidesharecdn\.com\/[^\/]+\/(\d+)\/([^\/]+))-(\d+)-(\d+)\.(jpg|webp|png)$/i);
          if (m) {
            pattern = {
              base: m[1],
              quality: m[2],
              title: m[3],
              currentIdx: parseInt(m[4], 10),
              width: m[5],
              ext: m[6].toLowerCase()
            };
            break;
          }
        }
      }

      if (pattern && totalSlides > 0) {
        const slideCandidates = [];
        for (let i = 1; i <= totalSlides; i++) {
          const cands = [
            `${pattern.base.replace(`/${pattern.quality}/`, "/75/")}-${i}-2048.${pattern.ext}`,
            `${pattern.base.replace(`/${pattern.quality}/`, "/85/")}-${i}-1024.${pattern.ext}`,
            `${pattern.base.replace(`/${pattern.quality}/`, "/85/")}-${i}-638.${pattern.ext}`,
            `${pattern.base}-${i}-${pattern.width}.${pattern.ext}`
          ];
          slideCandidates.push(cands);
        }
        return {
          source: "DOM_PATTERN",
          title: "",
          totalSlides,
          dimensions: null,
          slideCandidates
        };
      }

      return null;
    },

    // ── Pipeline thu thập slide đa tầng ───────────────────────
    async collectSlideData(onProgress) {
      if (onProgress) onProgress(0, 0, 15, "Đang trích xuất dữ liệu gốc...");

      // Tầng 1: Next.js Store
      let result = this.extractFromNextData();
      if (result) {
        console.log("[SnapDoc] Thu thập thành công qua Next.js Store:", result);
        if (onProgress) onProgress(result.totalSlides, result.totalSlides, 40, `Tìm thấy ${result.totalSlides} slide độ nét cao!`);
        return result;
      }

      // Tầng 2: Gọi API ngoài
      if (onProgress) onProgress(0, 0, 25, "Đang kết nối API phân giải slide...");
      result = await this.extractFromApiFallback();
      if (result) {
        console.log("[SnapDoc] Thu thập thành công qua API Fallback:", result);
        if (onProgress) onProgress(result.totalSlides, result.totalSlides, 40, `Tìm thấy ${result.totalSlides} slide qua API!`);
        return result;
      }

      // Tầng 3: DOM Fallback
      if (onProgress) onProgress(0, 0, 35, "Đang phân tích cấu trúc trang DOM...");
      result = this.extractFromDOMFallback();
      if (result) {
        console.log("[SnapDoc] Thu thập thành công qua DOM Pattern:", result);
        if (onProgress) onProgress(result.totalSlides, result.totalSlides, 40, `Tìm thấy ${result.totalSlides} slide qua DOM!`);
        return result;
      }

      return null;
    },

    // ── Autoscale Engine (Khổ Ngang / Khổ Dọc Chuẩn In Ấn) ────
    applyAutoscale(container, modalUI, slideDims = null) {
      const firstPf = container.querySelector(".pf");
      let origW = 0;
      let origH = 0;

      const firstImg = firstPf ? firstPf.querySelector("img") : null;
      if (firstImg && firstImg.naturalWidth && firstImg.naturalHeight) {
        origW = firstImg.naturalWidth;
        origH = firstImg.naturalHeight;
      } else if (slideDims && slideDims.width && slideDims.height) {
        origW = slideDims.width;
        origH = slideDims.height;
      }

      // Kích thước mặc định an toàn nếu chưa có kích thước thực
      if (!origW || origW <= 0) origW = 1024;
      if (!origH || origH <= 0) origH = 576;

      const isLandscape = origW >= origH;

      // Tính kích thước hiển thị vừa vặn trên màn hình máy tính (Preview UI)
      const maxScreenW = Math.min(window.innerWidth * 0.9, isLandscape ? 1040 : 760);
      const previewScale = Math.min(1, maxScreenW / origW);
      const displayW = Math.round(origW * previewScale);
      const displayH = Math.round(origH * previewScale);

      // Căn chỉnh cho tất cả container slide trên màn hình
      const allPfs = container.querySelectorAll(".pf");
      allPfs.forEach(pf => {
        pf.style.setProperty("width", `${displayW}px`, "important");
        pf.style.setProperty("height", `${displayH}px`, "important");
        pf.style.setProperty("aspect-ratio", `${origW} / ${origH}`, "important");
      });

      // Đảm bảo phần tử cuối có class snap-last-slide
      if (allPfs.length > 0) {
        allPfs[allPfs.length - 1].classList.add("snap-last-slide");
      }

      // Cập nhật stylesheet in ấn động: Dùng 100vw x 100vh để không bao giờ có trang trắng thừa
      const prevDynamic = document.getElementById("snap-slideshare-autoscale-style");
      if (prevDynamic) prevDynamic.remove();

      const dynamicStyle = document.createElement("style");
      dynamicStyle.id = "snap-slideshare-autoscale-style";
      dynamicStyle.textContent = `
        @media print {
          @page {
            size: ${isLandscape ? "landscape" : "portrait"};
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            overflow: visible !important;
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
            margin: 0 !important;
            gap: 0 !important;
            display: block !important;
          }
          #snap-slideshare-modal .snap-modal-pages .pf {
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100vw !important;
            max-height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
            background: #fff !important;
          }
          #snap-slideshare-modal .snap-modal-pages .pf.snap-last-slide,
          #snap-slideshare-modal .snap-modal-pages .pf:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          #snap-slideshare-modal .snap-modal-pages .pf img {
            max-width: 100% !important;
            max-height: 100% !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
            display: block !important;
          }
        }
      `;
      document.head.appendChild(dynamicStyle);

      // Cập nhật nhãn nút in
      if (modalUI && modalUI.printBtn) {
        const oriLabel = isLandscape ? "Khổ Ngang" : "Khổ Dọc";
        modalUI.printBtn.textContent = `🖨️ In / Lưu PDF (${oriLabel} • ${allPfs.length} slides)`;
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
      msg.textContent = "Đang chuẩn bị slide độ nét cao...";

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
          margin: 0 auto !important;
          border-radius: 4px !important;
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
        }
      `;
      document.head.appendChild(style);
    },

    // ── Full Pipeline Execution ───────────────────────────────
    async generatePDF(UI) {
      this.injectOverlayStyles();
      const modalUI = this.createModal("SlideShare Presentation");
      document.body.appendChild(modalUI.modal);

      // Bước 1: Thu thập metadata & danh sách URL ứng cử viên của từng slide
      const presentationData = await this.collectSlideData((done, total, pct, subText) => {
        modalUI.fill.style.width = `${pct}%`;
        modalUI.sub.textContent = subText || `Đang quét dữ liệu...`;
        if (UI) UI.updateProgress(subText || `Quét dữ liệu`, pct);
      });

      if (!presentationData || !presentationData.slideCandidates || presentationData.slideCandidates.length === 0) {
        alert("SnapDoc: Không tìm thấy slide nào trên bài thuyết trình này. Hãy thử cuộn trang hoặc tải lại trang rồi thử lại nhé!");
        modalUI.modal.remove();
        return;
      }

      const total = presentationData.totalSlides;
      const cleanTitle = this.getTitle(presentationData.title);
      modalUI.modal.querySelector(".snap-modal-title").textContent = cleanTitle;
      modalUI.modal.querySelector(".snap-modal-title").setAttribute("title", cleanTitle);
      if (modalUI.pageBadge) modalUI.pageBadge.textContent = `0/${total} slides`;

      // Bước 2: Tạo các khung .pf trước
      const pfElements = [];
      const queue = [];

      presentationData.slideCandidates.forEach((candidates, idx) => {
        const pf = document.createElement("div");
        pf.className = "pf";
        pf.setAttribute("data-slide-index", (idx + 1).toString());

        const img = document.createElement("img");
        img.alt = `Slide ${idx + 1}`;
        img.setAttribute("loading", "eager");

        pf.appendChild(img);
        modalUI.pages.appendChild(pf);

        pfElements.push(pf);
        queue.push({ img, candidates, idx });
      });

      if (pfElements.length > 0) {
        pfElements[pfElements.length - 1].classList.add("snap-last-slide");
      }

      // Căn chỉnh tỷ lệ sơ bộ dựa trên dimensions nếu có
      this.applyAutoscale(modalUI.pages, modalUI, presentationData.dimensions);

      // Bước 3: Tải ảnh theo luồng song song có kiểm soát (Concurrency = 8)
      // Giúp trình duyệt không bị nghẽn mạng hay rớt kết nối với tài liệu lớn (>80 trang)
      const CONCURRENCY = 8;
      let completedCount = 0;
      let successCount = 0;

      const loadSlide = (item) => {
        const { img, candidates, idx } = item;
        return new Promise((resolve) => {
          let candidateIdx = 0;
          let isSettled = false;
          let timer = null;

          const settle = (ok) => {
            if (isSettled) return;
            isSettled = true;
            if (timer) clearTimeout(timer);
            completedCount++;
            if (ok) successCount++;

            const pct = 40 + Math.round((completedCount / total) * 60);
            modalUI.fill.style.width = `${pct}%`;
            modalUI.sub.textContent = `Đang nạp ảnh slide (${completedCount} / ${total})...`;
            if (modalUI.pageBadge) modalUI.pageBadge.textContent = `${completedCount}/${total} slides`;
            if (UI) UI.updateProgress(`Nạp slide ${completedCount} / ${total}`, pct);

            if (completedCount === 1) {
              this.applyAutoscale(modalUI.pages, modalUI, presentationData.dimensions);
            }
            resolve(ok);
          };

          const tryCandidate = () => {
            if (isSettled) return;
            if (candidateIdx < candidates.length) {
              const url = candidates[candidateIdx++];
              img.onerror = () => tryCandidate();
              img.onload = () => {
                if (img.naturalWidth > 0) {
                  settle(true);
                } else {
                  tryCandidate();
                }
              };
              img.src = url;

              // Hạn chế chờ tối đa 12s cho mỗi URL ứng cử viên
              if (timer) clearTimeout(timer);
              timer = setTimeout(() => {
                console.warn(`[SnapDoc] Slide ${idx + 1} quá hạn tải URL, thử độ phân giải khác:`, url);
                tryCandidate();
              }, 12000);
            } else {
              console.warn(`[SnapDoc] Slide ${idx + 1} đã thử hết các URL khả dụng.`);
              settle(false);
            }
          };

          tryCandidate();
        });
      };

      let qIdx = 0;
      const workers = Array(CONCURRENCY).fill(null).map(async () => {
        while (qIdx < queue.length) {
          const item = queue[qIdx++];
          await loadSlide(item);
        }
      });

      await Promise.all(workers);

      // Đã nạp xong 100% toàn bộ các slide
      modalUI.sub.textContent = `✅ Đã sẵn sàng in ${total} slide!`;
      modalUI.loading.style.display = "none";
      this.applyAutoscale(modalUI.pages, modalUI, presentationData.dimensions);

      // Tự động mở hộp thoại in sau nhịp nghỉ ngắn
      setTimeout(() => {
        if (modalUI.printBtn) modalUI.printBtn.click();
      }, 600);
    }
  };
})();
