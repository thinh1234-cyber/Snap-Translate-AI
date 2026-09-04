// ═══════════════════════════════════════════════════════════
// CONFIG.JS — Tham số cấu hình Snap Decode
// ═══════════════════════════════════════════════════════════

export const CONFIG = {
  APP_NAME: "Snap Decode",
  VERSION: "2.0.0",

  // ── Snap Settings ────────────────────────────────────────
  SNAP: {
    MIN_SELECTION_SIZE: 20, // Kích thước tối thiểu px để xử lý snap
    SCREENSHOT_DELAY: 50    // Delay trước khi chụp màn hình (tránh artifact)
  },

  // ── OCR & Decoder Settings ───────────────────────────────
  OCR: {
    LANGUAGES: "vie+eng",
    IDLE_TIMEOUT: 120000    // Tự động terminate WASM worker sau 2 phút idle
  },

  // ── Memory Settings ──────────────────────────────────────
  MEMORY: {
    DEFAULT_LIMIT: 50,
    MIN_LIMIT: 10,
    MAX_LIMIT: 500,
    AUTO_DELETE_DAYS: 30
  }
};
