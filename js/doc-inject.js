// ═══════════════════════════════════════════════════════════
// DOC-INJECT.JS — DocUnlocker (Scribd & StuDocu PDF Downloader)
// Pure Client-side DOM Injection, Lazy-load Scroller & Print Engine
// ═══════════════════════════════════════════════════════════

(() => {
  if (window.__snapDocUnlockerInjected) return;
  window.__snapDocUnlockerInjected = true;

  const currentHost = window.location.hostname;
  const isScribd = currentHost.includes("scribd.com");
  const isStudocu = currentHost.includes("studocu.com");

  if (!isScribd && !isStudocu) return;

  // ── Listen for messages from background/popup ──────────────
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TRIGGER_DOC_DOWNLOAD") {
      startDownloadFlow();
      sendResponse({ status: "STARTED" });
      return true;
    }
  });

  // ── Check auto-download hash trigger ────────────────────────
  if (window.location.hash.includes("snap_autodownload=1")) {
    window.addEventListener("DOMContentLoaded", () => {
      setTimeout(startDownloadFlow, 1500);
    });
    // Fallback if already loaded
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(startDownloadFlow, 1500);
    }
  }

  // ── Inject Smart Floating Action Button ────────────────────
  function injectFloatingButton() {
    if (document.getElementById("snap-doc-floating-btn")) return;

    const btn = document.createElement("button");
    btn.id = "snap-doc-floating-btn";
    btn.innerHTML = `
      <span style="font-size: 16px;">⚡</span>
      <span>Tải PDF Sạch</span>
    `;
    btn.setAttribute("style", `
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      z-index: 2147483640 !important;
      background: linear-gradient(135deg, #1a73e8, #0d47a1) !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 50px !important;
      padding: 12px 20px !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      cursor: pointer !important;
      box-shadow: 0 8px 24px rgba(26, 115, 232, 0.4) !important;
      transition: all 0.25s ease !important;
    `);

    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "translateY(-3px) scale(1.03)";
      btn.style.boxShadow = "0 12px 28px rgba(26, 115, 232, 0.5)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translateY(0) scale(1)";
      btn.style.boxShadow = "0 8px 24px rgba(26, 115, 232, 0.4)";
    });

    btn.addEventListener("click", () => {
      startDownloadFlow();
    });

    document.body.appendChild(btn);
  }

  // Inject floating button when ready
  if (document.body) {
    injectFloatingButton();
  } else {
    window.addEventListener("DOMContentLoaded", injectFloatingButton);
  }

  // ── Main Download Router ────────────────────────────────────
  function startDownloadFlow() {
    if (isScribd) {
      handleScribdFlow();
    } else if (isStudocu) {
      handleStudocuFlow();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 1. SCRIBD DOWNLOAD ENGINE
  // ═══════════════════════════════════════════════════════════
  function handleScribdFlow() {
    const pathname = window.location.pathname;

    // Case A: User is on regular Scribd document view (e.g. /document/12345/...)
    const docMatch = pathname.match(/\/(?:document|doc)\/(\d+)/);
    if (docMatch && !pathname.includes("/embeds/")) {
      const docId = docMatch[1];
      const embedUrl = `https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll#snap_autodownload=1`;
      window.open(embedUrl, "_blank");
      return;
    }

    // Case B: User is on embed page (or redirected with hash)
    showProgressOverlay("Scribd Downloader", "Đang khởi tạo nạp tài liệu...");

    // Remove Scribd bloat & restrictive layouts
    cleanScribdDOM();

    // Scroll through all pages
    scrollAllScribdPages(() => {
      updateProgressOverlay("Hoàn tất nạp!", 100);
      setTimeout(() => {
        hideProgressOverlay();
        injectScribdPrintStyles();
        window.print();
      }, 800);
    });
  }

  function cleanScribdDOM() {
    const selectorsToRemove = [
      ".toolbar_drop",
      ".mobile_overlay",
      "#between_page_ads",
      ".between_page_ads",
      ".autogen_class_views_read_autogen_embed_toolbar",
      ".brand_header",
      ".sticky_header",
      "header",
      "footer"
    ];

    selectorsToRemove.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.remove());
    });

    // Make scrollers full height & visible
    const scroller = document.querySelector(".document_scroller");
    if (scroller) {
      scroller.style.overflow = "visible";
      scroller.style.height = "auto";
      scroller.style.position = "static";
    }

    document.documentElement.style.overflow = "visible";
    document.body.style.overflow = "visible";
  }

  function scrollAllScribdPages(onComplete) {
    const pages = Array.from(document.querySelectorAll(".outer_page, .page_missing, [data-page]"));
    const totalPages = pages.length || 1;
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex >= pages.length) {
        clearInterval(interval);
        window.scrollTo(0, 0);
        onComplete();
        return;
      }

      const pageEl = pages[currentIndex];
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      currentIndex++;
      const percent = Math.min(100, Math.round((currentIndex / totalPages) * 100));
      updateProgressOverlay(`Đang nạp trang ${currentIndex} / ${totalPages}...`, percent);
    }, 250);
  }

  function injectScribdPrintStyles() {
    if (document.getElementById("snap-scribd-print-style")) return;

    const style = document.createElement("style");
    style.id = "snap-scribd-print-style";
    style.innerHTML = `
      @media print {
        @page { size: auto; margin: 0; }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: visible !important;
          height: auto !important;
        }
        .document_scroller {
          overflow: visible !important;
          height: auto !important;
          position: static !important;
        }
        .outer_page {
          page-break-after: always !important;
          break-after: page !important;
          margin: 0 auto !important;
          box-shadow: none !important;
          border: none !important;
        }
        .page_missing, .loading_page {
          display: none !important;
        }
        .toolbar_drop, .mobile_overlay, #between_page_ads, .between_page_ads,
        .autogen_class_views_read_autogen_embed_toolbar,
        #snap-doc-floating-btn, #snap-doc-overlay {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ═══════════════════════════════════════════════════════════
  // 2. STUDOCU DOWNLOAD ENGINE
  // ═══════════════════════════════════════════════════════════
  function handleStudocuFlow() {
    showProgressOverlay("StuDocu Downloader", "Đang mở khóa nội dung & gỡ bỏ giới hạn...");

    // 1. Remove CSS Blurs and Paywalls
    unblurStudocu();

    // 2. Auto-scroll to load all pages
    scrollAllStudocuPages(() => {
      updateProgressOverlay("Hoàn tất mở khóa!", 100);
      setTimeout(() => {
        hideProgressOverlay();
        injectStudocuPrintStyles();
        window.print();
      }, 800);
    });
  }

  function unblurStudocu() {
    // Inject permanent unblur rule
    const style = document.createElement("style");
    style.id = "snap-studocu-unblur-style";
    style.innerHTML = `
      .blurred-page, [class*="blurred"], [class*="blur-"] {
        filter: none !important;
        -webkit-filter: none !important;
        opacity: 1 !important;
      }
      #paywall, #paywall-wrapper, .paywall, [class*="paywall"],
      [data-test-id*="paywall"], .banner-wrapper, [class*="banner"],
      div[class*="viewer-banner"], div[id*="banner"], div[class*="upsell"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      body, * {
        user-select: auto !important;
        -webkit-user-select: auto !important;
      }
    `;
    document.head.appendChild(style);

    // Gỡ bỏ inline filters
    document.querySelectorAll('*').forEach(el => {
      if (el.style && el.style.filter && el.style.filter.includes('blur')) {
        el.style.filter = 'none';
      }
    });

    // Xóa các phần tử banner/paywall trong DOM
    const removeSelectors = [
      "#paywall-wrapper",
      ".paywall-wrapper",
      "[class*='paywall']",
      "[data-test-id*='paywall']",
      ".banner-wrapper"
    ];
    removeSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.remove());
    });
  }

  function scrollAllStudocuPages(onComplete) {
    const pageContainers = Array.from(document.querySelectorAll("[data-page-no], .page-container, [class*='page_wrapper'], [class*='Page_page']"));
    const totalPages = pageContainers.length || Math.max(1, Math.floor(document.documentElement.scrollHeight / window.innerHeight));
    let currentStep = 0;

    const scrollStep = () => {
      if (currentStep >= pageContainers.length && pageContainers.length > 0) {
        window.scrollTo(0, 0);
        onComplete();
        return;
      }

      if (pageContainers.length > 0) {
        pageContainers[currentStep].scrollIntoView({ behavior: "smooth", block: "center" });
        currentStep++;
        const percent = Math.min(100, Math.round((currentStep / totalPages) * 100));
        updateProgressOverlay(`Đang nạp trang ${currentStep} / ${totalPages}...`, percent);
        setTimeout(scrollStep, 300);
      } else {
        // Fallback: window scroll by viewports
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const currentScroll = window.scrollY;
        if (currentScroll >= maxScroll) {
          window.scrollTo(0, 0);
          onComplete();
          return;
        }
        window.scrollBy(0, window.innerHeight * 0.8);
        const percent = Math.min(99, Math.round((window.scrollY / maxScroll) * 100));
        updateProgressOverlay(`Đang nạp trang... (${percent}%)`, percent);
        setTimeout(scrollStep, 300);
      }
    };

    scrollStep();
  }

  function injectStudocuPrintStyles() {
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
        }
        #document-wrapper, .document-container, .page-container {
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .page-container, [data-page-no], [class*="Page_page"] {
          page-break-after: always !important;
          break-after: page !important;
          box-shadow: none !important;
          border: none !important;
          margin: 0 auto !important;
        }
        nav, header, footer, aside, .sidebar, #sidebar, [class*="sidebar"],
        #snap-doc-floating-btn, #snap-doc-overlay {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ═══════════════════════════════════════════════════════════
  // 3. PROGRESS MODAL OVERLAY
  // ═══════════════════════════════════════════════════════════
  function showProgressOverlay(title, initialStatus) {
    if (document.getElementById("snap-doc-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "snap-doc-overlay";
    overlay.innerHTML = `
      <div style="
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px);
        z-index: 2147483647; display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="
          background: #ffffff; width: 380px; max-width: 90%;
          border-radius: 16px; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          text-align: center; color: #202124;
        ">
          <div style="font-size: 36px; margin-bottom: 8px;">⚡</div>
          <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #1a73e8;">${title}</h3>
          <p id="snap-doc-status" style="margin: 0 0 16px; font-size: 13px; color: #5f6368;">${initialStatus}</p>
          
          <div style="background: #e8eaed; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 16px;">
            <div id="snap-doc-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #1a73e8, #00c6ff); border-radius: 4px; transition: width 0.2s;"></div>
          </div>
          
          <small style="color: #80868b; font-size: 11px;">Vui lòng giữ nguyên tab trong quá trình nạp trang...</small>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function updateProgressOverlay(status, percent) {
    const statusEl = document.getElementById("snap-doc-status");
    const barEl = document.getElementById("snap-doc-bar");
    if (statusEl) statusEl.textContent = status;
    if (barEl) barEl.style.width = `${percent}%`;
  }

  function hideProgressOverlay() {
    const overlay = document.getElementById("snap-doc-overlay");
    if (overlay) overlay.remove();
  }
})();
