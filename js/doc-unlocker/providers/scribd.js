// ═══════════════════════════════════════════════════════════
// PROVIDERS/SCRIBD.JS — Scribd Bypass & PDF Downloader Engine
// Tự động hóa 100% chuẩn theo các bước thủ công đã được kiểm chứng:
// 1. Chuyển sang clean embed URL: https://www.scribd.com/embeds/{id}/content
// 2. Lướt full từ trên xuống dưới để Scribd tự kích hoạt nạp tất cả các trang
// 3. Xóa đúng class "document_scroller", xóa toolbar_drop, mobile_overlay và ads
// 4. Giữ nguyên 100% CSS gốc của Scribd (không chèn print styles phá hỏng tọa độ)
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

      // Bước 1: Nếu ở trang xem thường -> Mở Clean Embed URL
      const docMatch = pathname.match(/\/(?:document|doc)\/(\d+)/);
      if (docMatch && !pathname.includes("/embeds/")) {
        const docId = docMatch[1];
        const embedUrl = `https://www.scribd.com/embeds/${docId}/content#snap_autodownload=1`;
        window.open(embedUrl, "_blank");
        return;
      }

      // Bước 2: Ở trang Embed -> Lướt full để nạp hết các trang
      UI.showProgress("Scribd Downloader", "Đang lướt nạp toàn bộ trang tài liệu...");

      await this.scrollFullDocument((msg, pct) => {
        UI.updateProgress(msg, pct);
      });

      UI.updateProgress("Đang dọn dẹp giao diện và chuẩn bị in...", 95);

      // Bước 3: Thực hiện chính xác các thao tác thủ công từ hướng dẫn
      this.cleanupDOM();

      // Gỡ bỏ hoàn toàn bất kỳ style can thiệp in nào để bảo toàn 100% CSS gốc của Scribd
      const injectedPrint = document.getElementById("snap-scribd-print-style");
      if (injectedPrint) injectedPrint.remove();

      UI.updateProgress("Hoàn tất! Đang mở hộp thoại in...", 100);

      // Bước 4: Pop up Print
      setTimeout(() => {
        UI.hideProgress();
        window.print();
      }, 500);
    },

    // ── Lướt full từ trên xuống dưới ──────────────────────────
    async scrollFullDocument(onProgress) {
      const scroller = document.querySelector(".document_scroller") || document.scrollingElement || document.documentElement;

      // Kích hoạt docManager nạp ngầm nếu có trang chưa bắt đầu
      if (window.docManager && window.docManager.pages) {
        try {
          Object.values(window.docManager.pages).forEach(page => {
            if (page && !page.loadHasStarted && typeof page.load === "function") {
              page.load();
            }
          });
        } catch (e) {}
      }

      // Quét tuần tự từng trang .outer_page
      let pages = Array.from(document.querySelectorAll(".outer_page"));
      const total = pages.length || 1;

      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
          if (scroller && typeof scroller.scrollTop === "number") {
            scroller.scrollTop = pageEl.offsetTop;
            scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
          }
          if (window.docManager && typeof window.docManager.gotoPage === "function") {
            try { window.docManager.gotoPage(i + 1); } catch (e) {}
          }
        }

        // Kích hoạt lazyLoad tự nhiên của Scribd cho ảnh trên trang nếu chưa nạp src
        if (pageEl) {
          pageEl.querySelectorAll("img.absimg, img[orig]").forEach(img => {
            if (!img.src || img.src === window.location.href) {
              if (window.docManager && typeof window.docManager.lazyLoad === "function") {
                try { window.docManager.lazyLoad(img); } catch (e) {}
              }
            }
          });
        }

        const pct = Math.round(((i + 1) / total) * 85);
        if (onProgress) onProgress(`Đang lướt nạp trang ${i + 1} / ${total}...`, pct);

        // Nhịp lướt vừa phải 800ms để Scribd tải trang
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Cuộn chạm đáy cuối cùng cho các trang tail
      if (scroller && typeof scroller.scrollTop === "number") {
        scroller.scrollTop = scroller.scrollHeight;
        scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      }

      // Đợi 1.2s cho trang cuối ổn định
      await new Promise(resolve => setTimeout(resolve, 1200));
    },

    // ── Xóa đúng các thành phần theo hướng dẫn thủ công ───────
    cleanupDOM() {
      // 1. Xóa floating button và overlay của extension
      const btn = document.getElementById("snap-doc-floating-btn");
      if (btn) btn.remove();
      const overlay = document.getElementById("snap-doc-overlay");
      if (overlay) overlay.remove();

      // 2. Bước 6 từ DOCX: Xóa đúng chữ "document_scroller"
      // KHÔNG can thiệp style inline (position, overflow, height...) để giữ nguyên gốc layout
      const scroller = document.querySelector(".document_scroller");
      if (scroller) {
        scroller.classList.remove("document_scroller");
      }

      // 3. Bước 7 & 8 từ DOCX: Xóa toolbar_drop, mobile_overlay và quảng cáo
      document.querySelectorAll(".toolbar_drop").forEach(el => el.remove());
      document.querySelectorAll(".mobile_overlay").forEach(el => el.remove());
      document.querySelectorAll("#between_page_ads, .between_page_ads").forEach(el => el.remove());

      // 4. Bỏ class not_visible và blurred_page nếu có
      document.querySelectorAll(".outer_page.not_visible").forEach(el => el.classList.remove("not_visible"));
      document.querySelectorAll(".outer_page.blurred_page").forEach(el => el.classList.remove("blurred_page"));
    }
  };
})();
