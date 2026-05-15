# 타이포그래피 & 라운드 UI 개선

**테마:** Nunito Round UI  
**컨셉:** 지하철 타고 떠나는 가벼운 산행 — 지하철역을 나서는 순간부터 가볍고, 친근하며, 누구나 도전할 수 있는 느낌

---

## 1. 폰트 전략

### Nunito를 선택한 이유

Inter(이전 기본 폰트)는 중립적이고 기술적인 느낌으로 생산성 도구에 적합하지만, 레저 하이킹 앱에는 다소 차갑게 느껴질 수 있습니다. Nunito의 둥근 끝 처리(rounded terminals)는 각 글자에 더 친근한 실루엣을 부여하여 "할 수 있을 것 같다, 부담스럽지 않다"는 심리적 신호를 줍니다.

### 폰트 스택

| 변수 | 스택 | 용도 |
|---|---|---|
| `--font-en` | Nunito → Noto Sans KR → Noto Sans JP → system-ui | 모든 UI 텍스트 |
| `--font-ko` | Pretendard → Noto Sans KR → Nunito → system-ui | 한국어 보조 레이블 |
| `--font-num` | Nunito → system-ui | 숫자 데이터 전용 |

### 로딩 전략 — 선택적 서브셋 로딩

CJK 폰트는 용량이 큽니다 (Noto Sans JP 서브셋 미적용 시 약 2 MB). 사용자의 언어 설정에 따라 필요한 폰트만 로드합니다.

| 폰트 | 로드 시점 | 방식 |
|---|---|---|
| **Nunito** | 항상 | `next/font/google` — 자체 호스팅, 레이아웃 이동 없음 |
| **Noto Sans KR** | 항상 | `globals.css`에 정적 `@import` — UI 로케일과 무관하게 모든 등산로 표지판에 한국어 표시 |
| **Noto Sans JP** | UI 로케일이 `ja`일 때만 | `FontLoader` 컴포넌트가 동적으로 `<link>` 삽입 |
| **Noto Sans SC** | UI 로케일이 `zh`일 때만 | `FontLoader` 컴포넌트가 동적으로 `<link>` 삽입 |
| **Pretendard** | 항상 | `globals.css`에 CDN `@import` |

**`FontLoader` 컴포넌트** (`src/components/ui/FontLoader.tsx`):
- 마운트 시 `localStorage`에서 로케일을 읽음
- `useLanguage`가 dispatch하는 `language-change` 커스텀 이벤트를 수신
- `document.head`에 `<link id="dynamic-cjk-font">` 하나를 삽입/제거
- `en`, `ko`, `es` → 동적 링크 제거 (추가 폰트 불필요)
- `ja` → Noto Sans JP 스타일시트 삽입
- `zh` → Noto Sans SC 스타일시트 삽입

Google Fonts CSS API가 unicode-range 서브셋을 자동으로 처리하므로, 실제로 렌더링되는 글리프 블록만 다운로드됩니다.

### CJK 자간 조정

`.font-ko`는 `letter-spacing: 0.015em`을 추가합니다. 한국어·일본어 문자는 라틴 문자보다 자연스럽게 더 촘촘하게 붙기 때문에, 이 약간의 확장으로 Nunito의 넉넉한 느낌에 맞추고 혼합 언어 텍스트의 불균형을 방지합니다.

---

## 2. 숫자 데이터 규칙

거리, 시간, 고도 등 모든 통계 수치는 `font-num` 클래스(또는 `fontFamily: "var(--font-num)"`)를 사용해야 합니다:

```
7.1 km   →  font-num
3h 40m   →  font-num
632 m    →  font-num
11:30 AM →  font-num
```

**심리적 근거:** Nunito의 둥근 숫자는 수치를 덜 부담스럽게 만듭니다. "4h 30m" 이라는 산행 시간이 친근한 둥근 폰트로 표시되면 *할 수 있을 것 같다*는 느낌을 주지만, 날카로운 기하학적 폰트로 표시하면 벽처럼 느껴질 수 있습니다. 이는 앱의 "지하철에서 정상까지" 접근성 철학에 맞춘 의도적인 UX 선택입니다.

### 적용 위치

| 파일 | 적용 대상 |
|---|---|
| `src/app/(shell)/page.tsx` | 소요시간 칩, 마감 출발 시간, 고도 오버레이 |
| `src/components/ui/RouteCard.tsx` | InfoChip(거리/시간), 안전 배너 시간, 마감 출발 시간 |

---

## 3. 라운드 UI 테마

### 반지름 토큰

| 토큰 | 변경 전 | 변경 후 | 적용 요소 |
|---|---|---|---|
| `--radius-card` | `0.75rem` (12px) | `1rem` (16px) | 모든 카드 |
| `--radius-chip` | — | `9999px` | 태그 필, 정보 칩 |
| `--radius-btn` | — | `9999px` | CTA 버튼 |

`rounded-[var(--radius-card)]`를 사용하는 기존 컴포넌트는 업데이트된 값을 자동으로 상속합니다. `rounded-full`(필/칩)을 사용하는 컴포넌트는 이미 `--radius-chip`과 일치합니다.

### 일관성 규칙

모든 신규 카드는 `rounded-[var(--radius-card)]`를 사용해야 합니다. 모든 신규 칩/태그는 `rounded-full` 또는 `rounded-[var(--radius-chip)]`을 사용해야 합니다. 픽셀 반지름을 하드코딩하지 마세요.

---

## 4. 헤더 내비게이션

### 맥락 감지 헤더

`Header` 컴포넌트 (`src/components/layout/Header.tsx`)는 `usePathname()`을 읽어 두 가지 모드로 렌더링합니다:

| 맥락 | 렌더링 |
|---|---|
| `/` (홈) | 산 아이콘 + "Seoul Subway to Summit" — 브랜드 풀 표시 |
| `/route/*` | `‹ Mountains` 슬림 링크 — 공간 효율적, 뒤로 이동 중심 |

**근거:** 홈 화면에서는 브랜드 로고를 눈에 띄게 배치해야 합니다 (첫인상에서 신뢰 형성). 루트 뷰 내부에서 사용자는 이미 진입을 결정한 상태이므로, 화면 공간을 루트 이름과 지도에 활용하는 것이 낫습니다. 슬림 헤더는 산행 중 인지 부하를 줄여줍니다.

---

## 5. 변경된 파일

| 파일 | 변경 내용 |
|---|---|
| `src/app/globals.css` | Noto Sans KR 정적 import 추가 (JP는 제거 — 이제 동적 로드); 폰트 토큰 업데이트; `--radius-card` 값 상향; `--radius-chip`, `--radius-btn` 추가; `.font-num` 및 `.font-ko` 자간 유틸리티 추가 |
| `src/app/layout.tsx` | `Inter` → `Nunito`(next/font)로 교체, 변수명 `--font-nunito`; `FontLoader` 추가 |
| `src/components/ui/FontLoader.tsx` | 신규 — 동적 CJK 폰트 삽입 (`ja`에는 JP, `zh`에는 SC) |
| `src/components/ui/index.ts` | `FontLoader` re-export 추가 |
| `src/app/(shell)/page.tsx` | 고도 통계, 소요시간, 마감 출발 시간에 `font-num` 적용 |
| `src/components/ui/RouteCard.tsx` | InfoChip, 안전 배너 시간에 `font-num` 적용 |
| `CLAUDE.md` | 폰트 섹션, 디자인 토큰 반지름 표, 헤더 동작 표 업데이트 |
