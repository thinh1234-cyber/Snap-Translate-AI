// ═══════════════════════════════════════════════════════════
// DOC-UNLOCKER/INDEX.JS — Main Orchestrator / Caller Module
// Coordinates UI and routes execution to registered site providers
// ═══════════════════════════════════════════════════════════

(() => {
  const providers = [
    window.__SnapDocScribd,
    window.__SnapDocStudocu,
    window.__SnapDocSlideShare
  ].filter(Boolean);

  window.__SnapDocRouter = {
    getProvider() {
      const host = window.location.hostname;
      return providers.find(p => p && p.isMatch(host));
    },

    dispatch() {
      const provider = this.getProvider();
      if (provider) {
        provider.execute(window.__SnapDocUI);
      } else {
        alert("Trang hiện tại không thuộc danh sách hỗ trợ (Scribd, StuDocu, SlideShare)!");
      }
    },

    init() {
      const provider = this.getProvider();
      if (!provider) return;

      // 1. Inject Floating Action Button on matched sites
      window.__SnapDocUI.injectFloatingButton(() => {
        this.dispatch();
      });

      // 2. Check auto-download trigger
      if (window.location.hash.includes("snap_autodownload=1")) {
        const runAuto = () => setTimeout(() => this.dispatch(), 1200);
        if (document.readyState === "complete" || document.readyState === "interactive") {
          runAuto();
        } else {
          window.addEventListener("DOMContentLoaded", runAuto);
        }
      }
    }
  };

  // Auto-init router on page load
  window.__SnapDocRouter.init();
})();
