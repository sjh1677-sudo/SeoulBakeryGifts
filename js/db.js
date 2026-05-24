// LocalStorage 기반 미니 DB 선언 및 초기 모의 데이터 세팅

const DB_KEYS = {
  PRODUCTS: "sbg_sourcing_products",
  ORDERS: "sbg_etsy_orders",
  SETTINGS: "sbg_system_settings",
  EMS_RATES: "sbg_custom_ems_rates"
};

const INITIAL_PRODUCTS = [
  {
    id: "pb-prod-001",
    url: "https://www.printbakery.com/goods/10001",
    titleKo: "달항아리 (Moon Jar) 아트프린트",
    titleEn: "Korean Traditional White Porcelain Moon Jar Fine Art Print by Artist Min",
    artist: "민병훈 (Min Byung-hun)",
    priceKrw: 180000,
    weight: 1.2,
    width: 45,
    length: 45,
    height: 6,
    targetMargin: 100,
    status: "Active", // Sourced, Draft, Active, Out of Stock
    tags: ["moon jar", "korean art print", "fine art print", "korean pottery", "traditional craft", "zen wall decor", "original print", "korean artist", "white porcelain", "housewarming gift", "oriental painting", "minimalist art", "print bakery"],
    notes: "PrintBakery Limited edition, signed by the artist. Fragile packing needed.",
    imgUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "pb-prod-002",
    url: "https://www.printbakery.com/goods/10002",
    titleKo: "봄날의 경복궁 (Spring at Palace)",
    titleEn: "Seoul Gyeongbokgung Palace Spring Flower Silk Screen Wall Hanging",
    artist: "김선우 (Sunwoo Kim)",
    priceKrw: 320000,
    weight: 2.8,
    width: 60,
    length: 45,
    height: 8,
    targetMargin: 100,
    status: "Active",
    tags: ["gyeongbokgung", "seoul print", "korean palace", "cherry blossom art", "silk screen", "sunwoo kim", "korean landscape", "modern minwha", "seoul travel", "colorful wall art", "korean aesthetic", "framed print", "print bakery"],
    notes: "Heavy frame, double check packing dimensions. Target zone: US.",
    imgUrl: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "pb-prod-003",
    url: "https://www.printbakery.com/goods/10003",
    titleKo: "현대 민화 족자 - 호작도 (Tiger and Magpie)",
    titleEn: "Modern Korean Folk Art Minhwa Tiger and Magpie Scroll Poster",
    artist: "박수근 (Sookeun Park)",
    priceKrw: 85000,
    weight: 0.6,
    width: 35,
    length: 35,
    height: 4,
    targetMargin: 100,
    status: "Draft",
    tags: ["hojakdo", "korean tiger", "traditional minhwa", "korean scroll", "oriental poster", "magpie tiger", "good luck charm", "asian folk art", "korean folklore", "office wall decor", "korean style", "retro design", "korean gift"],
    notes: "Lightweight item, scroll rollup design. Cheap EMS cost.",
    imgUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=300&q=80"
  }
];

const INITIAL_ORDERS = [
  {
    id: "etsy-order-101",
    date: "2026-05-20",
    buyerName: "Sarah Connor",
    buyerEmail: "sarah.c@example.com",
    country: "United States",
    address: "1200 Grand Ave, Los Angeles, CA 90015, USA",
    itemId: "pb-prod-001",
    itemName: "Korean Traditional White Porcelain Moon Jar Fine Art Print by Artist Min",
    qty: 1,
    salePriceUsd: 220.00,
    sourcingStatus: "Arrived", // Pending (소싱 대기), Ordered (발주 완료), Arrived (사무실 입고), Shipped (배송 완료)
    shippingStatus: "Shipped", // Ready, Shipped, Delivered
    trackingNumber: "UP849502938KR",
    notes: "Requested gift wrap.",
    calculatedCosts: {
      sourcingKrw: 180000,
      shippingKrw: 62000, // Zone 3, 1.2kg actual weight, vol weight (45x45x6/6000 = 2.025kg => 2.5kg applied = 70,000 KRW, wait let's calculate based on actual settings)
      etsyFeesUsd: 22.00,
      netProfitKrw: 35000
    }
  },
  {
    id: "etsy-order-102",
    date: "2026-05-23",
    buyerName: "Kenji Sato",
    buyerEmail: "sato.k@example.co.jp",
    country: "Japan",
    address: "2-chome-1-1 Nihonbashi, Chuo City, Tokyo 103-0027, Japan",
    itemId: "pb-prod-003",
    itemName: "Modern Korean Folk Art Minhwa Tiger and Magpie Scroll Poster",
    qty: 1,
    salePriceUsd: 95.00,
    sourcingStatus: "Ordered",
    shippingStatus: "Ready",
    trackingNumber: "",
    notes: "Fast delivery requested.",
    calculatedCosts: {
      sourcingKrw: 85000,
      shippingKrw: 34000,
      etsyFeesUsd: 8.50,
      netProfitKrw: 12000
    }
  },
  {
    id: "etsy-order-103",
    date: "2026-05-24",
    buyerName: "Emily Watson",
    buyerEmail: "emily.watson@example.co.uk",
    country: "United Kingdom",
    address: "221B Baker St, London NW1 6XE, United Kingdom",
    itemId: "pb-prod-002",
    itemName: "Seoul Gyeongbokgung Palace Spring Flower Silk Screen Wall Hanging",
    qty: 1,
    salePriceUsd: 380.00,
    sourcingStatus: "Pending",
    shippingStatus: "Ready",
    trackingNumber: "",
    notes: "Palace print order. High priority.",
    calculatedCosts: {
      sourcingKrw: 320000,
      shippingKrw: 94000,
      etsyFeesUsd: 38.00,
      netProfitKrw: 48000
    }
  }
];

const INITIAL_SETTINGS = {
  exchangeRate: 1380, // 1 USD = 1380 KRW
  etsyFees: {
    transactionFee: 6.5,  // 6.5%
    listingFee: 0.20,     // 0.20 USD
    paymentFeePercent: 4.0, // 4.0%
    paymentFeeFixed: 300,  // 300 KRW
    offsiteAdsFee: 0      // 0% (optional 12% or 15%)
  }
};

class LocalDatabase {
  constructor() {
    this.init();
  }

  init() {
    // 1. 설정 초기화
    if (!localStorage.getItem(DB_KEYS.SETTINGS)) {
      localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
    }
    // 2. 배송 요율 초기화
    if (!localStorage.getItem(DB_KEYS.EMS_RATES)) {
      localStorage.setItem(DB_KEYS.EMS_RATES, JSON.stringify({
        rates: DEFAULT_EMS_RATES,
        countryZones: COUNTRY_ZONES
      }));
    }
    // 3. 상품 목록 초기화
    if (!localStorage.getItem(DB_KEYS.PRODUCTS)) {
      localStorage.setItem(DB_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
    } else {
      // 마진 계산 모델 변경에 따른 기존 캐시 데이터 마진값 자동 마이그레이션 (25 / 30 / 20 -> 100)
      try {
        const prods = JSON.parse(localStorage.getItem(DB_KEYS.PRODUCTS)) || [];
        let updated = false;
        prods.forEach(p => {
          if (p.targetMargin === 25 || p.targetMargin === 30 || p.targetMargin === 20) {
            p.targetMargin = 100;
            updated = true;
          }
        });
        if (updated) {
          localStorage.setItem(DB_KEYS.PRODUCTS, JSON.stringify(prods));
        }
      } catch (e) {
        console.error("Migration error:", e);
      }
    }
    // 4. 주문 목록 초기화
    if (!localStorage.getItem(DB_KEYS.ORDERS)) {
      localStorage.setItem(DB_KEYS.ORDERS, JSON.stringify(INITIAL_ORDERS));
    }
  }

  // --- SETTINGS CRUD ---
  getSettings() {
    return JSON.parse(localStorage.getItem(DB_KEYS.SETTINGS));
  }

  saveSettings(settings) {
    localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify(settings));
    return settings;
  }

  // --- EMS RATES CRUD ---
  getEmsRates() {
    return JSON.parse(localStorage.getItem(DB_KEYS.EMS_RATES));
  }

  saveEmsRates(ratesData) {
    localStorage.setItem(DB_KEYS.EMS_RATES, JSON.stringify(ratesData));
    return ratesData;
  }

  // --- PRODUCTS CRUD ---
  getProducts() {
    return JSON.parse(localStorage.getItem(DB_KEYS.PRODUCTS)) || [];
  }

  saveProducts(products) {
    localStorage.setItem(DB_KEYS.PRODUCTS, JSON.stringify(products));
    return products;
  }

  getProductById(id) {
    const products = this.getProducts();
    return products.find(p => p.id === id);
  }

  addProduct(product) {
    const products = this.getProducts();
    product.id = "pb-prod-" + Date.now();
    products.unshift(product); // 최신 상품이 앞으로 오도록
    this.saveProducts(products);
    return product;
  }

  addProductDirectly(product) {
    const products = this.getProducts();
    // 중복 제거 검사
    if (!products.some(p => p.id === product.id)) {
      products.unshift(product);
      this.saveProducts(products);
    }
    return product;
  }

  updateProduct(product) {
    const products = this.getProducts();
    const index = products.findIndex(p => p.id === product.id);
    if (index !== -1) {
      products[index] = product;
      this.saveProducts(products);
      return product;
    }
    return null;
  }

  deleteProduct(id) {
    let products = this.getProducts();
    products = products.filter(p => p.id !== id);
    this.saveProducts(products);
    return true;
  }

  // --- ORDERS CRUD ---
  getOrders() {
    return JSON.parse(localStorage.getItem(DB_KEYS.ORDERS)) || [];
  }

  saveOrders(orders) {
    localStorage.setItem(DB_KEYS.ORDERS, JSON.stringify(orders));
    return orders;
  }

  getOrderById(id) {
    const orders = this.getOrders();
    return orders.find(o => o.id === id);
  }

  addOrder(order) {
    const orders = this.getOrders();
    order.id = "etsy-order-" + Date.now();
    orders.unshift(order);
    this.saveOrders(orders);
    return order;
  }

  updateOrder(order) {
    const orders = this.getOrders();
    const index = orders.findIndex(o => o.id === order.id);
    if (index !== -1) {
      orders[index] = order;
      this.saveOrders(orders);
      return order;
    }
    return null;
  }

  deleteOrder(id) {
    let orders = this.getOrders();
    orders = orders.filter(o => o.id !== id);
    this.saveOrders(orders);
    return true;
  }

  // --- BACKUP & RESTORE ---
  exportBackup() {
    const backup = {
      settings: this.getSettings(),
      emsRates: this.getEmsRates(),
      products: this.getProducts(),
      orders: this.getOrders(),
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(backup, null, 2);
  }

  importBackup(backupString) {
    try {
      const data = JSON.parse(backupString);
      if (data.settings && data.emsRates && data.products && data.orders) {
        localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify(data.settings));
        localStorage.setItem(DB_KEYS.EMS_RATES, JSON.stringify(data.emsRates));
        localStorage.setItem(DB_KEYS.PRODUCTS, JSON.stringify(data.products));
        localStorage.setItem(DB_KEYS.ORDERS, JSON.stringify(data.orders));
        return { success: true };
      }
      return { success: false, error: "유효하지 않은 백업 포맷입니다." };
    } catch (e) {
      return { success: false, error: "JSON 파싱 오류가 발생했습니다: " + e.message };
    }
  }
}

const db = new LocalDatabase();
window.db = db; // 전역 바인딩
