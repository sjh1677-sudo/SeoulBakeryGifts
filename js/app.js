// Seoul Bakery Gifts - Etsy Exporter SaaS Core Logic

class App {
  constructor() {
    this.currentView = 'dashboard';
    this.chart = null;
    this.ratesData = null; // Custom rates loaded from db
    this.settings = null;  // Settings loaded from db
    
    this.init();
  }

  init() {
    // 1. 설정 및 배송 요율 로드
    this.settings = db.getSettings();
    this.ratesData = db.getEmsRates();

    // 2. 사이드바 환율 표시 업데이트
    this.updateExchangeRateUI();

    // 3. 북마크클릿 코드 생성 및 버튼 할당
    this.generateBookmarklet();

    // 4. 모달 오버레이 클릭 시 닫기 바인딩
    this.bindModalEvents();

    // 5. 북마크클릿으로 진입했는지 쿼리 스트링 감지
    this.checkBookmarkletQuery();

    // 6. 기본 국가 리스트 바인딩 (주문 폼 및 계산기용)
    this.bindCountryLists();

    // 7. 대시보드 화면 및 차트 렌더링
    this.navigate('dashboard');

    // 8. AI 백그라운드 수집 폴더 자동 체크 및 10초 간격 폴링
    this.checkInboxProducts();
    setInterval(() => this.checkInboxProducts(), 10000);
  }

  // --- SPA VIEW ROUTING ---
  navigate(viewId) {
    this.currentView = viewId;

    // 네비게이션 액티브 상태 전환
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    const activeNav = document.getElementById(`nav-${viewId}`);
    if (activeNav) activeNav.classList.add('active');

    // 뷰 콘텐츠 전환
    document.querySelectorAll('.page-view').forEach(view => {
      view.classList.add('hidden');
    });
    const activeView = document.getElementById(`view-${viewId}`);
    if (activeView) activeView.classList.remove('hidden');

    // 뷰별 렌더링 처리
    if (viewId === 'dashboard') {
      this.renderDashboard();
    } else if (viewId === 'sourcing') {
      this.renderSourcingList();
    } else if (viewId === 'orders') {
      this.renderOrdersList();
      this.bindOrderProductDropdown();
    } else if (viewId === 'settings') {
      this.renderSettings();
    }
  }

  // --- EXCHANGE RATE UI UPDATE ---
  updateExchangeRateUI() {
    const rateText = this.formatNumber(this.settings.exchangeRate) + ' 원';
    document.getElementById('sidebar-exchange-rate').innerText = rateText;
  }

  // --- COUNTRY LISTS BINDING ---
  bindCountryLists() {
    const orderCountrySelect = document.getElementById('order-country');
    const scCountrySelect = document.getElementById('sc-country');
    
    if (orderCountrySelect && scCountrySelect) {
      orderCountrySelect.innerHTML = '';
      scCountrySelect.innerHTML = '';
      
      const countries = Object.keys(this.ratesData.countryZones).sort();
      countries.forEach(country => {
        const zone = this.ratesData.countryZones[country];
        const optText = `${country} (${zone})`;
        
        const opt1 = new Option(optText, country);
        const opt2 = new Option(optText, country);
        
        // 기본값으로 미국 선택
        if (country === 'United States') {
          opt1.selected = true;
          opt2.selected = true;
        }
        
        orderCountrySelect.add(opt1);
        scCountrySelect.add(opt2);
      });
    }
  }

  // --- 1. DASHBOARD CONTROLLER ---
  renderDashboard() {
    const products = db.getProducts();
    const orders = db.getOrders();
    const exRate = this.settings.exchangeRate;

    // A. 지표 계산
    let totalSalesUsd = 0;
    let totalProfitKrw = 0;
    let pendingShippingCount = 0;

    orders.forEach(order => {
      totalSalesUsd += parseFloat(order.salePriceUsd || 0);
      
      // 개별 주문의 상세 마진 계산
      const costs = this.calculateIndividualOrderMargin(order);
      totalProfitKrw += costs.netProfitKrw;

      if (order.shippingStatus === 'Ready') {
        pendingShippingCount++;
      }
    });

    const activeListingsCount = products.filter(p => p.status === 'Active').length;

    // B. UI 반영
    document.getElementById('stat-total-sales').innerText = '$' + this.formatNumber(totalSalesUsd.toFixed(2));
    document.getElementById('stat-order-count').innerText = orders.length;
    document.getElementById('stat-total-profit').innerText = this.formatNumber(Math.round(totalProfitKrw)) + ' 원';
    
    // 평균 수익률 (원가 대비 이익이 아닌 총매출(원화환산) 대비 이익 비율)
    const totalSalesKrw = totalSalesUsd * exRate;
    const avgMargin = totalSalesKrw > 0 ? (totalProfitKrw / totalSalesKrw) * 100 : 0;
    document.getElementById('stat-average-margin').innerText = avgMargin.toFixed(1) + '%';
    
    document.getElementById('stat-product-count').innerText = products.length;
    document.getElementById('stat-active-listings').innerText = activeListingsCount;
    document.getElementById('stat-pending-orders').innerText = pendingShippingCount;

    // C. To-Do 리스트 렌더링
    this.renderTodoWidget(products, orders);

    // D. 수익 그래프 생성
    this.renderAnalyticsChart(orders);

    // E. 최근 소싱된 상품 퀵뷰 렌더링
    this.renderRecentProductsWidget(products);
  }

  renderRecentProductsWidget(products) {
    const container = document.getElementById('dashboard-recent-products');
    if (!container) return;
    container.innerHTML = '';

    // 최신 등록된 순서대로 3개만 추출
    const recent = products.slice(0, 3);

    if (recent.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem 0; font-size: 0.85rem;">
          등록된 소싱 상품이 없습니다. 상품을 먼저 등록해 주세요.
        </div>
      `;
      return;
    }

    recent.forEach(p => {
      const calcResult = this.calculateOptimalPrice(p.priceKrw, p.weight, p.width, p.length, p.height, p.targetMargin, 'Zone 3');

      const el = document.createElement('div');
      el.className = 'glass-card product-card';
      el.style.padding = '1rem';
      el.innerHTML = `
        <img class="product-card-img" src="${p.imgUrl}" alt="${p.titleKo}" style="height: 100px; margin-bottom: 0.5rem; border-radius: 8px;">
        <div class="product-card-artist" style="font-size: 0.75rem;">${p.artist}</div>
        <div class="product-card-title" style="font-size: 0.85rem; height: 2.2rem; margin-bottom: 0.5rem; line-height: 1.3;">${p.titleKo}</div>
        <div class="product-card-meta" style="padding-top: 0.5rem; margin-top: 0.5rem;">
          <div class="product-card-price">
            <span class="price-value" style="font-size: 0.9rem;">${this.formatNumber(p.priceKrw)}원</span>
          </div>
          <div class="product-card-price">
            <span class="price-value usd" style="font-size: 0.9rem;">$${calcResult.optimalPriceUsd.toFixed(2)}</span>
          </div>
        </div>
        <div class="product-card-actions mt-1" style="display: flex; gap: 0.25rem;">
          <button class="btn btn-secondary" style="flex:1; font-size: 0.75rem; padding: 0.4rem 0.75rem;" onclick="app.openProductDetailModal('${p.id}')">리스팅 도우미 ↗</button>
        </div>
      `;
      container.appendChild(el);
    });
  }

  renderTodoWidget(products, orders) {
    const container = document.getElementById('dashboard-todo-list');
    container.innerHTML = '';

    const todos = [];

    // 1. Etsy 주문 소싱 대기 상태
    const pendingOrders = orders.filter(o => o.sourcingStatus === 'Pending');
    pendingOrders.forEach(o => {
      todos.push({
        type: 'pending-sourcing',
        text: `주문 #${o.id.substring(11)}: [${o.itemName.substring(0, 15)}...] 소싱 발주 필요`,
        time: o.date,
        color: '#f59e0b',
        action: () => this.navigate('orders')
      });
    });

    // 2. 발송 준비 상태이면서 운송장이 비어있는 건
    const readyOrdersNoTrack = orders.filter(o => o.shippingStatus === 'Ready' && !o.trackingNumber);
    readyOrdersNoTrack.forEach(o => {
      todos.push({
        type: 'pending-shipping',
        text: `배송대기: ${o.buyerName} (${o.country}) 건 EMS 프리미엄 접수 & 송장 등록 필요`,
        time: o.date,
        color: '#6366f1',
        action: () => this.navigate('orders')
      });
    });

    // 3. Draft 품목 리스팅 제안
    const draftProds = products.filter(p => p.status === 'Draft');
    draftProds.forEach(p => {
      todos.push({
        type: 'draft-product',
        text: `미등록 상품: [${p.titleKo}] Etsy 리스팅 업로드 및 Active 상태 전환 필요`,
        time: '소싱 완료됨',
        color: '#f43f5e',
        action: () => this.navigate('sourcing')
      });
    });

    if (todos.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2rem 0; font-size: 0.85rem;">
          🎉 현재 처리해야 할 대기 업무가 없습니다!
        </div>
      `;
      return;
    }

    todos.forEach(todo => {
      const el = document.createElement('div');
      el.className = 'activity-item';
      el.style.cursor = 'pointer';
      el.onclick = todo.action;
      el.innerHTML = `
        <span class="activity-badge" style="background: ${todo.color}; box-shadow: 0 0 8px ${todo.color};"></span>
        <div class="activity-info">
          <div class="activity-text">${todo.text}</div>
          <div class="activity-time">${todo.time}</div>
        </div>
      `;
      container.appendChild(el);
    });
  }

  renderAnalyticsChart(orders) {
    const ctx = document.getElementById('profitChart').getContext('2d');
    if (this.chart) {
      this.chart.destroy();
    }

    // 최근 6개월 매출/수익 통계 데이터 추출
    const months = [];
    const salesData = [];
    const profitData = [];
    const exRate = this.settings.exchangeRate;

    // 오늘 기준으로 역산하여 6개월 생성
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push(label);
      salesData.push(0);
      profitData.push(0);
    }

    orders.forEach(order => {
      const orderDate = new Date(order.date);
      const orderMonth = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
      const idx = months.indexOf(orderMonth);
      if (idx !== -1) {
        // 매출(원화 환원)
        salesData[idx] += order.salePriceUsd * exRate;
        // 순이익
        const costInfo = this.calculateIndividualOrderMargin(order);
        profitData[idx] += costInfo.netProfitKrw;
      }
    });

    // 그라데이션 브러쉬 설정
    const salesGrad = ctx.createLinearGradient(0, 0, 0, 300);
    salesGrad.addColorStop(0, 'rgba(124, 58, 237, 0.45)');
    salesGrad.addColorStop(1, 'rgba(124, 58, 237, 0.0)');

    const profitGrad = ctx.createLinearGradient(0, 0, 0, 300);
    profitGrad.addColorStop(0, 'rgba(217, 119, 6, 0.4)');
    profitGrad.addColorStop(1, 'rgba(217, 119, 6, 0.0)');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months.map(m => m.split('-')[1] + '월'),
        datasets: [
          {
            label: '총 매출액 (KRW)',
            data: salesData,
            borderColor: '#8b5cf6',
            borderWidth: 2.5,
            backgroundColor: salesGrad,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#8b5cf6',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: '순이익 (KRW)',
            data: profitData,
            borderColor: '#f59e0b',
            borderWidth: 2.5,
            backgroundColor: profitGrad,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#f59e0b',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#9ca3af',
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#9ca3af' }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#9ca3af',
              callback: (value) => this.formatNumber(value) + '원'
            }
          }
        }
      }
    });
  }

  // --- 2. SOURCING PRODUCT CONTROLLER ---
  renderSourcingList() {
    const container = document.getElementById('sourcing-products-container');
    container.innerHTML = '';

    const searchQuery = document.getElementById('sourcing-search-input').value.toLowerCase();
    const filterStatus = document.getElementById('sourcing-status-filter').value;
    
    let products = db.getProducts();

    // 필터링 적용
    products = products.filter(p => {
      const matchSearch = p.titleKo.toLowerCase().includes(searchQuery) || 
                          p.titleEn.toLowerCase().includes(searchQuery) || 
                          p.artist.toLowerCase().includes(searchQuery);
      const matchStatus = filterStatus === 'All' || p.status === filterStatus;
      return matchSearch && matchStatus;
    });

    if (products.length === 0) {
      container.innerHTML = `
        <div class="glass-card" style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 4rem 0;">
          등록된 소싱 상품이 없습니다. 신규 상품을 등록해 보세요.
        </div>
      `;
      return;
    }

    products.forEach(p => {
      // Zone 3 기준 권장 판매가 계산
      const calcResult = this.calculateOptimalPrice(p.priceKrw, p.weight, p.width, p.length, p.height, p.targetMargin, 'Zone 3');

      const card = document.createElement('div');
      card.className = 'glass-card product-card';
      card.innerHTML = `
        <img class="product-card-img" src="${p.imgUrl || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=300&q=80'}" alt="${p.titleKo}">
        <span class="product-card-badge badge-${p.status.replace(/\s+/g, '').toLowerCase()}">${p.status}</span>
        
        <div class="product-card-artist">${p.artist}</div>
        <div class="product-card-title">${p.titleKo}</div>
        
        <div class="product-card-meta">
          <div class="product-card-price">
            <span class="price-label">소싱 원가</span>
            <span class="price-value">${this.formatNumber(p.priceKrw)}원</span>
          </div>
          <div class="product-card-price">
            <span class="price-label">Etsy 판매가 (US Zone3 기준)</span>
            <span class="price-value usd">$${calcResult.optimalPriceUsd.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="product-card-actions mt-1">
          <button class="btn btn-secondary" style="flex:1;" onclick="app.openProductDetailModal('${p.id}')">리스팅 도우미 ↗</button>
          <button class="btn btn-secondary btn-icon-only" title="수정" onclick="app.openProductModal('${p.id}')">✏️</button>
          <button class="btn btn-danger btn-icon-only" title="삭제" onclick="app.deleteProduct('${p.id}')">🗑️</button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // --- 3. ORDERS CONTROLLER ---
  renderOrdersList() {
    const tbody = document.getElementById('orders-table-body');
    tbody.innerHTML = '';

    const searchQuery = document.getElementById('orders-search-input').value.toLowerCase();
    const filterStatus = document.getElementById('orders-status-filter').value;
    const exchangeRate = this.settings.exchangeRate;

    let orders = db.getOrders();

    orders = orders.filter(o => {
      const matchSearch = o.buyerName.toLowerCase().includes(searchQuery) ||
                          o.id.toLowerCase().includes(searchQuery) ||
                          o.itemName.toLowerCase().includes(searchQuery);
      const matchStatus = filterStatus === 'All' || o.sourcingStatus === filterStatus;
      return matchSearch && matchStatus;
    });

    if (orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem 0;">
            일치하는 주문 정보가 존재하지 않습니다.
          </td>
        </tr>
      `;
      return;
    }

    orders.forEach(o => {
      const costInfo = this.calculateIndividualOrderMargin(o);
      const salePriceKrw = o.salePriceUsd * exchangeRate;
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="font-weight: 700;">#${o.id.substring(11)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${o.date}</div>
        </td>
        <td>
          <div style="font-weight: 600;">${o.buyerName}</div>
          <div style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: 500;">${o.country}</div>
        </td>
        <td>
          <div style="font-weight: 500; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${o.itemName}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">수량: ${o.qty}개</div>
        </td>
        <td>
          <select class="badge-status" style="border:none; padding: 0.25rem 0.5rem; border-radius:4px; font-weight:600; cursor:pointer;" 
                  id="status-source-${o.id}" onchange="app.updateOrderSourcingStatus('${o.id}', this.value)">
            <option value="Pending" ${o.sourcingStatus === 'Pending' ? 'selected' : ''}>소싱대기</option>
            <option value="Ordered" ${o.sourcingStatus === 'Ordered' ? 'selected' : ''}>발주완료</option>
            <option value="Arrived" ${o.sourcingStatus === 'Arrived' ? 'selected' : ''}>사무실입고</option>
            <option value="Shipped" ${o.sourcingStatus === 'Shipped' ? 'selected' : ''}>배송완료</option>
          </select>
        </td>
        <td>
          ${o.trackingNumber ? `
            <div style="font-weight: 600; font-size:0.85rem; display:flex; align-items:center; gap:0.25rem;">
              <span>📦</span>
              <a href="https://www.ups.com/track?loc=en_KR&requester=ST/trackdetails&tracknum=${o.trackingNumber}" 
                 target="_blank" class="text-cyan">${o.trackingNumber}</a>
            </div>
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top:0.15rem;">
              배송: ${o.shippingStatus === 'Delivered' ? '✅ 완료' : '🚚 발송'}
            </div>
          ` : `
            <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" 
                    onclick="app.openOrderModal('${o.id}')">송장 입력</button>
          `}
        </td>
        <td>
          <div style="font-weight: 700; color: var(--accent-cyan);">$${o.salePriceUsd.toFixed(2)}</div>
          <div style="font-size: 0.75rem; color: var(--accent-green); font-weight: 600;">
            +${this.formatNumber(Math.round(costInfo.netProfitKrw))}원
          </div>
        </td>
        <td>
          <div style="display:flex; gap: 0.35rem;">
            <button class="btn btn-secondary btn-icon-only" title="세관통관 송장정보 추출" onclick="app.openInvoiceModal('${o.id}')">📄</button>
            <button class="btn btn-secondary btn-icon-only" onclick="app.openOrderModal('${o.id}')">✏️</button>
            <button class="btn btn-danger btn-icon-only" onclick="app.deleteOrder('${o.id}')">&times;</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
      
      // 소싱 상태 셀렉트 색상 동적 매핑
      const sel = document.getElementById(`status-source-${o.id}`);
      this.styleStatusSelect(sel, o.sourcingStatus);
    });
  }

  styleStatusSelect(element, status) {
    if(!element) return;
    element.className = 'badge-status';
    if(status === 'Pending') {
      element.style.background = 'rgba(245, 158, 11, 0.15)';
      element.style.color = 'var(--accent-yellow)';
    } else if(status === 'Ordered') {
      element.style.background = 'rgba(99, 102, 241, 0.15)';
      element.style.color = '#a5b4fc';
    } else if(status === 'Arrived') {
      element.style.background = 'rgba(6, 182, 212, 0.15)';
      element.style.color = 'var(--accent-cyan)';
    } else if(status === 'Shipped') {
      element.style.background = 'rgba(16, 185, 129, 0.15)';
      element.style.color = 'var(--accent-green)';
    }
  }

  updateOrderSourcingStatus(id, newStatus) {
    const order = db.getOrderById(id);
    if(order) {
      order.sourcingStatus = newStatus;
      if(newStatus === 'Shipped') {
        order.shippingStatus = 'Shipped';
      }
      db.updateOrder(order);
      
      // 셀렉트 박스 스타일 업데이트
      const sel = document.getElementById(`status-source-${id}`);
      this.styleStatusSelect(sel, newStatus);
      
      // 대시보드 To-Do 등의 갱신을 위해 데이터 재연동
      this.showToast('주문 소싱 발주 상태가 업데이트되었습니다.');
    }
  }

  // --- 4. SETTINGS CONTROLLER ---
  renderSettings() {
    // 폼 값 대입
    document.getElementById('set-exchange-rate').value = this.settings.exchangeRate;
    document.getElementById('set-transaction-fee').value = this.settings.etsyFees.transactionFee;
    document.getElementById('set-listing-fee').value = this.settings.etsyFees.listingFee;
    document.getElementById('set-payment-percent').value = this.settings.etsyFees.paymentFeePercent;
    document.getElementById('set-payment-fixed').value = this.settings.etsyFees.paymentFeeFixed;
    document.getElementById('set-offsite-ads-fee').value = this.settings.etsyFees.offsiteAdsFee;

    // 배송 요금표 편집 탭 생성
    this.renderEmsRateEditor();
  }

  saveSettings(event) {
    event.preventDefault();
    
    this.settings.exchangeRate = parseFloat(document.getElementById('set-exchange-rate').value);
    this.settings.etsyFees.transactionFee = parseFloat(document.getElementById('set-transaction-fee').value);
    this.settings.etsyFees.listingFee = parseFloat(document.getElementById('set-listing-fee').value);
    this.settings.etsyFees.paymentFeePercent = parseFloat(document.getElementById('set-payment-percent').value);
    this.settings.etsyFees.paymentFeeFixed = parseInt(document.getElementById('set-payment-fixed').value);
    this.settings.etsyFees.offsiteAdsFee = parseInt(document.getElementById('set-offsite-ads-fee').value);

    db.saveSettings(this.settings);
    this.updateExchangeRateUI();
    this.bindCountryLists();

    // 북마크클릿 다시 빌드 (환율 변동 시에도 적용되게)
    this.generateBookmarklet();

    const successEl = document.getElementById('settings-save-success');
    successEl.style.display = 'block';
    setTimeout(() => {
      successEl.style.display = 'none';
    }, 3000);
    
    this.showToast('기본 요율 설정이 저장되었습니다.');
  }

  renderEmsRateEditor() {
    const tabsContainer = document.getElementById('rates-editor-tabs');
    tabsContainer.innerHTML = '';

    const zones = Object.keys(this.ratesData.rates).sort();
    
    // 현재 선택된 활성 탭 (없다면 첫번째 존 선택)
    if(!this.activeRateTab) {
      this.activeRateTab = zones[0];
    }

    zones.forEach(zone => {
      const btn = document.createElement('button');
      btn.className = `rate-tab-btn ${zone === this.activeRateTab ? 'active' : ''}`;
      btn.innerText = zone;
      btn.onclick = () => {
        this.activeRateTab = zone;
        this.renderEmsRateEditor();
      };
      tabsContainer.appendChild(btn);
    });

    // 해당 존의 요율표 렌더링
    const tbody = document.getElementById('rates-editor-table-body');
    tbody.innerHTML = '';

    const rateSteps = this.ratesData.rates[this.activeRateTab];
    rateSteps.forEach((step, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${step.weight.toFixed(1)} kg</strong></td>
        <td>
          <div class="input-suffix-wrapper">
            <input type="number" class="rate-input" id="rate-edit-${this.activeRateTab}-${idx}" value="${step.rate}">
            <span class="input-suffix" style="right: 8rem;">KRW</span>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  saveEmsRates() {
    const rateSteps = this.ratesData.rates[this.activeRateTab];
    rateSteps.forEach((step, idx) => {
      const inputVal = document.getElementById(`rate-edit-${this.activeRateTab}-${idx}`).value;
      step.rate = parseInt(inputVal) || 0;
    });

    db.saveEmsRates(this.ratesData);
    this.showToast(`${this.activeRateTab} 요율 변경 사항이 저장되었습니다.`);
  }

  // --- CORE MATHEMATICAL CALCULATIONS ---
  
  // 청구 무게 계산
  calculateChargeWeight(weight, width, length, height) {
    const volWeight = (width * length * height) / 6000;
    const maxWeight = Math.max(weight, volWeight);
    
    // 0.5kg 단위 올림 계산 (예: 1.2kg -> 1.5kg, 2.55kg -> 3.0kg)
    const step = Math.ceil(maxWeight * 2) / 2;
    return {
      volumetric: volWeight,
      charge: step
    };
  }

  // 특정 구역 및 청구 무게 매칭 EMS 요금 조회
  getEmsRate(zone, chargeWeight) {
    const steps = this.ratesData.rates[zone];
    if(!steps) return 0;

    // 무게 오름차순 정렬 후 순회하며 첫 매칭 요금 반환
    const match = steps.find(s => s.weight >= chargeWeight);
    if(match) return match.rate;
    
    // 매칭 테이블 중량 초과 시 마지막 중량 요금 적용
    return steps[steps.length - 1].rate;
  }

  // [핵심] 권장 Etsy 판매가 산출식 모델링 (Etsy 수수료 및 목표마진 역산)
  calculateOptimalPrice(sourcingKrw, weight, width, length, height, targetMarginPercent, zone = 'Zone 3') {
    const exRate = this.settings.exchangeRate;
    const fees = this.settings.etsyFees;

    // 1. 배송비 산출
    const wt = this.calculateChargeWeight(weight, width, length, height);
    const emsCostKrw = this.getEmsRate(zone, wt.charge);

    // 2. 수수료율 합계
    // Transaction(6.5) + Payment(4.0) + OffsiteAds(예: 0, 12, 15)
    const feeRate = (fees.transactionFee + fees.paymentFeePercent + fees.offsiteAdsFee) / 100;
    
    // 고정수수료(리스팅 수수료 0.2USD * 환율 + 결제고정 300원)
    const fixedFeesKrw = (fees.listingFee * exRate) + fees.paymentFeeFixed;
    
    // 3. 원가 대비 목표 마진액 계산 (Cost-plus Margin)
    // 순이익 = 원가 * (원가대비마진율 / 100)
    const targetMarginRate = targetMarginPercent / 100;
    const desiredProfitKrw = sourcingKrw * targetMarginRate;

    // 수식: 판매가 = (원가 + 배송비 + 수수료고정 + 목표순이익) / (1 - 수수료율)
    const optimalPriceKrw = (sourcingKrw + emsCostKrw + fixedFeesKrw + desiredProfitKrw) / (1 - feeRate);

    const optimalPriceUsd = optimalPriceKrw / exRate;
    const breakEvenKrw = (sourcingKrw + emsCostKrw + fixedFeesKrw) / (1 - feeRate);
    const breakEvenUsd = breakEvenKrw / exRate;

    // 각 수수료별 디테일 분석
    const finalTransFeeKrw = optimalPriceKrw * (fees.transactionFee / 100);
    const finalPaymentFeeKrw = (optimalPriceKrw * (fees.paymentFeePercent / 100)) + fees.paymentFeeFixed;
    const finalAdFeeKrw = optimalPriceKrw * (fees.offsiteAdsFee / 100);
    const finalListingFeeKrw = fees.listingFee * exRate;
    const totalFeesKrw = finalTransFeeKrw + finalPaymentFeeKrw + finalAdFeeKrw + finalListingFeeKrw;
    
    const profitKrw = optimalPriceKrw - sourcingKrw - emsCostKrw - totalFeesKrw;

    return {
      volWeight: wt.volumetric,
      chargeWeight: wt.charge,
      emsCostKrw: emsCostKrw,
      breakEvenUsd: breakEvenUsd,
      optimalPriceUsd: optimalPriceUsd,
      optimalPriceKrw: optimalPriceKrw,
      totalFeesKrw: totalFeesKrw,
      profitKrw: profitKrw
    };
  }

  // 개별 주문의 정확한 마진 계산
  calculateIndividualOrderMargin(order) {
    const product = db.getProductById(order.itemId);
    const exchangeRate = this.settings.exchangeRate;
    const fees = this.settings.etsyFees;
    
    // 소싱 상품 정보가 없거나 삭제되었을 때 fallback
    const sourcingKrw = product ? product.priceKrw : (order.calculatedCosts?.sourcingKrw || 0);
    const weight = product ? product.weight : 1.0;
    const width = product ? product.width : 30;
    const length = product ? product.length : 30;
    const height = product ? product.height : 10;

    const zone = this.ratesData.countryZones[order.country] || 'Zone 3';
    
    const wt = this.calculateChargeWeight(weight, width, length, height);
    const emsCostKrw = this.getEmsRate(zone, wt.charge);

    const salePriceKrw = order.salePriceUsd * exchangeRate;
    
    // 주문 시점 적용된 Etsy 수수료 계산
    const feeRate = (fees.transactionFee + fees.paymentFeePercent + fees.offsiteAdsFee) / 100;
    const fixedFeesKrw = (fees.listingFee * exchangeRate) + fees.paymentFeeFixed;
    const totalFeesKrw = (salePriceKrw * feeRate) + fixedFeesKrw;
    
    const netProfitKrw = salePriceKrw - sourcingKrw - emsCostKrw - totalFeesKrw;

    return {
      sourcingKrw,
      emsCostKrw,
      totalFeesKrw,
      netProfitKrw
    };
  }

  // --- MODALS OPEN/CLOSE CONTROL ---
  
  bindModalEvents() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if(e.target === overlay) {
          overlay.classList.remove('open');
        }
      });
    });
  }

  openProductModal(id = null) {
    const form = document.getElementById('product-form');
    form.reset();
    
    if (id) {
      // 수정 모드
      document.getElementById('product-modal-title').innerText = '소싱 상품 정보 수정';
      const p = db.getProductById(id);
      if (p) {
        document.getElementById('prod-id').value = p.id;
        document.getElementById('prod-url').value = p.url || '';
        document.getElementById('prod-title-ko').value = p.titleKo;
        document.getElementById('prod-title-en').value = p.titleEn;
        document.getElementById('prod-artist').value = p.artist;
        document.getElementById('prod-price-krw').value = p.priceKrw;
        document.getElementById('prod-weight').value = p.weight;
        document.getElementById('prod-width').value = p.width;
        document.getElementById('prod-length').value = p.length;
        document.getElementById('prod-height').value = p.height;
        document.getElementById('prod-target-margin').value = p.targetMargin;
        document.getElementById('prod-status').value = p.status;
        document.getElementById('prod-img').value = p.imgUrl || '';
        document.getElementById('prod-notes').value = p.notes || '';
      }
    } else {
      // 신규 등록 모드
      document.getElementById('product-modal-title').innerText = '소싱 상품 신규 등록';
      document.getElementById('prod-id').value = '';
    }
    
    this.calculateProductPricePreview();
    document.getElementById('modal-product').classList.add('open');
  }

  closeProductModal() {
    document.getElementById('modal-product').classList.remove('open');
  }

  saveProduct(event) {
    event.preventDefault();
    const id = document.getElementById('prod-id').value;
    
    const productData = {
      url: document.getElementById('prod-url').value,
      titleKo: document.getElementById('prod-title-ko').value,
      titleEn: document.getElementById('prod-title-en').value,
      artist: document.getElementById('prod-artist').value,
      priceKrw: parseInt(document.getElementById('prod-price-krw').value),
      weight: parseFloat(document.getElementById('prod-weight').value),
      width: parseInt(document.getElementById('prod-width').value),
      length: parseInt(document.getElementById('prod-length').value),
      height: parseInt(document.getElementById('prod-height').value),
      targetMargin: parseInt(document.getElementById('prod-target-margin').value),
      status: document.getElementById('prod-status').value,
      imgUrl: document.getElementById('prod-img').value || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=300&q=80',
      notes: document.getElementById('prod-notes').value
    };

    if (id) {
      productData.id = id;
      // 기존 상품 태그 유지
      const original = db.getProductById(id);
      productData.tags = original ? original.tags : this.generateMockTags(productData.titleEn, productData.artist);
      db.updateProduct(productData);
      this.showToast('상품 정보가 성공적으로 수정되었습니다.');
    } else {
      productData.tags = this.generateMockTags(productData.titleEn, productData.artist);
      db.addProduct(productData);
      this.showToast('신규 상품이 등록되었습니다.');
    }

    this.closeProductModal();
    this.renderSourcingList();
    this.renderDashboard();
  }

  // 타이틀 단어를 분석하여 Etsy용 태그를 간단히 시뮬레이션 추출하는 내부 함수
  generateMockTags(title, artist) {
    const cleaned = title.toLowerCase().replace(/[^a-zA-Z0-9 ]/g, '');
    const words = cleaned.split(' ').filter(w => w.length > 3);
    const tags = new Set();
    
    // 아티스트 태그 추가
    if(artist) {
      tags.add(artist.toLowerCase().split(' ')[0]);
    }
    
    // 키워드 대입
    words.forEach(w => {
      if(tags.size < 11) tags.add(w);
    });
    
    // 디폴트 메꿔주기
    const fallbacks = ["korean art", "print bakery", "seoul gifts", "wall art decor", "minimalist art", "housewarming gift", "livingroom art"];
    fallbacks.forEach(f => {
      if(tags.size < 13) tags.add(f);
    });
    
    return Array.from(tags).slice(0, 13);
  }

  calculateProductPricePreview() {
    const price = parseInt(document.getElementById('prod-price-krw').value) || 0;
    const wt = parseFloat(document.getElementById('prod-weight').value) || 0;
    const w = parseInt(document.getElementById('prod-width').value) || 0;
    const l = parseInt(document.getElementById('prod-length').value) || 0;
    const h = parseInt(document.getElementById('prod-height').value) || 0;
    const margin = parseInt(document.getElementById('prod-target-margin').value) || 0;

    const calc = this.calculateOptimalPrice(price, wt, w, l, h, margin, 'Zone 3');

    document.getElementById('calc-vol-weight').innerText = calc.volWeight.toFixed(3) + ' kg';
    document.getElementById('calc-charge-weight').innerText = calc.chargeWeight.toFixed(1) + ' kg';
    document.getElementById('calc-ems-cost').innerText = this.formatNumber(calc.emsCostKrw) + ' 원';
    document.getElementById('calc-etsy-fee').innerText = this.formatNumber(Math.round(calc.totalFeesKrw)) + ' 원';
    document.getElementById('calc-break-even').innerText = this.formatNumber(Math.round(calc.breakEvenUsd * this.settings.exchangeRate)) + ' 원 ($' + calc.breakEvenUsd.toFixed(2) + ')';
    document.getElementById('calc-etsy-price').innerText = '$' + calc.optimalPriceUsd.toFixed(2);

    // 시각화 바 및 범례 할당
    const totalVal = price + calc.emsCostKrw + calc.totalFeesKrw + calc.profitKrw;
    
    const pctSourcing = totalVal > 0 ? (price / totalVal) * 100 : 25;
    const pctShipping = totalVal > 0 ? (calc.emsCostKrw / totalVal) * 100 : 25;
    const pctFees = totalVal > 0 ? (calc.totalFeesKrw / totalVal) * 100 : 25;
    const pctProfit = totalVal > 0 ? (calc.profitKrw / totalVal) * 100 : 25;

    document.getElementById('bar-sourcing').style.width = pctSourcing + '%';
    document.getElementById('bar-shipping').style.width = pctShipping + '%';
    document.getElementById('bar-fees').style.width = pctFees + '%';
    document.getElementById('bar-profit').style.width = pctProfit + '%';

    document.getElementById('leg-sourcing').innerText = pctSourcing.toFixed(0) + '%';
    document.getElementById('leg-shipping').innerText = pctShipping.toFixed(0) + '%';
    document.getElementById('leg-fees').innerText = pctFees.toFixed(0) + '%';
    document.getElementById('leg-profit').innerText = pctProfit.toFixed(0) + '%';
  }

  // --- PRODUCT DETAIL & COPY ASSISTANT MODAL ---
  openProductDetailModal(id) {
    const p = db.getProductById(id);
    if (!p) return;

    this.currentDetailProductId = id;

    // 상세 이미지 및 메타데이터 바인딩
    document.getElementById('detail-modal-title').innerText = p.titleKo;
    document.getElementById('detail-img').src = p.imgUrl;
    document.getElementById('detail-artist').innerText = p.artist;
    document.getElementById('detail-price-krw').innerText = this.formatNumber(p.priceKrw);
    
    const volWeight = (p.width * p.length * p.height) / 6000;
    document.getElementById('detail-size').innerText = `${p.width} x ${p.length} x ${p.height} cm`;
    document.getElementById('detail-vol-weight').innerText = volWeight.toFixed(3);
    document.getElementById('detail-actual-weight').innerText = p.weight.toFixed(2);
    document.getElementById('detail-pb-link').href = p.url || '#';

    // 마진 계산서 출력 (US Zone 3 기준)
    const calc = this.calculateOptimalPrice(p.priceKrw, p.weight, p.width, p.length, p.height, p.targetMargin, 'Zone 3');
    document.getElementById('detail-etsy-price').innerText = `$${calc.optimalPriceUsd.toFixed(2)} (${this.formatNumber(Math.round(calc.optimalPriceKrw))} 원)`;
    document.getElementById('detail-ems-cost').innerText = this.formatNumber(calc.emsCostKrw);
    document.getElementById('detail-etsy-fees').innerText = this.formatNumber(Math.round(calc.totalFeesKrw));
    document.getElementById('detail-net-profit').innerText = this.formatNumber(Math.round(calc.profitKrw));
    
    const profitPercent = p.priceKrw > 0 ? (calc.profitKrw / p.priceKrw) * 100 : 0;
    document.getElementById('detail-margin-percent').innerText = profitPercent.toFixed(1) + '% (원가 대비)';

    // Etsy 등록용 데이터 자동 생성 및 복사 가능 영역 출력
    document.getElementById('copy-etsy-title').innerText = p.titleEn;
    
    const descText = `✨ Authentic Fine Art Print from PrintBakery Korea
🎨 Artist: ${p.artist}
📏 Dimensions: ${p.width} x ${p.length} x ${p.height} cm (Box Pack)
⚖️ Weight: ${p.weight} kg

[About the Artwork & Artist]
This high-fidelity limited print is curated and manufactured by PrintBakery, the premier fine art platform in Korea. It is a genuine and limited edition reprint, signed and certified by the artist.

[Shipping Information]
Sent via Korea Post EMS Premium (UPS Delivery Network). Safe, fast, and fully insured shipping straight from Seoul, South Korea.
- Est. delivery time: 3-5 business days.
- Tracking number provided upon dispatch.`;

    document.getElementById('copy-etsy-desc').innerText = descText;

    // 태그 렌더링
    const tagsContainer = document.getElementById('copy-etsy-tags-container');
    tagsContainer.innerHTML = '';
    
    if (p.tags && p.tags.length > 0) {
      p.tags.forEach(t => {
        const badge = document.createElement('span');
        badge.className = 'tag-badge';
        badge.innerText = t;
        tagsContainer.appendChild(badge);
      });
      document.getElementById('copy-etsy-tags').innerText = p.tags.join(', ');
    } else {
      tagsContainer.innerHTML = '<span class="text-muted">설정된 태그가 없습니다.</span>';
      document.getElementById('copy-etsy-tags').innerText = '';
    }

    // 포장 가이드 및 판매자 메모 렌더링
    const packingTip = this.getPackingTip(p.titleKo, p.notes || '');
    document.getElementById('detail-packing-tip-content').innerHTML = packingTip;

    document.getElementById('modal-product-detail').classList.add('open');
  }

  getPackingTip(title, notes) {
    const text = (title + ' ' + notes).toLowerCase();
    let guide = "";
    
    if (text.includes('베이스') || text.includes('화병') || text.includes('도자기') || 
        text.includes('달항아리') || text.includes('항아리') || text.includes('세라믹') ||
        text.includes('그릇') || text.includes('접시') || text.includes('오브제') || 
        text.includes('식기') || text.includes('머그') || text.includes('컵') ||
        text.includes('vase') || text.includes('ceramic') || text.includes('objet') || 
        text.includes('jar') || text.includes('pot') || text.includes('mug') || text.includes('cup')) {
      guide = `
        <div style="margin-bottom:0.4rem; color:var(--accent-yellow); font-weight:600;">⚠️ 도자기/화병류 파손주의 포장 가이드</div>
        <ul style="padding-left:1.1rem; margin:0; display:flex; flex-direction:column; gap:0.25rem; font-size:0.8rem; line-height:1.4;">
          <li>화병 내부 및 구부러진 목 부분에 에어캡을 채워 내부 충격 흡수</li>
          <li>제품 전체를 에어캡(뾱뾱이)으로 최소 3~4겹 이상 도톰하게 래핑</li>
          <li>1차 박스 포장 후, 더 큰 외박스에 넣고 빈 공간을 완충재(에어패드/습지)로 빈틈없이 보강 (이중 박스 필수)</li>
          <li>박스 외관 사방에 <strong>'FRAGILE(깨짐주의)'</strong> 적색 테이프/스티커 필수 부착</li>
        </ul>
      `;
    } else if (text.includes('쿠션') || text.includes('패브릭') || text.includes('인형') || 
               text.includes('러그') || text.includes('매트') || text.includes('이불') ||
               text.includes('cushion') || text.includes('fabric') || text.includes('rug') || text.includes('mat')) {
      guide = `
        <div style="margin-bottom:0.4rem; color:var(--accent-cyan); font-weight:600;">📦 패브릭/섬유류 압축 포장 가이드</div>
        <ul style="padding-left:1.1rem; margin:0; display:flex; flex-direction:column; gap:0.25rem; font-size:0.8rem; line-height:1.4;">
          <li>배송비 절감을 위해 진공 압축팩을 사용하여 부피(체적중량)를 최대한 줄임</li>
          <li>습기 방지를 위해 질긴 비닐 OPP 봉투로 1차 밀봉 포장</li>
          <li>개봉 시 칼이나 가위로 제품이 훼손되지 않도록 외관에 '개봉시 칼 사용 금지' 경고 문구 부착</li>
        </ul>
      `;
    } else if (text.includes('족자') || text.includes('포스터') || text.includes('지통') ||
               text.includes('poster') || text.includes('scroll') || text.includes('roll')) {
      guide = `
        <div style="margin-bottom:0.4rem; color:var(--accent-green); font-weight:600;">✉️ 지통 포스터 포장 가이드</div>
        <ul style="padding-left:1.1rem; margin:0; display:flex; flex-direction:column; gap:0.25rem; font-size:0.8rem; line-height:1.4;">
          <li>포스터/족자를 얇은 종이로 감싼 뒤 지통(Tube) 내부로 삽입</li>
          <li>지통 내부 양쪽 빈 공간에 습지나 에어캡을 넣어 흔들림으로 인한 구겨짐 방지</li>
          <li>지통 뚜껑 분실을 막기 위해 뚜껑 테두리를 박스 테이프로 단단히 3회 이상 마감</li>
        </ul>
      `;
    } else if (text.includes('주얼리') || text.includes('반지') || text.includes('목걸이') || 
               text.includes('귀걸이') || text.includes('jewelry') || text.includes('ring')) {
      guide = `
        <div style="margin-bottom:0.4rem; color:#d8b4fe; font-weight:600;">💍 소형 액세서리 안전 포장 가이드</div>
        <ul style="padding-left:1.1rem; margin:0; display:flex; flex-direction:column; gap:0.25rem; font-size:0.8rem; line-height:1.4;">
          <li>개별 주얼리 보관 선물 상자/파우치에 담아 보석 간 마찰 기스 예방</li>
          <li>에어캡 메일러(안전봉투) 또는 가로세로 20cm 정도의 소형 박스 이용</li>
          <li>박스가 너무 작으면 해외 배송 중 분실 위험이 높으므로 규격 이하 박스 사용 자제</li>
        </ul>
      `;
    } else {
      guide = `
        <div style="margin-bottom:0.4rem; color:var(--accent-cyan); font-weight:600;">🖼️ 일반 액자/아트프린트 포장 가이드</div>
        <ul style="padding-left:1.1rem; margin:0; display:flex; flex-direction:column; gap:0.25rem; font-size:0.8rem; line-height:1.4;">
          <li>유리가 있는 액자의 경우 유리면 전체에 박스 테이프를 'X'자로 밀착 부착 (파손 시 유리가 사방으로 튀는 것 방지)</li>
          <li>액자 모서리 4곳에 반드시 전용 보호 종이 가드 장착</li>
          <li>작품 전면에 골판지를 대고 에어캡으로 3겹 이상 감싸서 전용 플랫 메일러/카톤박스에 밀봉</li>
        </ul>
      `;
    }

    if (notes) {
      guide += `
        <div style="margin-top:0.6rem; border-top:1px solid rgba(255,255,255,0.08); padding-top:0.5rem;">
          <strong style="color:var(--text-muted); font-size:0.75rem;">📝 판매자 작성 메모:</strong>
          <div style="font-size:0.78rem; color:var(--text-light); margin-top:0.15rem; word-break:break-all; line-height:1.4;">${notes}</div>
        </div>
      `;
    }
    
    return guide;
  }

  closeProductDetailModal() {
    document.getElementById('modal-product-detail').classList.remove('open');
  }

  editProductFromDetail() {
    const id = this.currentDetailProductId;
    this.closeProductDetailModal();
    this.openProductModal(id);
  }

  deleteProduct(id) {
    if (confirm('정말로 이 소싱 상품을 데이터베이스에서 삭제하시겠습니까?\n해당 상품과 연동된 기존 주문들의 원가 정보는 유실될 수 있습니다.')) {
      db.deleteProduct(id);
      this.renderSourcingList();
      this.renderDashboard();
      this.showToast('소싱 상품이 삭제되었습니다.');
      return true;
    }
    return false;
  }

  deleteProductFromDetail() {
    const id = this.currentDetailProductId;
    if (this.deleteProduct(id)) {
      this.closeProductDetailModal();
    }
  }

  // --- 5. ETSY ORDER FORM CONTROL ---
  bindOrderProductDropdown() {
    const select = document.getElementById('order-item-id');
    select.innerHTML = '';
    
    const products = db.getProducts();
    products.forEach(p => {
      const opt = new Option(`[${p.artist}] ${p.titleKo}`, p.id);
      select.add(opt);
    });
  }

  openOrderModal(id = null) {
    const form = document.getElementById('order-form');
    form.reset();

    // 드롭다운 바인딩 호출
    this.bindOrderProductDropdown();
    
    if (id) {
      document.getElementById('order-modal-title').innerText = '주문 상세 및 송장 수정';
      const o = db.getOrderById(id);
      if (o) {
        document.getElementById('order-id').value = o.id;
        document.getElementById('order-date').value = o.date;
        document.getElementById('order-buyer-name').value = o.buyerName;
        document.getElementById('order-buyer-email').value = o.buyerEmail || '';
        document.getElementById('order-country').value = o.country;
        document.getElementById('order-address').value = o.address;
        document.getElementById('order-item-id').value = o.itemId;
        document.getElementById('order-qty').value = o.qty;
        document.getElementById('order-sale-usd').value = o.salePriceUsd;
        document.getElementById('order-tracking').value = o.trackingNumber || '';
        document.getElementById('order-sourcing-status').value = o.sourcingStatus;
        document.getElementById('order-shipping-status').value = o.shippingStatus;
      }
    } else {
      document.getElementById('order-modal-title').innerText = 'Etsy 주문 정보 등록';
      document.getElementById('order-id').value = '';
      document.getElementById('order-date').value = new Date().toISOString().substring(0, 10);
    }

    this.calculateOrderPricePreview();
    document.getElementById('modal-order').classList.add('open');
  }

  closeOrderModal() {
    document.getElementById('modal-order').classList.remove('open');
  }

  handleOrderCountryChange(country) {
    this.calculateOrderPricePreview();
  }

  handleOrderProductChange(prodId) {
    this.calculateOrderPricePreview();
  }

  calculateOrderPricePreview() {
    const country = document.getElementById('order-country').value;
    const prodId = document.getElementById('order-item-id').value;
    const qty = parseInt(document.getElementById('order-qty').value) || 1;
    const saleUsd = parseFloat(document.getElementById('order-sale-usd').value) || 0;

    const product = db.getProductById(prodId);
    if (!product) return;

    const zone = this.ratesData.countryZones[country] || 'Zone 3';
    
    // 청구 중량 계산 (단일 상품 규격 * 수량으로 시뮬레이션)
    const totalWeight = product.weight * qty;
    const wt = this.calculateChargeWeight(totalWeight, product.width, product.length, product.height);
    const emsCostKrw = this.getEmsRate(zone, wt.charge);

    const saleKrw = saleUsd * this.settings.exchangeRate;
    const fees = this.settings.etsyFees;
    
    const feeRate = (fees.transactionFee + fees.paymentFeePercent + fees.offsiteAdsFee) / 100;
    const fixedFeesKrw = (fees.listingFee * this.settings.exchangeRate) + fees.paymentFeeFixed;
    const totalFeesKrw = (saleKrw * feeRate) + fixedFeesKrw;

    const profitKrw = saleKrw - (product.priceKrw * qty) - emsCostKrw - totalFeesKrw;

    document.getElementById('order-calc-zone').innerText = `${country} (${zone})`;
    document.getElementById('order-calc-ems').innerText = `${zone} 적용 / ${this.formatNumber(emsCostKrw)} 원 (청구중량: ${wt.charge.toFixed(1)}kg)`;
    document.getElementById('order-calc-fees').innerText = `${this.formatNumber(Math.round(totalFeesKrw))} 원`;
    document.getElementById('order-calc-profit').innerText = `${this.formatNumber(Math.round(profitKrw))} 원`;
    
    const profitEl = document.getElementById('order-calc-profit');
    if (profitKrw < 0) {
      profitEl.className = 'text-pink font-weight-bold';
    } else {
      profitEl.className = 'text-green font-weight-bold';
    }
  }

  saveOrder(event) {
    event.preventDefault();
    const id = document.getElementById('order-id').value;
    
    const orderData = {
      date: document.getElementById('order-date').value,
      buyerName: document.getElementById('order-buyer-name').value,
      buyerEmail: document.getElementById('order-buyer-email').value,
      country: document.getElementById('order-country').value,
      address: document.getElementById('order-address').value,
      itemId: document.getElementById('order-item-id').value,
      qty: parseInt(document.getElementById('order-qty').value),
      salePriceUsd: parseFloat(document.getElementById('order-sale-usd').value),
      trackingNumber: document.getElementById('order-tracking').value,
      sourcingStatus: document.getElementById('order-sourcing-status').value,
      shippingStatus: document.getElementById('order-shipping-status').value,
      notes: document.getElementById('order-notes').value
    };

    const product = db.getProductById(orderData.itemId);
    orderData.itemName = product ? product.titleEn : 'Etsy Exported Art Print';

    // 수동 상태 연동
    if (orderData.trackingNumber && orderData.shippingStatus === 'Ready') {
      orderData.shippingStatus = 'Shipped';
    }

    if (id) {
      orderData.id = id;
      db.updateOrder(orderData);
      this.showToast('주문 정보가 업데이트되었습니다.');
    } else {
      db.addOrder(orderData);
      this.showToast('새 Etsy 주문이 등록되었습니다.');
    }

    this.closeOrderModal();
    this.renderOrdersList();
    this.renderDashboard();
  }

  deleteOrder(id) {
    if (confirm('이 Etsy 주문 내역을 데이터베이스에서 영구히 삭제하시겠습니까?')) {
      db.deleteOrder(id);
      this.renderOrdersList();
      this.renderDashboard();
      this.showToast('주문 내역이 삭제되었습니다.');
    }
  }

  // --- 6. CUSTOMS INVOICE HELP DIALOG ---
  openInvoiceModal(orderId) {
    const o = db.getOrderById(orderId);
    if (!o) return;

    const product = db.getProductById(o.itemId);
    const weight = product ? product.weight : 1.0;

    // 수취인 배송 데이터 텍스트 생성
    const receiverText = `NAME: ${o.buyerName}
EMAIL: ${o.buyerEmail || 'N/A'}
ADDRESS: ${o.address}
COUNTRY: ${o.country}
SHIPPING VIA: Korea Post EMS Premium (UPS Partner)`;

    // 세관신고항목(CN23) 데이터 생성 (미술품 HS Code: 9701.21.0000 - 서양화 등 회화)
    const customsText = `ITEM DESC (영문명): Printed Fine Art Wall Decoration
HS CODE: 9701210000
QTY: ${o.qty}
WEIGHT: ${weight} kg
VALUE: $${o.salePriceUsd} USD
ORIGIN COUNTRY: South Korea (KR)`;

    document.getElementById('copy-receiver-details').innerText = receiverText;
    document.getElementById('copy-customs-details').innerText = customsText;

    document.getElementById('modal-invoice').classList.add('open');
  }

  closeInvoiceModal() {
    document.getElementById('modal-invoice').classList.remove('open');
  }

  // --- 7. STANDALONE SHIPPING CALCULATOR CONTROLLER ---
  openShippingCalcModal() {
    this.runStandaloneShippingCalc();
    document.getElementById('modal-shipping-calc').classList.add('open');
  }

  closeShippingCalcModal() {
    document.getElementById('modal-shipping-calc').classList.remove('open');
  }

  runStandaloneShippingCalc() {
    const country = document.getElementById('sc-country').value;
    const wt = parseFloat(document.getElementById('sc-weight').value) || 0;
    const w = parseInt(document.getElementById('sc-width').value) || 0;
    const l = parseInt(document.getElementById('sc-length').value) || 0;
    const h = parseInt(document.getElementById('sc-height').value) || 0;

    const zone = this.ratesData.countryZones[country] || 'Zone 3';
    
    // 체적/청구중량 계산
    const volWeight = (w * l * h) / 6000;
    const maxWeight = Math.max(wt, volWeight);
    const charge = Math.ceil(maxWeight * 2) / 2; // 0.5 올림
    
    const rate = this.getEmsRate(zone, charge);

    document.getElementById('sc-res-zone').innerText = `${country} (${zone})`;
    document.getElementById('sc-res-vol-weight').innerText = `${volWeight.toFixed(3)} kg`;
    document.getElementById('sc-res-charge-weight').innerText = `${charge.toFixed(1)} kg`;
    document.getElementById('sc-res-cost').innerText = `${this.formatNumber(rate)} 원`;
  }

  // --- 8. BOOKMARKLET MANUAL DIALOG ---
  openBookmarkletModal() {
    document.getElementById('modal-bookmarklet').classList.add('open');
  }

  closeBookmarkletModal() {
    document.getElementById('modal-bookmarklet').classList.remove('open');
  }

  generateBookmarklet() {
    // 로컬 호스트 도메인 주소 추출
    const origin = window.location.origin + window.location.pathname;

    const bookmarkletScript = `javascript:(function(){
      const title = document.querySelector('.goods_name')?.innerText || document.querySelector('.info_section h3')?.innerText || document.querySelector('h2')?.innerText || '';
      const priceText = document.querySelector('.goods_price')?.innerText || document.querySelector('.price')?.innerText || '0';
      const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
      const artist = document.querySelector('.goods_artist')?.innerText || document.querySelector('.artist_name')?.innerText || 'Unknown';
      const imgUrl = document.querySelector('.goods_image img')?.src || document.querySelector('.detail_img img')?.src || document.querySelector('img')?.src || '';
      const currentUrl = window.location.href;
      
      const saasUrl = '${origin}';
      const query = '?pb_url=' + encodeURIComponent(currentUrl) + 
                    '&pb_title=' + encodeURIComponent(title) + 
                    '&pb_price=' + price + 
                    '&pb_artist=' + encodeURIComponent(artist) + 
                    '&pb_img=' + encodeURIComponent(imgUrl);
      
      window.open(saasUrl + query, '_blank');
    })();`.replace(/\s+/g, ' '); // 공백 줄여 한 줄로 압축

    const links = ['bookmarklet-link', 'bookmarklet-modal-link'];
    links.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.setAttribute('href', bookmarkletScript);
      }
    });
  }

  estimatePackaging(title, description) {
    const text = (title + ' ' + description).toLowerCase();
    
    // 1. 도자기 / 화병 / 식기류 / 오브제 (Vase, Ceramic, Plate, Bowl, Base, Objet, Jar, Moon Jar, Pot)
    if (text.includes('베이스') || text.includes('화병') || text.includes('도자기') || 
        text.includes('달항아리') || text.includes('항아리') || text.includes('세라믹') ||
        text.includes('그릇') || text.includes('접시') || text.includes('오브제') || 
        text.includes('식기') || text.includes('머그') || text.includes('컵') ||
        text.includes('vase') || text.includes('base') || text.includes('ceramic') || 
        text.includes('bowl') || text.includes('plate') || text.includes('objet') ||
        text.includes('jar') || text.includes('pot') || text.includes('mug') || text.includes('cup')) {
      return { weight: 2.0, width: 30, length: 30, height: 30, notes: "도자기/화병류 파손 방지 완충포장 필수. 체적중량 적용 주의." };
    }
    
    // 2. 조명 / 램프 / 캔들 (Lighting, Lamp, Candle)
    if (text.includes('조명') || text.includes('램프') || text.includes('캔들') || 
        text.includes('향초') || text.includes('인센스') ||
        text.includes('lamp') || text.includes('lighting') || text.includes('candle') || text.includes('incense')) {
      return { weight: 1.2, width: 25, length: 25, height: 25, notes: "조명 및 인센스 소품류. 충격 방지 완충재 꼼꼼하게 포장 요망." };
    }

    // 3. 쿠션 / 패브릭 / 러그 / 매트 (Cushion, Fabric, Rug, Mat)
    if (text.includes('쿠션') || text.includes('패브릭') || text.includes('인형') || 
        text.includes('러그') || text.includes('매트') || text.includes('담요') || text.includes('이불') ||
        text.includes('cushion') || text.includes('fabric') || text.includes('rug') || text.includes('mat') || text.includes('blanket')) {
      return { weight: 0.8, width: 30, length: 30, height: 15, notes: "패브릭/쿠션/러그류 제품. 파손 위험 낮음. 압축 포장 권장." };
    }
    
    // 4. 족자 / 롤 포스터 (Scroll, Poster, Roll)
    if (text.includes('족자') || text.includes('포스터') || text.includes('지통') ||
        text.includes('poster') || text.includes('scroll') || text.includes('roll')) {
      return { weight: 0.8, width: 10, length: 10, height: 60, notes: "포스터 튜브형 지통 포장 규격 적용." };
    }

    // 5. 소형 주얼리 / 악세서리 / 소품 (Jewelry, Ring, Small Accessories)
    if (text.includes('주얼리') || text.includes('반지') || text.includes('목걸이') || 
        text.includes('귀걸이') || text.includes('팔찌') || text.includes('키링') || 
        text.includes('jewelry') || text.includes('ring') || text.includes('accessory') || text.includes('keyring')) {
      return { weight: 0.3, width: 20, length: 15, height: 10, notes: "악세서리 소포장용 소형 박스 규격 적용." };
    }

    // 기본값: 일반 플랫 액자/판화 (Art Print / Frame)
    return { weight: 1.5, width: 50, length: 40, height: 5, notes: "일반 액자/아트프린트 평평한 박스 포장 규격 적용." };
  }

  checkBookmarkletQuery() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('pb_url')) {
      const pbUrl = params.get('pb_url');
      const pbTitle = params.get('pb_title');
      const pbPrice = parseInt(params.get('pb_price')) || 0;
      const pbArtist = params.get('pb_artist');
      const pbImg = params.get('pb_img');

      // 쿼리 파라미터 캐시 방지 및 주소창 클리닝
      window.history.replaceState({}, document.title, window.location.pathname);

      // 소싱 신규 폼에 자동 입력 처리
      setTimeout(() => {
        this.navigate('sourcing');
        this.openProductModal();
        
        document.getElementById('prod-url').value = pbUrl;
        document.getElementById('prod-title-ko').value = pbTitle;
        document.getElementById('prod-price-krw').value = pbPrice;
        document.getElementById('prod-artist').value = pbArtist;
        document.getElementById('prod-img').value = pbImg;
        
        // 영어 타이틀 자동 초안
        document.getElementById('prod-title-en').value = `Original Fine Art Print by Artist ${pbArtist} - ${pbTitle}`;
        
        // AI 기반 포장 사양(무게 및 크기) 자동 예측 대입
        const pkg = this.estimatePackaging(pbTitle, '');
        document.getElementById('prod-weight').value = pkg.weight;
        document.getElementById('prod-width').value = pkg.width;
        document.getElementById('prod-length').value = pkg.length;
        document.getElementById('prod-height').value = pkg.height;
        if (pkg.notes) {
          document.getElementById('prod-notes').value = pkg.notes;
        }
        
        this.calculateProductPricePreview();
        this.showToast('PrintBakery 상품 정보가 북마크클릿으로 자동 연동되었습니다!');
      }, 500);
    }
  }

  checkInboxProducts() {
    fetch('data/inbox_products.json')
      .then(response => {
        if (!response.ok) return null;
        return response.json();
      })
      .then(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          const currentProducts = db.getProducts();
          const currentIds = currentProducts.map(p => p.id);
          
          // 이미 가져온 상품을 판별 (새로운 ID 체크)
          const newProducts = data.filter(p => !currentIds.includes(p.id));
          
          if (newProducts.length > 0) {
            newProducts.forEach(p => {
              db.addProductDirectly(p);
            });
            this.showToast(`AI가 수집한 신규 상품 ${newProducts.length}건이 등록되었습니다!`);
            
            // 현재 화면이 소싱관리 또는 대시보드면 리스트 새로고침
            if (this.currentView === 'sourcing') {
              this.renderSourcingList();
            } else if (this.currentView === 'dashboard') {
              this.renderDashboard();
            }
          }
        }
      })
      .catch(err => {
        // 백그라운드 체크 파일 없을 때의 에러 무시
      });
  }

  // --- 9. DATA BACKUP & RESTORE ---
  backupData() {
    const jsonStr = db.exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `seoul_bakery_gifts_backup_${new Date().toISOString().substring(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('데이터 백업 파일 다운로드가 시작되었습니다.');
  }

  restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const backupString = e.target.result;
      const res = db.importBackup(backupString);
      if (res.success) {
        this.settings = db.getSettings();
        this.ratesData = db.getEmsRates();
        
        this.updateExchangeRateUI();
        this.bindCountryLists();
        this.navigate('dashboard');
        
        this.showToast('데이터베이스가 성공적으로 복원되었습니다.');
      } else {
        alert('데이터 복원 실패: ' + res.error);
      }
    };
    reader.readAsText(file);
    // 선택한 파일 초기화하여 동일 파일 재선택 가능하게 함
    event.target.value = '';
  }

  // --- COMMON UTILITIES ---
  formatNumber(num) {
    return Number(num).toLocaleString('ko-KR');
  }

  showToast(message) {
    const toast = document.getElementById('copied-toast');
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const textToCopy = element.innerText || element.value;
    navigator.clipboard.writeText(textToCopy).then(() => {
      this.showToast('클립보드에 복사되었습니다!');
    }).catch(err => {
      console.error('클립보드 복사 실패:', err);
    });
  }


}

// 초기화
const app = new App();
window.app = app;
