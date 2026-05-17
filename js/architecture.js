document.addEventListener('DOMContentLoaded', () => {
    const nodeData = {
      1: {
        title: "🌐 Content Script",
        desc: "Chạy trên mọi tab web. Lắng nghe sự kiện kéo chuột, tạo overlay crop, xử lý OCR và hiển thị popup kết quả.",
        flows: ["Nhận lệnh START_SNAP từ Background", "Tạo overlay kính râm cho crop", "Gửi ảnh chụp về Background", "Hiển thị popup kết quả dịch/QR"]
      },
      2: {
        title: "🔀 Background Service Worker",
        desc: "Trung tâm điều phối toàn bộ extension. Nhận message từ popup/content, routing đến OCR, Translation, ChatGPT hoặc Memory.",
        flows: ["Routing CAPTURE_SCREEN → Content Script", "Routing TRANSLATE_IMAGE → Translation Engine", "Routing SAVE_SNAP → Memory Manager", "Routing OPEN_CHATGPT → ChatGPT Bridge", "Quản lý lifecycle của extension"]
      },
      3: {
        title: "🤖 ChatGPT Automator",
        desc: "Ký sinh trong Tab ChatGPT. Đi chung đường hầm với Web chính thống để vượt mọi tường lửa bảo mật.",
        flows: ["Mở tab ChatGPT mới", "Inject prompt và paste ảnh ảo", "Đợi nút Send sáng lên", "Bóc rút kết quả từ DOM"]
      },
      4: {
        title: "✂️ Crop & Overlay",
        desc: "Tạo layer kính râm (overlay), tính toán góc tọa độ và cắt hình ảnh tĩnh bằng thuật toán không gian dpr.",
        flows: ["Vẽ overlay bán trong suốt", "Theo dõi mouse drag", "Tính toán rect crop với DPR", "Trả về tọa độ cho Background"]
      },
      5: {
        title: "🖼 Canvas → Base64",
        desc: "Chuyển mảng pixel đã cắt thành mã Base64 cực nhẹ. Nếu dính chướng ngại là QR Mode, nó tự rẽ nhánh.",
        flows: ["Tạo canvas từ rect crop", "Vẽ ảnh vào canvas", "Export sang PNG Base64", "Gửi về Background"]
      },
      6: {
        title: "📱 Popup Kết quả",
        desc: "In kết quả siêu mượt trên màn hình dưới dạng Draggable Box. Tự đổi link thành thẻ màu xanh.",
        flows: ["Hiển thị OCR text", "Hiển thị bản dịch", "Nút Copy/Export", "Nút Dịch bằng ChatGPT"]
      },
      7: {
        title: "📷 jsQR Engine (Offline)",
        desc: "Không cần Internet! Đây là nơ-ron Offline giải mã ma trận ảnh sang Text ngay trong 0.05 giây tại máy người dùng.",
        flows: ["Nhận imageData từ canvas", "Quét ma trận QR", "Trả về data string", "Lưu vào Memory"]
      },
      8: {
        title: "🔁 Retry Logic",
        desc: "Bảo hiểm 3 lớp của Background. Nếu gọi Tab ChatGPT không dậy, nó sẽ thử réo chuông 3 lần, mỗi lần 1.5s.",
        flows: ["Thử inject script lần 1", "Retry lần 2 sau 1.5s", "Retry lần 3 sau 3s", "Báo lỗi nếu thất bại"]
      },
      9: {
        title: "⚡ Auto Wake-up",
        desc: "Đánh hơi thấy tab ChatGPT bị Chrome hút cạn RAM (Discarded) sẽ tự nạp điện (Reload) lại tab.",
        flows: ["Kiểm tra tab.discarded", "Reload tab nếu cần", "Đợi tab load xong", "Gửi lại message"]
      },
      11: {
        title: "🔒 Mutex Lock",
        desc: "Cái khiên chặn spam. Biến isAutomating chặn đứng những người dùng táy máy bấm Snap 5 lần 1 lượt gây cháy bu-gi.",
        flows: ["Set flag khi bắt đầu snap", "Chặn request trùng lặp", "Release flag khi hoàn tất", "Timeout sau 30s"]
      },
      12: {
        title: "📋 Hack Paste Ảo",
        desc: "Sử dụng API ClipboardEvent để lừa khung chat ChatGPT nghĩ rằng con người vừa bấm Ctrl+V dán ảnh.",
        flows: ["Tạo ClipboardEvent giả", "Gán ảnh Base64 vào event", "Dispatch vào input ChatGPT", "Đợi ChatGPT xử lý"]
      },
      13: {
        title: "🎯 Săn Nút Send",
        desc: "Một thuật toán thiên tài không tốn CPU. Ngồi chờ nút Send mờ đi, và đến khi nó sáng lại (bấm được) => Kết thúc!",
        flows: ["Poll DOM mỗi 200ms", "Kiểm tra nút Send disabled", "Khi enabled → click", "Trả về kết quả"]
      },
      14: {
        title: "🔪 Bóc lõi .markdown",
        desc: "Khinh bỉ text rác, đâm thẳng vào div class='markdown' bóc rút sự thật trần trụi. Sai số gần như 0.",
        flows: ["Query selector div.markdown", "Lấy textContent", "Loại bỏ ký tự thừa", "Trả về translation"]
      },
      15: {
        title: "🧠 ChatGPT Web Brain",
        desc: "Máy chủ LLM nằm ở cổng Web Chat OpenAI. Xử lý vision + translation qua giao diện web.",
        flows: ["Nhận ảnh + prompt", "Phân tích vision", "Trả về bản dịch", "Automator bóc rút kết quả"]
      },
      16: {
        title: "🔗 API/Local Channel",
        desc: "Trạm API kết nối Server lớn bằng Authorization Key hoặc gọi thẳng xuống Local Host (LM Studio / Ollama) siêu mượt.",
        flows: ["Gửi POST /v1/chat/completions", "Nhận JSON response", "Parse translation", "Trả về Content Script"]
      },
      17: {
        title: "🔍 Tesseract OCR",
        desc: "Phép màu thời gian: Bóc tách text khỏi hình ảnh trước khi gửi đi, giảm tải 1000 lần cho AI, không còn Analysis Image.",
        flows: ["Load WASM core", "Nhận diện ký tự (vie+eng)", "Trả về text string", "Lưu vào Memory"]
      },
      18: {
        title: "💾 Memory Storage",
        desc: "Lưu lịch sử snap vào chrome.storage.local. Hỗ trợ search, delete, copy. Tối đa 100 entries.",
        flows: ["SAVE_SNAP: Thêm entry mới", "GET_SNAP_HISTORY: Lấy danh sách", "SEARCH: Lọc theo keyword", "DELETE/CLEAR: Xóa entry"]
      }
    };

    const nodes = new vis.DataSet([
      { id: 1, label: "Content Script", group: "uiMain", size: 40, shape: "hexagon" },
      { id: 2, label: "Background SW", group: "swMain", size: 50, shape: "hexagon" },
      { id: 3, label: "ChatGPT Bot", group: "botMain", size: 40, shape: "hexagon" },
      { id: 15, label: "ChatGPT Web", group: "core", size: 45, shape: "diamond" },
      { id: 16, label: "API/Local", group: "core", size: 45, shape: "diamond" },
      { id: 18, label: "Memory", group: "memory", size: 35, shape: "box" },

      { id: 4, label: "Crop & Overlay", group: "uiNode" },
      { id: 5, label: "Canvas Base64", group: "uiNode" },
      { id: 6, label: "Popup Result", group: "uiNode" },
      { id: 7, label: "jsQR Offline", group: "offlineNode" },
      { id: 17, label: "Tesseract OCR", group: "offlineNode", size: 28 },

      { id: 8, label: "Retry Logic", group: "swNode" },
      { id: 9, label: "Auto Wake-up", group: "swNode" },

      { id: 11, label: "Mutex Lock", group: "botNode" },
      { id: 12, label: "Paste Ảo", group: "botNode" },
      { id: 13, label: "Săn Nút Send", group: "botNode" },
      { id: 14, label: "Bóc .markdown", group: "botNode" }
    ]);

    const edges = new vis.DataSet([
      { from: 4, to: 1, arrows: 'to', title: 'Kích hoạt' },
      { from: 1, to: 5, arrows: 'to' },
      { from: 5, to: 7, arrows: 'to', label: 'QR Mode', dashes: true, color: {color: '#00e676'} },
      { from: 7, to: 6, arrows: 'to', label: '< 0.05s', color: {color: '#00e676'} },
      { from: 7, to: 18, arrows: 'to', color: {color: '#ffc107'} },

      { from: 5, to: 17, arrows: 'to', label: 'OCR', dashes: true, color: {color: '#00e676'} },
      { from: 17, to: 2, arrows: 'to', label: 'Text', color: {color: '#00e5ff'} },
      { from: 17, to: 18, arrows: 'to', color: {color: '#ffc107'} },

      { from: 5, to: 2, arrows: 'to', label: 'Base64', color: {color: '#00e5ff'} },
      { from: 2, to: 6, arrows: 'to', label: 'Kết quả', color: {color: '#ff4081'} },

      { from: 2, to: 9, arrows: 'to', label: 'Web Channel' },
      { from: 2, to: 16, arrows: 'to', label: 'API Call', color: {color: '#ff3d00'} },
      { from: 16, to: 2, arrows: 'to', label: 'Response', color: {color: '#ff4081'} },
      { from: 16, to: 18, arrows: 'to', color: {color: '#ffc107'} },

      { from: 9, to: 8, arrows: 'to' },
      { from: 8, to: 3, arrows: 'to', label: 'Inject', color: {color: '#e040fb'} },

      { from: 3, to: 11, arrows: 'to' },
      { from: 11, to: 12, arrows: 'to' },
      { from: 12, to: 15, arrows: 'to', label: 'Paste', color: {color: '#ffeb3b'} },
      { from: 15, to: 13, arrows: 'to', label: 'DOM', color: {color: '#ffeb3b'} },
      { from: 13, to: 14, arrows: 'to' },
      { from: 14, to: 2, arrows: 'to', label: 'Translation', color: {color: '#ff4081'} },

      { from: 2, to: 18, arrows: 'to', label: 'Save Snap', color: {color: '#ffc107'} },
    ]);

    const container = document.getElementById('mynetwork');
    const data = { nodes: nodes, edges: edges };
    const options = {
      nodes: {
        shape: 'dot',
        size: 25,
        font: { size: 13, color: '#ffffff', face: 'Segoe UI' },
        borderWidth: 2,
        shadow: true
      },
      edges: {
        width: 1.5,
        shadow: true,
        smooth: { type: 'cubicBezier' },
        font: { size: 11, color: '#a0aec0', face: 'Segoe UI', align: 'top' }
      },
      groups: {
        uiMain: { color: { background: '#2196f3', border: '#1976d2' } },
        swMain: { color: { background: '#f50057', border: '#c51162' } },
        botMain: { color: { background: '#9c27b0', border: '#7b1fa2' } },
        core: { color: { background: '#ff3d00', border: '#dd2c00' } },
        memory: { color: { background: '#ffc107', border: '#ffa000' } },

        uiNode: { color: { background: '#64b5f6', border: '#42a5f5' } },
        swNode: { color: { background: '#ff80ab', border: '#ff4081' } },
        botNode: { color: { background: '#e1bee7', border: '#e040fb' } },
        offlineNode: { color: { background: '#00e676', border: '#00c853' } }
      },
      physics: {
        forceAtlas2Based: {
          gravitationalConstant: -80,
          centralGravity: 0.005,
          springLength: 180,
          springConstant: 0.06
        },
        maxVelocity: 50,
        solver: 'forceAtlas2Based',
        timestep: 0.35,
        stabilization: { iterations: 200 }
      },
      interaction: {
        hover: true,
        tooltipDelay: 150,
        zoomView: true,
        dragView: true,
        dragNodes: true
      }
    };

    const network = new vis.Network(container, data, options);
    let physicsEnabled = true;

    network.on("click", function (params) {
      const panelBody = document.getElementById('panel-body');

      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const info = nodeData[nodeId];

        if (info) {
          const connectedEdges = network.getConnectedEdges(nodeId);
          const edgeDetails = connectedEdges.map(edgeId => {
            const edge = edges.get(edgeId);
            const fromNode = nodes.get(edge.from);
            const toNode = nodes.get(edge.to);
            return `${fromNode.label} → ${toNode.label}${edge.label ? ` (${edge.label})` : ''}`;
          });

          panelBody.innerHTML = `
            <b style="font-size:15px; color:#00e5ff;">${info.title}</b>
            <p style="margin-top:8px;">${info.desc}</p>
            <div style="margin-top:12px;">
              <b style="font-size:12px; color:#718096;">DATA FLOWS:</b>
              <ul class="flow-list">
                ${info.flows.map(f => `<li>${f}</li>`).join('')}
              </ul>
            </div>
            <div style="margin-top:12px;">
              <b style="font-size:12px; color:#718096;">CONNECTIONS (${connectedEdges.length}):</b>
              <ul class="flow-list">
                ${edgeDetails.map(e => `<li>${e}</li>`).join('')}
              </ul>
            </div>
          `;

          const box = document.getElementById('info-box');
          box.style.boxShadow = '0 8px 30px rgba(0, 229, 255, 0.4)';
          setTimeout(() => {
            box.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
          }, 300);
        }
      } else {
        panelBody.innerHTML = `
          <div class="default-desc">
            <p>Hệ thống được biểu diễn dưới dạng <span class="highlight">Mạng Nơ-ron tương tác</span>.</p>
            <p style="margin-top:8px;">👆 <b>Nhấn vào node</b> để xem chi tiết<br>🖱 <b>Cuộn chuột</b> để Zoom<br>✋ <b>Kéo thả</b> để xoay không gian</p>
          </div>
        `;
      }
    });

    network.on("hoverNode", function(params) {
      const node = nodes.get(params.node);
      if (node) {
        nodes.update({ id: params.node, borderWidth: 4 });
      }
    });

    network.on("blurNode", function(params) {
      nodes.update({ id: params.node, borderWidth: 2 });
    });

    document.getElementById("close-btn").addEventListener("click", () => window.close());
    document.getElementById("close-panel-btn").addEventListener("click", () => {
      document.getElementById('panel-body').innerHTML = `
        <div class="default-desc">
          <p>Hệ thống được biểu diễn dưới dạng <span class="highlight">Mạng Nơ-ron tương tác</span>.</p>
          <p style="margin-top:8px;">👆 <b>Nhấn vào node</b> để xem chi tiết<br>🖱 <b>Cuộn chuột</b> để Zoom<br>✋ <b>Kéo thả</b> để xoay không gian</p>
        </div>
      `;
    });

    document.getElementById("reset-view-btn").addEventListener("click", () => {
      network.fit();
    });

    document.getElementById("toggle-physics-btn").addEventListener("click", () => {
      physicsEnabled = !physicsEnabled;
      network.setOptions({ physics: { enabled: physicsEnabled } });
      document.getElementById("toggle-physics-btn").textContent = physicsEnabled ? "⏸ Tạm dừng Physics" : "▶ Bật Physics";
    });
});
