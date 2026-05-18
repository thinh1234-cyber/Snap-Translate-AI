---
component_id: 1.2
component_name: Extension Management Interfaces (Options & Popup)
---

# Extension Management Interfaces (Options & Popup)

## Component Description

Provides the administrative and entry-point UI for the extension. The Popup serves as the primary trigger for the selection engine, while the Options page manages persistent state, including API configurations (OpenAI/LocalLLM), authentication status, and user preferences stored in chrome.storage.

---

## Key References:

### d:\trans extension\js\options.js (lines 92-111)
```
async function checkAuthStatus() {
  const statusDiv = document.getElementById("auth-status");
  statusDiv.innerHTML = '<span class="status-indicator loading"></span> Đang kiểm tra...';
  
  try {
    const res = await fetch("https://chatgpt.com/api/auth/session");
    if (res.status === 200) {
      const data = await res.json();
      if (data && data.accessToken) {
        statusDiv.innerHTML = '<span class="status-indicator logged-in"></span> Đã kết nối với ChatGPT Plus (Sẵn sàng).';
      } else {
        statusDiv.innerHTML = '<span class="status-indicator logged-out"></span> Chưa đăng nhập ChatGPT. Hãy đăng nhập trên tab riêng!';
      }
    } else {
      statusDiv.innerHTML = `<span class="status-indicator logged-out"></span> Lỗi kết nối (Mã lỗi: ${res.status}). Không thể truy cập session.`;
    }
  } catch (error) {
    statusDiv.innerHTML = '<span class="status-indicator logged-out"></span> Lỗi mạng! Hãy tải lại và thử lại.';
  }
}
```


## Source Files:

- `js\options.js`
- `js\popup.js`

