// 우체국 EMS 프리미엄 기본 요금표 (원화 KRW 기준)
// 1지역: 아시아 주요국 (일본, 중국, 대만, 싱가포르 등)
// 2지역: 기타 아시아, 오세아니아 (호주, 뉴질랜드 등)
// 3지역: 북미/서유럽 (미국, 캐나다, 영국, 독일 등) - Etsy 주 타겟
// 4지역: 동유럽/중동
// 5지역: 아프리카/중남미

const DEFAULT_EMS_RATES = {
  "Zone 1": [
    { weight: 0.5, rate: 22000 },
    { weight: 1.0, rate: 26000 },
    { weight: 1.5, rate: 30000 },
    { weight: 2.0, rate: 34000 },
    { weight: 2.5, rate: 38000 },
    { weight: 3.0, rate: 42000 },
    { weight: 4.0, rate: 50000 },
    { weight: 5.0, rate: 58000 },
    { weight: 6.0, rate: 66000 },
    { weight: 7.0, rate: 74000 },
    { weight: 8.0, rate: 82000 },
    { weight: 9.0, rate: 90000 },
    { weight: 10.0, rate: 98000 },
    { weight: 15.0, rate: 138000 },
    { weight: 20.0, rate: 178000 },
    { weight: 25.0, rate: 218000 },
    { weight: 30.0, rate: 258000 }
  ],
  "Zone 2": [
    { weight: 0.5, rate: 25000 },
    { weight: 1.0, rate: 31000 },
    { weight: 1.5, rate: 37000 },
    { weight: 2.0, rate: 43000 },
    { weight: 2.5, rate: 49000 },
    { weight: 3.0, rate: 55000 },
    { weight: 4.0, rate: 67000 },
    { weight: 5.0, rate: 79000 },
    { weight: 6.0, rate: 91000 },
    { weight: 7.0, rate: 103000 },
    { weight: 8.0, rate: 115000 },
    { weight: 9.0, rate: 127000 },
    { weight: 10.0, rate: 139000 },
    { weight: 15.0, rate: 199000 },
    { weight: 20.0, rate: 259000 },
    { weight: 25.0, rate: 319000 },
    { weight: 30.0, rate: 379000 }
  ],
  "Zone 3": [
    { weight: 0.5, rate: 33000 },
    { weight: 1.0, rate: 45000 },
    { weight: 1.5, rate: 53500 },
    { weight: 2.0, rate: 62000 },
    { weight: 2.5, rate: 70000 },
    { weight: 3.0, rate: 78000 },
    { weight: 4.0, rate: 94000 },
    { weight: 5.0, rate: 110000 },
    { weight: 6.0, rate: 126000 },
    { weight: 7.0, rate: 142000 },
    { weight: 8.0, rate: 158000 },
    { weight: 9.0, rate: 174000 },
    { weight: 10.0, rate: 190000 },
    { weight: 15.0, rate: 270000 },
    { weight: 20.0, rate: 350000 },
    { weight: 25.0, rate: 430000 },
    { weight: 30.0, rate: 510000 }
  ],
  "Zone 4": [
    { weight: 0.5, rate: 38000 },
    { weight: 1.0, rate: 53000 },
    { weight: 1.5, rate: 64000 },
    { weight: 2.0, rate: 75000 },
    { weight: 2.5, rate: 86000 },
    { weight: 3.0, rate: 98000 },
    { weight: 4.0, rate: 120000 },
    { weight: 5.0, rate: 142000 },
    { weight: 6.0, rate: 164000 },
    { weight: 7.0, rate: 186000 },
    { weight: 8.0, rate: 208000 },
    { weight: 9.0, rate: 230000 },
    { weight: 10.0, rate: 252000 },
    { weight: 15.0, rate: 362000 },
    { weight: 20.0, rate: 472000 },
    { weight: 25.0, rate: 582000 },
    { weight: 30.0, rate: 692000 }
  ],
  "Zone 5": [
    { weight: 0.5, rate: 43000 },
    { weight: 1.0, rate: 60000 },
    { weight: 1.5, rate: 74000 },
    { weight: 2.0, rate: 88000 },
    { weight: 2.5, rate: 101000 },
    { weight: 3.0, rate: 115000 },
    { weight: 4.0, rate: 143000 },
    { weight: 5.0, rate: 171000 },
    { weight: 6.0, rate: 199000 },
    { weight: 7.0, rate: 227000 },
    { weight: 8.0, rate: 255000 },
    { weight: 9.0, rate: 283000 },
    { weight: 10.0, rate: 311000 },
    { weight: 15.0, rate: 451000 },
    { weight: 20.0, rate: 591000 },
    { weight: 25.0, rate: 731000 },
    { weight: 30.0, rate: 871000 }
  ]
};

const COUNTRY_ZONES = {
  "United States": "Zone 3",
  "Canada": "Zone 3",
  "United Kingdom": "Zone 3",
  "Germany": "Zone 3",
  "France": "Zone 3",
  "Japan": "Zone 1",
  "China": "Zone 1",
  "Hong Kong": "Zone 1",
  "Taiwan": "Zone 1",
  "Singapore": "Zone 1",
  "Australia": "Zone 2",
  "New Zealand": "Zone 2",
  "Russia": "Zone 4",
  "Brazil": "Zone 5",
  "South Africa": "Zone 5",
  "Saudi Arabia": "Zone 4"
};
