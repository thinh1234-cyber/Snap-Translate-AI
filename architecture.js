document.addEventListener('DOMContentLoaded', () => {
    // Dictionary lưu nội dung của từng Not
    const nodeData = {
      1: { title: "Nơ-ron: Giao diện (content.js)", desc: "Trạm gác tiền tuyến. Nằm trên mọi website. Lắng nghe hành vi kéo chuột bôi đen của người dùng." },
      2: { title: "Nơ-ron: Background (Trạm Thu Phát)", desc: "Trạm không lưu (Routing Dispatcher). Nhận config Option và quyết định phân luồng tin nhắn rẽ qua Web ChatGPT, Server API hay bẻ lái xuống Local API ở localhost." },
      3: { title: "Nơ-ron: Khối Robot (Automator)", desc: "Ký sinh trong Tab ChatGPT. Đi chung đường hầm với Web chính thống để vượt mọi tường lửa bảo mật." },
      4: { title: "Hành vi: Bôi đen & Cắt", desc: "Tạo layer kính râm (overlay), tính toán góc tọa độ và cắt hình ảnh tĩnh bằng thuật toán không gian dpr." },
      5: { title: "Hành vi: Render Canvas", desc: "Chuyển mảng pixel đã cắt thành mã Base64 cực nhẹ. Nêu dính chướng ngại là QR Mode, nó tự rẽ nhánh." },
      6: { title: "Hiển thị: Popup Dịch", desc: "In kết quả siêu mượt trên màn hình dưới dạng Draggable Box. Tự đổi link thành thẻ màu xanh." },
      7: { title: "Module Độc Lập: jsQR", desc: "Không cần Internet! Đây là nơ-ron Offline giải mã ma trận ảnh sang Text ngay trong 0.05 giây tại máy người dùng." },
      8: { title: "Giải thuật: Retry 3 Vòng", desc: "Bảo hiểm 3 lớp của Background. Nếu gọi Tab ChatGPT không dậy, nó sẽ thử réo chuông 3 lần, mỗi lần 1.5s." },
      9: { title: "Kỹ năng: Auto Wake-up", desc: "Đánh hơi thấy tab ChatGPT bị Chrome hút cạn RAM (Discarded) sẽ tự nạp điện (Reload) lại tab." },
      11: { title: "Khoá luồng (Mutex Lock)", desc: "Cái khiên chặn spam. Biến `isAutomating` chặn đứng những người dùng táy máy bấm Snap 5 lần 1 lượt gây cháy bu-gi." },
      12: { title: "Kỹ năng: Paste Ảo", desc: "Sử dụng API ClipboardEvent để lừa khung chat ChatGPT nghĩ rằng con người vừa bấm Ctrl+V dán ảnh." },
      13: { title: "Giải thuật: Vòng đời Nút Send", desc: "Một thuật toán thiên tài không tốn CPU. Ngồi chờ nút Send mờ đi, và đến khi nó sáng lại (bấm được) => Kết thúc!" },
      14: { title: "Kỹ năng: Bóc Lõi Markdown", desc: "Khinh bỉ text rác, đâm thẳng vào `<div class=\"markdown\">` bóc rút sự thật trần trụi. Sai số gần như 0." },
      15: { title: "Thực thể: ChatGPT Web Brain", desc: "Máy chủ LLM nằm ở cổng Web Chat OpenAI." },
      16: { title: "Thực thể: Đa Kênh (API/Local)", desc: "Trạm API kết nối Server lớn bằng Authorization Key hoặc gọi thẳng xuống Local Host (LM Studio / Ollama) siêu mượt." },
      17: { title: "Tiền trạm: Tesseract OCR (Offline)", desc: "Phép màu thời gian: Bóc tách text khỏi hình ảnh trước khi gửi đi, giảm tải 1000 lần cho AI, không còn Analysis Image." }
    };

    // Khởi tạo các điểm Nơ-ron
    const nodes = new vis.DataSet([
      // Các nhân chính (Lớn)
      { id: 1, label: "Giao diện (Content)", group: "uiMain", size: 45, shape: "hexagon" },
      { id: 2, label: "Routing Control (Background)", group: "swMain", size: 55, shape: "hexagon" },
      { id: 3, label: "Khối Robot (Automator)", group: "botMain", size: 45, shape: "hexagon" },
      { id: 15, label: "ChatGPT Kết nối Web", group: "core", size: 50, shape: "diamond" },
      { id: 16, label: "Kênh API Độc lập", group: "core", size: 50, shape: "diamond" },
      
      // Các nơ-ron chức năng UI
      { id: 4, label: "Bôi đen & Cắt", group: "uiNode" },
      { id: 5, label: "Chiết xuất Base64/Canvas", group: "uiNode" },
      { id: 6, label: "Popup Hiển thị", group: "uiNode" },
      { id: 7, label: "Lõi jsQR (Offline)", group: "offlineNode" },
      { id: 17, label: "Tiền xử lý OCR", group: "offlineNode", size: 28 },
      
      // Các nơ-ron chức năng SW
      { id: 8, label: "Vòng lặp Retry/Tiêm mã", group: "swNode" },
      { id: 9, label: "Auto Wake-up", group: "swNode" },
      
      // Các nơ-ron chức năng Bot
      { id: 11, label: "Khóa luồng Mutex", group: "botNode" },
      { id: 12, label: "Hack Paste Ảo", group: "botNode" },
      { id: 13, label: "Săn Vòng đời Nút Gửi", group: "botNode" },
      { id: 14, label: "Bóc lõi .markdown", group: "botNode" }
    ]);

    // Thiết lập các Liên kết (Sợi dây thần kinh)
    const edges = new vis.DataSet([
      { from: 4, to: 1, title: 'Kích hoạt' },
      { from: 1, to: 5, arrows: 'to' },
      { from: 5, to: 7, label: 'Mode QR', dashes: true, color: {color: '#00e676'} },
      { from: 7, to: 6, arrows: 'to', label: '< 0.05s', color: {color: '#00e676'} },
      
      { from: 5, to: 17, arrows: 'to', label: 'Bật OCR', dashes: true, color: {color: '#00e676'} },
      { from: 17, to: 2, arrows: 'to', label: 'Truyền Text Giảm Tải', color: {color: '#00e5ff'} },
      
      { from: 5, to: 2, arrows: 'to', label: 'Truyền Base64 Ảnh', color: {color: '#00e5ff'} },
      { from: 2, to: 6, arrows: 'to', label: 'Kết quả Dịch', color: {color: '#ff4081'} },
      
      { from: 2, to: 9, arrows: 'to', label: 'Phân luồng Web' },
      { from: 2, to: 16, arrows: 'to', label: 'Gọi API Cổng JSON', color: {color: '#ff3d00'} },
      { from: 16, to: 2, arrows: 'to', label: 'Response', color: {color: '#ff4081'} },
      
      { from: 9, to: 8, arrows: 'to' },
      { from: 8, to: 3, arrows: 'to', label: 'Bắn thông điệp Web', color: {color: '#e040fb'} },
      
      { from: 3, to: 11, arrows: 'to' },
      { from: 11, to: 12, arrows: 'to' },
      { from: 12, to: 15, arrows: 'to', label: 'Tương tác Web', color: {color: '#ffeb3b'} },
      { from: 15, to: 13, arrows: 'to', label: 'Sinh cảnh DOM', color: {color: '#ffeb3b'} },
      { from: 13, to: 14, arrows: 'to' },
      { from: 14, to: 2, arrows: 'to', label: 'Trả Ruột Dịch', color: {color: '#ff4081'} },
    ]);

    // Cấu hình môi trường mạng mạng
    const container = document.getElementById('mynetwork');
    const data = { nodes: nodes, edges: edges };
    const options = {
      nodes: {
        shape: 'dot',
        size: 25,
        font: { size: 14, color: '#ffffff', face: 'Segoe UI' },
        borderWidth: 2,
        shadow: true
      },
      edges: {
        width: 2,
        shadow: true,
        smooth: { type: 'continuous' },
        font: { size: 12, color: '#a0aec0', face: 'Segoe UI', align: 'top' }
      },
      groups: {
        uiMain: { color: { background: '#2196f3', border: '#1976d2' } },
        swMain: { color: { background: '#f50057', border: '#c51162' } },
        botMain: { color: { background: '#9c27b0', border: '#7b1fa2' } },
        core: { color: { background: '#ff3d00', border: '#dd2c00' } },
        
        uiNode: { color: { background: '#64b5f6', border: '#42a5f5' } },
        swNode: { color: { background: '#ff80ab', border: '#ff4081' } },
        botNode: { color: { background: '#e1bee7', border: '#e040fb' } },
        offlineNode: { color: { background: '#00e676', border: '#00c853' } }
      },
      physics: {
        forceAtlas2Based: {
          gravitationalConstant: -100,
          centralGravity: 0.005,
          springLength: 200,
          springConstant: 0.08
        },
        maxVelocity: 50,
        solver: 'forceAtlas2Based',
        timestep: 0.35,
        stabilization: { iterations: 150 }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200
      }
    };

    const network = new vis.Network(container, data, options);

    // Kịch bản khi Click vào 1 Nơ-ron
    network.on("click", function (params) {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const info = nodeData[nodeId];
        
        if (info) {
          document.getElementById('default-desc').style.display = 'none';
          document.getElementById('dynamic-desc').style.display = 'block';
          
          document.getElementById('node-title').innerText = "🔹 " + info.title;
          document.getElementById('node-desc').innerText = info.desc;
          
          // Phát sáng Nơ-ron box UI
          const box = document.getElementById('info-box');
          box.style.boxShadow = '0 8px 30px rgba(0, 229, 255, 0.4)';
          setTimeout(() => {
            box.style.boxShadow = '0 4px 20px rgba(0, 255, 255, 0.1)';
          }, 300);
        }
      } else {
        document.getElementById('default-desc').style.display = 'block';
        document.getElementById('dynamic-desc').style.display = 'none';
      }
    });

    // Handle close button
    document.getElementById("close-btn").addEventListener("click", () => {
        window.close();
    });
});
