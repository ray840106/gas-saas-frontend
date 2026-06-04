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
  /* 核心版面設定 */
  .dashboard-wrapper {
    padding: 30px;
    background-color: #0f172a; /* 深色背景 */
    color: #f1f5f9;
    min-height: 100vh;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    display: flex;
    flex-direction: column;
    gap: 24px; /* 區塊之間的間距 */
  }
  
  /* 頂部 Header (Flexbox 左右對齊) */
  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .dashboard-header h1 {
    margin: 0 0 5px 0;
    font-size: 28px;
    color: #ffffff;
  }
  .subtitle {
    margin: 0;
    color: #94a3b8;
    font-size: 14px;
  }
  .primary-btn {
    background-color: #10b981;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    transition: 0.2s;
  }
  .primary-btn:hover { background-color: #059669; }
  
  /* 通用卡片樣式 */
  .card {
    background-color: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  .card h3 {
    margin-top: 0;
    color: #cbd5e1;
    font-size: 16px;
    margin-bottom: 15px;
  }
  
  /* 區塊一：數據指標 (CSS Grid 三等份) */
  .stat-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  .stat-card .value {
    font-size: 36px;
    font-weight: bold;
    color: #ffffff;
    margin: 10px 0;
  }
  .stat-card .trend { font-size: 14px; }
  .trend.up { color: #10b981; }
  .trend.neutral { color: #94a3b8; }
  
  /* 區塊二：圖表區 (CSS Grid 2:1 比例) */
  .charts-section {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
  }
  .placeholder-chart {
    background-color: #0f172a;
    border-radius: 8px;
    height: 250px;
    border: 1px dashed #475569;
  }
  .placeholder-chart.circle { border-radius: 50%; width: 200px; height: 200px; margin: 0 auto; }
  .flex-center { display: flex; justify-content: center; align-items: center; }
  .hint-text { color: #64748b; font-size: 14px; }
  
  /* 區塊三：訂單表格 */
  .table-responsive { overflow-x: auto; }
  .order-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }
  .order-table th {
    padding: 15px;
    border-bottom: 2px solid #334155;
    color: #94a3b8;
    font-weight: 500;
  }
  .order-table td {
    padding: 15px;
    border-bottom: 1px solid #334155;
    color: #f1f5f9;
  }
  .order-id { font-family: monospace; color: #38bdf8; }
  .price { font-weight: bold; }
  .gas-tag {
    background-color: #334155;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
  }
  
  /* 狀態標籤 (動態綁定) */
  .status-badge {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: bold;
  }
  .status-badge.pending { background-color: #f59e0b20; color: #fbbf24; border: 1px solid #f59e0b50; }
  .status-badge.delivering { background-color: #3b82f620; color: #60a5fa; border: 1px solid #3b82f650; }
  .status-badge.completed { background-color: #10b98120; color: #34d399; border: 1px solid #10b98150; }
  </style>