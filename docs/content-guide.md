# 콘텐츠 작성 가이드 (Highlights · Tags)

Admin 화면에서 루트 데이터를 입력할 때, 그리고 AI로 번역할 때 따르는 기준입니다.

---

## 1. Highlights

### 표시 방식

카드에 최대 3개 표시됩니다. 아이콘 + 텍스트 한 줄로 표현됩니다.

| Type | 아이콘 | 의미 |
|---|---|---|
| `highlight` | ● (초록) | 이 루트만의 장점·특징 |
| `pro_tip` | ★ (파랑) | 현장 팁, 미리 알아두면 유용한 정보 |
| `warning` | ⚠ (빨강) | 난이도·체력·시간 관련 주의 |

### 글자 수 제한

| 언어 | 권장 | 절대 한도 |
|---|---|---|
| English (`en`) | ≤ 35자 | 40자 |
| 한국어 (`ko`) | ≤ 18자 | 22자 |

모바일 카드 기준 1줄 내로 끝나야 합니다.

### 작성 규칙

- **마침표 없음** — 단편적 정보로 표현 (`Gear rental at Tourism Center`, not `...Center.`)
- **관사(a/the) 생략** — `Best access from Sadang`, not `The best access...`
- **수치는 항상 포함** — `15 min walk from exit 5`, not `Short walk from exit`
- **부정형 금지** — `warning`으로 표현하되, `No …` 문장은 피함
- **1 루트당 최대 3개** — `highlight` 2개 + `pro_tip` 1개가 일반적인 구성

### 좋은 예 / 나쁜 예

| Type | ❌ 나쁜 예 | ✅ 좋은 예 |
|---|---|---|
| highlight | `The most popular route on this mountain` (38자, 관사 포함) | `Most popular route on this mountain` (36자) |
| highlight | `Hiking starts immediately after exiting the station` (52자) | `Trail starts right at exit 3` (29자) |
| pro_tip | `Gear rental available at the Tourism Center` (44자) | `Gear rental at Tourism Center` (30자) |
| warning | `Long flat valley trail followed by a steep final climb` (55자) | `Steep final climb after valley walk` (36자) |
| warning | `Descent toward Sadang requires intermediate stamina.` (53자, 마침표) | `Sadang descent needs solid stamina` (35자) |

---

## 2. Tags

### 표시 방식

컴포넌트가 `#`을 자동으로 앞에 붙입니다. **데이터에 `#`을 넣지 마세요.**

```
❌ DB에 저장: "#Most_Popular"  →  화면: "##Most_Popular"
✅ DB에 저장: "Most Popular"   →  화면: "#Most Popular"
```

### 형식 규칙

- **Title Case + 공백** — `Most Popular`, `Gear Rental`, `Valley Walk`
- **언더스코어 금지** — `Most_Popular` (X)
- **1 루트당 최대 4개**
- **2단어 이내**

### 권장 태그 목록

| 태그 (en) | 태그 (ko) | 설명 |
|---|---|---|
| `Most Popular` | `인기 코스` | 조회수·추천수 상위 |
| `Gear Rental` | `장비 대여` | 현장 장비 대여 가능 |
| `Valley Walk` | `계곡 코스` | 계곡을 따라 걷는 구간 포함 |
| `Family Friendly` | `가족 코스` | 어린이 동반 가능 난이도 |
| `One Way` | `편도 코스` | 출발역 ≠ 도착역 |
| `Waterfall` | `폭포` | 폭포 경유 |
| `City View` | `시내 전망` | 정상에서 서울 전경 조망 |
| `Night Hike` | `야간 가능` | 야간 산행 허가 구간 |
| `Ridge Walk` | `능선 코스` | 능선 구간 포함 |
| `Temple` | `사찰 경유` | 사찰·문화재 경유 |

새 태그가 필요한 경우 이 테이블에 추가하고 일관되게 사용합니다.

---

## 3. AI 번역 지침 (EN → KO)

### 핵심 제약

1. **글자 수 우선** — 의미가 완전하지 않아도 22자를 넘으면 줄여야 합니다.
2. **조사·어미 생략** — 자연스러운 한국어보다 간결함 우선
3. **존댓말 금지** — `~합니다/~세요` 형태 사용 안 함. 명사 또는 짧은 서술형 (`~함`, `~있음`)

### 번역 패턴

| 영어 패턴 | 한국어 패턴 | 예 |
|---|---|---|
| `[장소] at [위치]` | `[위치] [장소]` | `Gear rental at Tourism Center` → `관광 안내소 장비 대여` |
| `[형용사] [명사]` | `[형용사] [명사]` | `Steep final climb` → `급경사 마지막 오르막` |
| `[주어] starts/begins at [위치]` | `[위치]부터 시작` | `Trail starts right at exit 3` → `3번 출구 바로 앞 시작` |
| `[주어] requires [명사]` | `[명사] 필요` | `Needs solid stamina` → `체력 필요` |
| `Most popular [명사]` | `인기 [명사]` | `Most popular route` → `인기 코스` |

### 번역 전 체크리스트

```
□ 영어 원문이 40자 이하인지 확인 (초과면 영어 먼저 줄이기)
□ 한국어 번역이 22자 이하인지 확인
□ 마침표 없는지 확인
□ 존댓말 없는지 확인
□ 아래 용어 사전 참조했는지 확인
```

### 등산 용어 사전

| English | Korean | 비고 |
|---|---|---|
| Trail / Route | 등산로 / 코스 | 문맥에 따라 구분 |
| Trailhead | 등산로 입구 | |
| Summit / Peak | 정상 | |
| Ridge | 능선 | |
| Valley | 계곡 | |
| Descent | 하산 | |
| Ascent / Climb | 오르막 / 등반 | |
| Stamina / Fitness | 체력 | |
| Exit (subway) | 출구 | `Exit 3` → `3번 출구` |
| Gear rental | 장비 대여 | |
| Tourism Center | 관광 안내소 | 현장 명칭 우선 |
| Rest area | 쉼터 | |
