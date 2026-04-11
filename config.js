// ═══════════════════════════════════════════════════════════
// CONFIG.JS — Tập trung toàn bộ tham số có thể tuỳ chỉnh
// ═══════════════════════════════════════════════════════════

const CONFIG = {

  // ── ChatGPT URL ──────────────────────────────────────────
  CHATGPT_URL_PATTERN: "*://chatgpt.com/*",
  CHATGPT_NEW_TAB_URL: "https://chatgpt.com/",

  // ── DOM Selectors (ChatGPT) ──────────────────────────────
  // Nếu ChatGPT đổi giao diện, chỉ cần sửa ở đây
  SELECTORS: {
    TEXTAREA: "#prompt-textarea",
    SEND_BUTTON: '[data-testid="send-button"]',
    STOP_BUTTON: [
      '[data-testid="stop-button"]',
      'button[aria-label="Stop generating"]'
    ],
    ASSISTANT_MESSAGE: '[data-message-author-role="assistant"]'
  },

  // ── Timing (ms) ──────────────────────────────────────────
  TIMING: {
    // Thời gian chờ textarea xuất hiện
    WAIT_ELEMENT_TIMEOUT: 2000,

    // Kiểm tra nút Send mỗi bao lâu
    SEND_BUTTON_CHECK_INTERVAL: 300,
    // Số lần kiểm tra tối đa (20 x 300ms = 6 giây)
    SEND_BUTTON_MAX_ATTEMPTS: 20,

    // ⚡ Background polling: Mỗi bao lâu background gửi tin hỏi ChatGPT tab
    BACKGROUND_POLL_INTERVAL: 300,

    // ⏳ Thời gian chờ tối thiểu sau khi bấm Send trước khi chấp nhận kết quả
    // ChatGPT cần ~5-10s để phân tích ảnh trước khi bắt đầu trả lời
    MIN_WAIT_AFTER_SEND: 8000,

    // Text đứng im bao lâu (ms thực) thì coi là đã xong
    // Đặt >= 3000 để tránh cắt giữa chừng khi ChatGPT tạm dừng giữa đoạn
    RESPONSE_STABLE_DURATION: 3000,

    // Timeout bảo vệ tối đa
    RESPONSE_TIMEOUT: 120000,

    // Thời gian chờ React hydrate khi tạo tab mới
    REACT_HYDRATE_DELAY: 2000,

    // Delay trước khi chụp screenshot (tránh artifact)
    SCREENSHOT_DELAY: 50
  },

  // ── Snap Settings ────────────────────────────────────────
  SNAP: {
    MIN_SELECTION_SIZE: 20
  },

  // ── Prompt mặc định ──────────────────────────────────────
  DEFAULT_SPECIALTY: "chung",
  PROMPT_TEMPLATE: (specialty, customRules) => {
    let prompt = `Bóc tách văn bản trong ảnh và dịch sang tiếng Việt. (Dịch sát theo ngữ cảnh chuyên môn: ${specialty}).`;
    if (customRules) {
      prompt += `\nCustom Rules: ${customRules}`;
    }
    return prompt;
  }
};
