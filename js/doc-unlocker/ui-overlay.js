// ═══════════════════════════════════════════════════════════
// UI-OVERLAY.JS — Shared UI Components for DocUnlocker
// Floating Button & Progress Modal Overlay
// ═══════════════════════════════════════════════════════════

(() => {
  window.__SnapDocUI = {
    injectFloatingButton(onClick) {
      if (document.getElementById("snap-doc-floating-btn")) return;

      const btn = document.createElement("button");
      btn.id = "snap-doc-floating-btn";
      btn.innerHTML = `
        <span style="font-size: 16px;">⚡</span>
        <span>Tải PDF</span>
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

      btn.addEventListener("click", onClick);

      // Ensure print styles completely hide floating button across all websites
      if (!document.getElementById("snap-doc-shared-print-style")) {
        const pStyle = document.createElement("style");
        pStyle.id = "snap-doc-shared-print-style";
        pStyle.textContent = `
          @media print {
            #snap-doc-floating-btn,
            #snap-doc-overlay {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
            }
          }
        `;
        document.head.appendChild(pStyle);
      }

      window.addEventListener("beforeprint", () => {
        btn.style.setProperty("display", "none", "important");
      });
      window.addEventListener("afterprint", () => {
        btn.style.setProperty("display", "flex", "important");
      });

      const appendBtn = () => {
        if (document.body && !document.getElementById("snap-doc-floating-btn")) {
          document.body.appendChild(btn);
        }
      };

      if (document.body) {
        appendBtn();
      } else {
        window.addEventListener("DOMContentLoaded", appendBtn);
      }
    },

    showProgress(title, initialStatus) {
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
            
            <small style="color: #80868b; font-size: 11px;">Vui lòng giữ nguyên tab trong quá trình mở khóa...</small>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    },

    updateProgress(status, percent) {
      const statusEl = document.getElementById("snap-doc-status");
      const barEl = document.getElementById("snap-doc-bar");
      if (statusEl) statusEl.textContent = status;
      if (barEl) barEl.style.width = `${percent}%`;
    },

    hideProgress() {
      const overlay = document.getElementById("snap-doc-overlay");
      if (overlay) overlay.remove();
    }
  };
})();
