<template>
    <div class="dashboard-wrapper">
      <header class="dashboard-header">
        <div>
          <h1>儀表板 Dashboard</h1>
          <p class="subtitle">即時掌握瓦斯配送與營運狀況</p>
        </div>
        <button class="primary-btn">+ 新增訂單</button>
      </header>
  
      <section class="stat-cards">
        <div class="card stat-card">
          <div class="card-icon">📦</div>
          <h3>總訂單數 (本月)</h3>
          <div class="value">1,284</div>
          <div class="trend up">↑ 12.5% 較上月</div>
        </div>
        <div class="card stat-card">
          <div class="card-icon">🚚</div>
          <h3>處理中 / 配送中</h3>
          <div class="value">42</div>
          <div class="trend neutral">- 保持平穩</div>
        </div>
        <div class="card stat-card">
          <div class="card-icon">✅</div>
          <h3>已完成 (本週)</h3>
          <div class="value">315</div>
          <div class="trend up">↑ 5.2% 較上週</div>
        </div>
      </section>
  
      <section class="charts-section">
        <div class="card chart-container">
          <h3>訂單趨勢 (近半年)</h3>
          <div class="placeholder-chart flex-center">
            <span class="hint-text">📊 這裡未來可以套用 Chart.js 或 ECharts 畫折線圖</span>
          </div>
        </div>
        <div class="card pie-container">
          <h3>訂單狀態分佈</h3>
          <div class="placeholder-chart flex-center circle">
            <span class="hint-text">🍕 圓餅圖區域</span>
          </div>
        </div>
      </section>
  
      <section class="table-section">
        <div class="card">
          <h3>最新訂單 (Recent Orders)</h3>
          <div class="table-responsive">
            <table class="order-table">
              <thead>
                <tr>
                  <th>訂單編號</th>
                  <th>客戶名稱</th>
                  <th>瓦斯規格</th>
                  <th>狀態</th>
                  <th>金額</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="order in recentOrders" :key="order.id">
                  <td class="order-id">#{{ order.id }}</td>
                  <td>{{ order.customer }}</td>
                  <td><span class="gas-tag">{{ order.size }}</span></td>
                  <td>
                    <span class="status-badge" :class="order.statusClass">
                      {{ order.statusText }}
                    </span>
                  </td>
                  <td class="price">NT$ {{ order.price }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  import axios from 'axios'; // 確保專案有安裝 axios (npm install axios)
  
  // 初始化為空陣列，等待 API 載入
  const recentOrders = ref([]);
  
  // 核心：狀態轉換邏輯（將資料庫的英文狀態，映射為前端的中文與樣式 class）
  const mapStatus = (status) => {
    const mapping = {
      pending: { class: 'pending', text: '處理中' },
      delivering: { class: 'delivering', text: '配送中' },
      completed: { class: 'completed', text: '已送達' }
    };
    // 如果資料庫傳了預設以外的字，防呆回傳處理中
    return mapping[status] || { class: 'pending', text: '處理中' };
  };
  
  // 呼叫後端 API 的主函數
  const fetchOrders = async () => {
    try {
      // 自動讀取我們在 Render/環境變數 設定好的後端主網址
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      
      const response = await axios.get(`${apiBase}/api/orders`);
      
      if (response.data.success) {
        // 將資料庫撈出來的原始欄位，完美對接到前端 Template 使用的變數
        recentOrders.value = response.data.data.map(item => {
          const statusInfo = mapStatus(item.status);
          return {
            id: `ORD-${String(item.id).padStart(3, '0')}`, // 幫 ID 自動補零，例如 1 變成 ORD-001
            customer: item.customer_name,
            size: item.gas_size,
            statusClass: statusInfo.class,
            statusText: statusInfo.text,
            price: item.gas_size === '20kg' ? '850' : '700' // 依據瓦斯桶重量簡單判斷金額
          };
        });
      }
    } catch (error) {
      console.error('無法撈取後端訂單資料:', error);
    }
  };
  
  // 網頁元件掛載完畢後，立刻自動執行撈取
  onMounted(() => {
    fetchOrders();
  });
  </script>
  
  <style scoped>
  /* 版面：淺色底、大字級、留白足夠，長輩看得清楚 */
  .dashboard-wrapper {
    padding: 24px 20px 40px;
    background-color: var(--bg);
    color: var(--ink);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* 頂部標題列 */
  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px;
  }
  .dashboard-header h1 {
    margin: 0 0 4px 0;
    font-size: 26px;
    color: var(--ink);
  }
  .subtitle {
    margin: 0;
    color: var(--ink-2);
    font-size: 16px;
  }
  .primary-btn {
    background-color: var(--brand);
    color: #fff;
    border: none;
    padding: 14px 22px;
    min-height: 52px;
    border-radius: 12px;
    font-size: 17px;
    font-weight: 700;
    transition: background-color 0.15s;
  }
  .primary-btn:hover { background-color: var(--brand-dark); }

  /* 通用卡片 */
  .card {
    background-color: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 20px;
    box-shadow: var(--shadow);
  }
  .card h3 {
    margin-top: 0;
    color: var(--ink-2);
    font-size: 17px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  /* 區塊一：數據指標 */
  .stat-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
  }
  .card-icon { font-size: 28px; line-height: 1; }
  .stat-card h3 { margin-top: 10px; margin-bottom: 4px; }
  .stat-card .value {
    font-size: 40px;
    font-weight: 700;
    color: var(--ink);
    margin: 6px 0;
  }
  .stat-card .trend { font-size: 16px; font-weight: 600; }
  .trend.up { color: var(--brand-dark); }
  .trend.neutral { color: var(--ink-2); }

  /* 區塊二：圖表區 */
  .charts-section {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 16px;
  }
  .placeholder-chart {
    background-color: #f8fafc;
    border-radius: 12px;
    height: 250px;
    border: 2px dashed var(--line);
    text-align: center;
    padding: 16px;
  }
  .placeholder-chart.circle { border-radius: 50%; width: 200px; height: 200px; margin: 0 auto; }
  .flex-center { display: flex; justify-content: center; align-items: center; }
  .hint-text { color: var(--ink-2); font-size: 15px; }

  /* 區塊三：訂單表格 */
  .table-responsive { overflow-x: auto; }
  .order-table {
    width: 100%;
    min-width: 560px;
    border-collapse: collapse;
    text-align: left;
    font-size: 17px;
  }
  .order-table th {
    padding: 14px 12px;
    border-bottom: 2px solid var(--line);
    color: var(--ink-2);
    font-weight: 600;
    white-space: nowrap;
  }
  .order-table td {
    padding: 16px 12px;
    border-bottom: 1px solid var(--line);
    color: var(--ink);
  }
  .order-table tbody tr:hover { background-color: #f8fafc; }
  .order-id { font-family: ui-monospace, 'SFMono-Regular', monospace; color: var(--ink-2); }
  .price { font-weight: 700; white-space: nowrap; }
  .gas-tag {
    display: inline-block;
    background-color: #eef1f5;
    color: var(--ink);
    padding: 5px 10px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
  }

  /* 狀態標籤（用底色 + 文字，不只靠顏色分辨） */
  .status-badge {
    display: inline-block;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
  }
  .status-badge.pending { background-color: #fff4e0; color: #9a5b00; border: 1px solid #f5cf94; }
  .status-badge.delivering { background-color: #e7f0ff; color: #1450a3; border: 1px solid #a9c6f5; }
  .status-badge.completed { background-color: var(--brand-soft); color: #05752f; border: 1px solid #9adcb7; }

  /* 手機版：圖表改成上下排列 */
  @media (max-width: 768px) {
    .dashboard-wrapper { padding: 16px 14px 32px; }
    .charts-section { grid-template-columns: 1fr; }
    .primary-btn { width: 100%; }
  }
  </style>
