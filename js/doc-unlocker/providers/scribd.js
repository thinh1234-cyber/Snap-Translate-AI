// ═══════════════════════════════════════════════════════════
// PROVIDERS/SCRIBD.JS — Scribd Bypass & PDF Downloader Engine
// Quy trình chuẩn hóa theo yêu cầu:
// 1. Chuyển sang clean embed URL: https://www.scribd.com/embeds/{id}/content
// 2. Scale fit page theo chiều dọc của window (để quét trọn vẹn toàn bộ element)
// 3. Scroll quét trước toàn bộ các trang (giữ nguyên document_scroller để nạp đủ các trang cuối)
// 4. Xóa các element rác sau khi đã nạp đủ 100% tài nguyên
// 5. Mở popup print (window.print)
// ═══════════════════════════════════════════════════════════

(() => {
  window.__SnapDocScribd = {
    name: "Scribd",

    isMatch(host) {
      return host.includes("scribd.com");
    },

    async execute(UI) {
      const pathname = window.location.pathname;

      // Bước 1: Nếu đang ở trang xem tài liệu thường -> Mở Clean Embed URL
      const docMatch = pathname.match(/\/(?:document|doc)\/(\d+)/);
      if (docMatch && !pathname.includes("/embeds/")) {
        const docId = docMatch[1];
        const embedUrl = `https://www.scribd.com/embeds/${docId}/content#snap_autodownload=1`;
        window.open(embedUrl, "_blank");
        return;
      }

      // Bước 2: Căn fit page theo chiều dọc của window để nhìn thấy trọn vẹn từng trang
      UI.showProgress("Scribd Downloader", "Đang căn chỉnh tỷ lệ và chuẩn bị nạp trang...");
      const fitScale = this.applyFitVerticalScale();

      // Bước 3: SCROLL QUÉT TRƯỚC (khi cấu trúc scroller còn nguyên để Scribd nạp đủ trang cuối)
      await this.scrollFullDocument(UI, fitScale);

      // Bước 4: XÓA CÁC ELEMENT RÁC SAU KHI ĐÃ QUÉT ĐẦY ĐỦ 100% CÁC TRANG
      UI.updateProgress("Đang dọn dẹp các thành phần thừa...", 96);
      this.cleanupDOM();

      UI.updateProgress("Hoàn tất nạp 100%! Đang mở hộp thoại in...", 100);

      // Bước 5: Mở hộp thoại in (Pop up Print)
      setTimeout(() => {
        const btn = document.getElementById("snap-doc-floating-btn");
        if (btn) btn.remove();
        const overlay = document.getElementById("snap-doc-overlay");
        if (overlay) overlay.remove();

        // Cuộn về đỉnh trang trước khi mở Print để không bị lệch trang
        window.scrollTo({ top: 0, behavior: "instant" });

        UI.hideProgress();
        window.print();
      }, 600);
    },

    // ── 1. Scale cho nhỏ lại kiểu fit page theo chiều dọc của window ──
    applyFitVerticalScale() {
      const firstPage = document.querySelector(".outer_page");
      const pageH = (firstPage && firstPage.offsetHeight) ? firstPage.offsetHeight : 1167;
      const targetH = window.innerHeight - 30;
      let fitScale = Math.round((targetH / pageH) * 100) / 100;
      fitScale = Math.min(1, Math.max(0.35, fitScale));

      const docContainer = document.querySelector(".document_container") || document.querySelector(".outer_page_container");
      if (docContainer) {
        docContainer.style.setProperty("zoom", fitScale.toString());
        docContainer.style.setProperty("margin", "0 auto");
      }

      // Khi in ra giấy (Ctrl + P), đảm bảo zoom trở về 1 để fill trang giấy chuẩn tỉ lệ A4/Letter
      let printStyle = document.getElementById("snap-scribd-print-scale");
      if (!printStyle) {
        printStyle = document.createElement("style");
        printStyle.id = "snap-scribd-print-scale";
        printStyle.textContent = `
          @media print {
            .document_container { zoom: 1 !important; margin: 0 !important; }
            .outer_page { break-after: page !important; page-break-after: always !important; display: block !important; visibility: visible !important; }
            .outer_page:last-child { break-after: auto !important; page-break-after: auto !important; }
          }
        `;
        document.head.appendChild(printStyle);
      }

      console.log(`[SnapDoc] Scribd Fit Window Vertical: scale = ${fitScale} (pageH = ${pageH}, windowH = ${window.innerHeight})`);
      return fitScale;
    },

    // ── 2. Scroll quét trước và chờ nạp 100% element nhỏ & trang cuối ──
    async scrollFullDocument(UI, fitScale) {
      const scroller = document.querySelector(".document_scroller");

      // Kích hoạt nạp trước tất cả các trang JSONP qua docManager
      if (window.docManager && window.docManager.pages) {
        try {
          Object.values(window.docManager.pages).forEach(page => {
            if (page && !page.loadHasStarted && typeof page.load === "function") {
              page.load();
            }
          });
        } catch (e) {}
      }

      const pages = Array.from(document.querySelectorAll(".outer_page"));
      const total = pages.length || 1;
      const pctScale = Math.round(fitScale * 100);

      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];
        if (!pageEl) continue;

        // Cuộn trang hiện tại vào trung tâm màn hình
        pageEl.scrollIntoView({ behavior: "smooth", block: "center" });

        if (scroller) {
          scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
        }

        if (window.docManager && typeof window.docManager.gotoPage === "function") {
          try { window.docManager.gotoPage(i + 1); } catch (e) {}
        }

        // Chờ trang render xong .inner_page (đặc biệt với trang cuối nạp ngầm JSONP như page 4)
        if (!pageEl.querySelector(".inner_page") || pageEl.querySelector(".page_missing, .page_loading")) {
          if (window.docManager && window.docManager.pages) {
            const pageObj = window.docManager.pages[i + 1];
            if (pageObj && typeof pageObj.load === "function") {
              try { pageObj.load(); } catch (e) {}
            }
          }
          let waitAttempts = 0;
          while (!pageEl.querySelector(".inner_page") && waitAttempts < 35) {
            await new Promise(r => setTimeout(r, 100));
            waitAttempts++;
          }
        }

        // Kích hoạt docManager nạp ảnh cho cả trang
        if (window.docManager && typeof window.docManager.loadImages === "function") {
          try { window.docManager.loadImages(pageEl); } catch (e) {}
        }

        // Quét tất cả các element ảnh (kể cả ảnh công thức nhỏ, icon, absimg)
        const pageImgs = Array.from(pageEl.querySelectorAll("img"));
        pageImgs.forEach(img => {
          img.style.setProperty("display", "block", "important");
          img.style.setProperty("visibility", "visible", "important");
          img.style.setProperty("opacity", "1", "important");

          if (!img.src || img.src === window.location.href || img.src.startsWith("data:")) {
            // Kích hoạt lazyLoad tự nhiên
            if (window.docManager && typeof window.docManager.lazyLoad === "function") {
              try { window.docManager.lazyLoad(img); } catch (e) {}
            }
            // Fallback lấy URL từ orig / data-orig
            if (!img.src || img.src === window.location.href || img.src.startsWith("data:")) {
              const orig = img.getAttribute("orig") || img.getAttribute("data-orig") || img.getAttribute("data-src");
              if (orig) {
                if (window.docManager && typeof window.docManager.subImageSrc === "function") {
                  try {
                    const subbed = window.docManager.subImageSrc(orig);
                    if (subbed) img.src = subbed;
                  } catch (e) {}
                }
                if (!img.src || img.src === window.location.href) {
                  img.src = orig;
                }
              }
            }
          }
        });

        // Chờ toàn bộ ảnh trên trang tải xong dữ liệu ảnh vào bộ nhớ trình duyệt
        if (pageImgs.length > 0) {
          await Promise.all(pageImgs.map(img => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise(resolve => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
              setTimeout(resolve, 1000); // Timeout an toàn nếu ảnh lỗi
            });
          }));
        }

        // Nhịp nghỉ nhỏ cho font và các ký hiệu math ổn định
        await new Promise(resolve => setTimeout(resolve, 400));

        const pct = Math.round(((i + 1) / total) * 90);
        if (UI) UI.updateProgress(`Đang quét nạp trang ${i + 1} / ${total} (Fit ${pctScale}%)...`, pct);
      }

      // Cuộn chạm đáy cuối cùng cho các trang tail và ổn định
      if (scroller) {
        scroller.scrollTop = scroller.scrollHeight;
        scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      await new Promise(resolve => setTimeout(resolve, 1200));
    },

    // ── 3. Xóa các element rác sau khi đã quét xong 100% ─────────
    cleanupDOM() {
      // a. Xóa class "document_scroller" để layout bung tự do theo document body
      const scroller = document.querySelector(".document_scroller");
      if (scroller) {
        scroller.classList.remove("document_scroller");
        scroller.style.overflow = "visible";
        scroller.style.height = "auto";
      }

      // b. Xóa các div overlay/toolbar rác theo đúng Step 7 & 8 trong DOCX
      document.querySelectorAll(".toolbar_drop").forEach(el => el.remove());
      document.querySelectorAll(".mobile_overlay").forEach(el => el.remove());
      document.querySelectorAll("#between_page_ads, .between_page_ads, .brand_header, .sticky_header, header, footer, .global_header, .bottom_actions").forEach(el => el.remove());

      // c. Đảm bảo tất cả các trang đều hiển thị đầy đủ, gỡ các class ẩn/mờ
      document.querySelectorAll(".outer_page").forEach(el => {
        el.classList.remove("not_visible", "blurred_page");
        el.style.setProperty("display", "block", "important");
        el.style.setProperty("visibility", "visible", "important");
        el.style.setProperty("opacity", "1", "important");
      });

      // LƯU Ý QUAN TRỌNG: Giữ nguyên `#font_preload_bed` vì DocumentManager của Scribd dùng nó để nạp font và ký hiệu đặc biệt
    }
  };
})();
