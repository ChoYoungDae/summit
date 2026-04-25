/**
 * Fix route tags and highlights:
 *   - Remove # prefix from tags, replace underscores with spaces
 *   - Shorten highlight text to ≤40 EN / ≤22 KO chars
 *   - Trim to max 3 highlights per route
 *   - Add zh, ja, es translations
 *
 * Usage: node --env-file=.env.local scripts/update-route-content.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE);

// ── Updated route content ──────────────────────────────────────────────────────

const UPDATES = [
  // ── Route 6: Bukhansan — Bukhansanseong Entrance → Ui Valley ────────────────
  {
    id: 6,
    tags: [
      { en: "Classic Route",  ko: "대표 코스",  zh: "经典路线",   ja: "定番ルート",   es: "Ruta Clásica"      },
      { en: "Starbucks View", ko: "스타벅스 뷰", zh: "星巴克景观",  ja: "スタバ絶景",   es: "Vista Starbucks"   },
      { en: "Quick Descent",  ko: "최단 하산",  zh: "快速下山",   ja: "最短下山",    es: "Descenso Rápido"   },
    ],
    highlights: [
      {
        type: "highlight",
        text: { en: "Most iconic route in Bukhansan",        ko: "북한산 대표 코스",           zh: "北汉山最具代表性路线",  ja: "北漢山の代表ルート",        es: "La ruta más icónica de Bukhansan"     },
      },
      {
        type: "pro_tip",
        text: { en: "Starbucks views; long queues expected", ko: "스타벅스 뷰, 대기 시간 길 수 있음", zh: "星巴克绝景，等候时间较长", ja: "スタバ絶景あり、混雑に注意",     es: "Vistas Starbucks; largas esperas"       },
      },
      {
        type: "warning",
        text: { en: "Long walk to station from trailhead",   ko: "등산로 입구에서 역까지 도보 거리 있음", zh: "登山口到地铁站步行距离较长", ja: "登山口から駅まで徒歩距離あり",  es: "Larga caminata del sendero a la estación" },
      },
    ],
  },

  // ── Route 1: Gwanaksan — Sadang Ridge → SNU Eng. Valley ─────────────────────
  {
    id: 1,
    tags: [
      { en: "Subway Access", ko: "지하철 접근", zh: "地铁直达",  ja: "電車直結",   es: "Acceso Metro"     },
      { en: "Rocky Ridge",   ko: "암릉 구간",  zh: "岩脊路段",  ja: "岩稜コース",  es: "Cresta Rocosa"   },
      { en: "Fast Descent",  ko: "빠른 하산",  zh: "快速下山",  ja: "速い下山",   es: "Descenso Veloz"  },
    ],
    highlights: [
      {
        type: "pro_tip",
        text: { en: "Trail starts right at the station",          ko: "역 바로 앞에서 등산로 시작",    zh: "登山口就在地铁站旁",   ja: "駅のすぐそばで登山道スタート",  es: "El sendero empieza junto a la estación"   },
      },
      {
        type: "highlight",
        text: { en: "Ridge walk with unbroken city views",         ko: "능선 코스로 조망이 계속 이어짐", zh: "沿山脊步行，全程开阔视野", ja: "尾根歩きで眺望が続く",      es: "Caminata por cresta con vistas continuas" },
      },
      {
        type: "warning",
        text: { en: "Final summit push is tough for beginners",    ko: "정상 직전 오르막이 초보자에게 어려움", zh: "最后冲顶路段对新手较难", ja: "頂上直前の登りは初心者に厳しい", es: "Tramo final al pico duro para novatos"      },
      },
    ],
  },

  // ── Route 2: Gwanaksan — Gwanak Stream Trail → Sadang Ridge ─────────────────
  {
    id: 2,
    tags: [
      { en: "Most Popular", ko: "대표 코스", zh: "最受欢迎",  ja: "最人気",    es: "Más Popular"     },
      { en: "Gear Rental",  ko: "장비 대여", zh: "装备租赁",  ja: "用具レンタル", es: "Alquiler Equipo" },
      { en: "Valley Walk",  ko: "계곡 코스", zh: "溪谷路线",  ja: "渓谷コース",  es: "Caminata Valle"  },
    ],
    highlights: [
      {
        type: "highlight",
        text: { en: "Trail starts right at station exit",       ko: "역 출구 바로 앞 등산로 시작",  zh: "出地铁口即可直接上山",  ja: "駅出口から即登山道スタート",  es: "Sendero empieza en la salida del metro"      },
      },
      {
        type: "pro_tip",
        text: { en: "Gear rental at Tourism Center",            ko: "관광센터에서 장비 대여 가능",   zh: "旅游中心可租用装备",   ja: "観光センターでレンタル可",   es: "Alquiler de equipo en el Centro Turístico" },
      },
      {
        type: "warning",
        text: { en: "Steep final climb after valley walk",      ko: "막판에 급경사 오르막 구간 있음", zh: "溪谷后接陡峭登顶坡段",  ja: "渓谷後に急坂の登りあり",    es: "Subida empinada al final del valle"          },
      },
    ],
  },

  // ── Route 3: Gwanaksan — Jaunam Ridge → Mushroom Rock Ridge ─────────────────
  {
    id: 3,
    tags: [
      { en: "Best View",      ko: "최고 조망", zh: "最佳景观",  ja: "最高眺望",   es: "Mejor Vista"          },
      { en: "Ridge to Ridge", ko: "능선 종주", zh: "山脊穿越",  ja: "尾根縦走",   es: "Cresta a Cresta"      },
      { en: "Technical Hike", ko: "고급 코스", zh: "进阶徒步",  ja: "上級コース",  es: "Senderismo Técnico"  },
    ],
    highlights: [
      {
        type: "highlight",
        text: { en: "Best panoramic views on Gwanaksan",  ko: "관악산 내 최고의 파노라마 전망", zh: "冠岳山最佳全景视野",    ja: "冠岳山随一のパノラマ眺望",    es: "Las mejores vistas panorámicas en Gwanaksan" },
      },
      {
        type: "pro_tip",
        text: { en: "Bus required; seats at terminus",   ko: "버스 필수, 종점에서 좌석 확보 용이", zh: "需乘巴士，终点站有座位", ja: "バス必須、終点で座席確保可",   es: "Bus obligatorio; asientos en terminal"        },
      },
      {
        type: "warning",
        text: { en: "Many sections need safety railings", ko: "안전 난간 사용 구간 많음",    zh: "多处需借助安全栏杆通行", ja: "安全柵使用区間が多い",       es: "Muchos tramos requieren barandillas"          },
      },
    ],
  },

  // ── Route 5: Ansan — Dongnimmun Station → Hongje Falls ──────────────────────
  {
    id: 5,
    tags: [
      { en: "Family Friendly", ko: "가족 코스",  zh: "亲子友好",  ja: "家族向け",     es: "Apto Familias"      },
      { en: "Sneakers OK",     ko: "운동화 가능", zh: "运动鞋可",  ja: "スニーカーOK", es: "Zapatillas OK"      },
      { en: "Hongje Falls",    ko: "홍제폭포",   zh: "弘济瀑布",  ja: "弘済滝",      es: "Cataratas Hongje"  },
    ],
    highlights: [
      {
        type: "highlight",
        text: { en: "Gentle incline, kids welcome",        ko: "완만한 경사, 아이 동반 가능",  zh: "坡度平缓，适合儿童同行", ja: "緩やかな傾斜、子連れ歓迎",  es: "Pendiente suave, apto para niños"       },
      },
      {
        type: "pro_tip",
        text: { en: "Barrier-free deck loop option",       ko: "무장애 데크길 순환 코스 있음", zh: "可选无障碍步道绕圈路线", ja: "バリアフリーデッキ周回ルートあり", es: "Opción de circuito accesible"          },
      },
      {
        type: "pro_tip",
        text: { en: "Hongje Falls at the descent point",   ko: "하산 지점에 홍제폭포 위치",   zh: "下山途中有弘济瀑布",   ja: "下山地点に弘済滝あり",      es: "Cataratas Hongje al final del descenso" },
      },
    ],
  },

  // ── Route 7: Inwangsan — Seoul City Wall → Suseong-dong Valley ──────────────
  {
    id: 7,
    tags: [
      { en: "City Skyline", ko: "도심 전망",   zh: "首尔全景",  ja: "ソウル夜景",    es: "Panorama Seúl"         },
      { en: "Night Hike",   ko: "야간 산행",   zh: "夜间徒步",  ja: "夜間登山",     es: "Senderismo Nocturno"   },
      { en: "Young Vibe",   ko: "젊은 분위기",  zh: "年轻活力",  ja: "若者向け",     es: "Ambiente Joven"        },
    ],
    highlights: [
      {
        type: "highlight",
        text: { en: "Best Seoul skyline views",               ko: "서울 도심 최고 전망 포인트",   zh: "首尔全景最佳观景地",    ja: "ソウル最高のスカイライン展望",  es: "Las mejores vistas del skyline de Seúl"    },
      },
      {
        type: "pro_tip",
        text: { en: "Night hiking with trail lights",          ko: "야간 조명 설치로 야간 산행 가능", zh: "已安装照明，可夜间登山", ja: "夜間照明完備で夜登山可能",    es: "Senderismo nocturno con luces instaladas"  },
      },
      {
        type: "warning",
        text: { en: "Check GPS near entrance alleys",          ko: "입구 골목에서 GPS 확인 필요",  zh: "入口小巷处需确认GPS路线", ja: "入口付近の路地でGPS確認を",   es: "Verifica GPS en los callejones de entrada" },
      },
    ],
  },
];

// ── Run ────────────────────────────────────────────────────────────────────────

for (const { id, tags, highlights } of UPDATES) {
  const { error } = await db
    .from("routes")
    .update({ tags, highlights })
    .eq("id", id);

  if (error) {
    console.error(`❌ Route ${id}:`, error.message);
  } else {
    console.log(`✅ Route ${id} updated`);
  }
}

console.log("Done.");
