# Safety Engine & Timing Logic

이 문서는 Summit 애플리케이션의 핵심인 안전 산행 가이드라인 및 시간 계산 로직에 대해 설명합니다.

## 1. 안전 산행 가이드라인 (Safety Guidelines)

### 일몰 안전 버퍼 (Sunset Buffer)
사용자의 안전을 위해 모든 산행은 **일몰 시간으로부터 최소 2시간(120분) 전**에 종료되는 것을 기준으로 합니다.
- **설정값**: `SUNSET_BUFFER_MIN = 120`
- **목적**: 예기치 못한 지연이나 일몰 전 급격한 시야 확보 어려움에 대비하기 위함입니다.

### 안전 산행 마감 시간 (Latest Start Time)
지하철역(출구)에서 늦어도 언제 출발해야 안전하게 하산할 수 있는지를 계산합니다.
- **공식**: `마감 시간 = 일몰 시각 - 120분(버퍼) - 총 산행 예상 시간`
- 총 산행 예상 시간은 접근로, 등산로, 하산로, 복귀로의 합계를 의미합니다.

---

## 2. 시간 계산 로직 (ETA Logic)

### 나이스미스 규칙 (Naismith's Rule) 기반 계산
산행 속도는 지형의 고도 변화를 반영하여 다음과 같은 기준 속도를 사용합니다.

- **오르막 (Ascent)**: 평지 기준 약 2.0 km/h (분당 33.3m) + 고도 100m 상승당 10분 가산
- **내리막 (Descent)**: 약 3.2 km/h (분당 53.3m), 고도 가중치 없음
- **정상 휴식 (Summit Rest)**: 정상 도달 후 하산 시작 전까지 기본 **30분**의 휴식 시간을 포함합니다.

### 숙련도 가중치 (Skill Multiplier)
사용자가 설정한 '나의 등산 수준'에 따라 산행 속도가 조절됩니다.
- **범위**: 0.6x (매우 빠름) ~ 1.5x (매우 느림)
- 이 가중치는 순수 산행 구간(등산/하산)의 소요 시간에만 곱해집니다. (접근로/복귀로 제외)

---

## 3. 표시 모드별 작동 방식

### 등산 전 (Pre-hike / Preview)
사용자가 산행을 계획하는 단계에서는 '지금 출발' 기준이 아닌 **'안전 산행 마감 시간'에 출발했을 때**의 시나리오를 보여줍니다.
- **표시 내용**:
  - 마감 시간 (Last Safe Start)
  - 정상 도착 예정 (Summit ETA)
  - 역 도착 예정 (Station ETA, 일몰 2시간 전 고정)

### 등산 중 (Active Hiking)
산행이 시작되면 사용자의 **현재 시각과 실시간 GPS 위치**를 기반으로 남은 거리를 계산하여 업데이트합니다.
- **표시 내용**:
  - 상행 시: 정상 도착 예정, 역 도착 예정
  - 하행 시: 입구 도착 예정(Trailhead), 역 도착 예정

---

---

## 4. Start Hiking 플로우

"Start Hiking" 버튼을 눌렀을 때 현재 위치와 등산로 입구(trailhead)까지의 거리를 먼저 확인합니다.

### 거리 기준
- **경계**: `TRAILHEAD_ACTIVE_M = 500 m`

### Case 1 — 입구에서 500 m 초과 (멀리 있음)
확인 팝업을 표시합니다.
- "Start Anyway": 바로 산행 시작 (GPS 추적 활성화)
- "Cancel": 팝업 닫기

### Case 2 — 입구에서 500 m 이내 (가까이 있음)
Bottom sheet 안에 **경로 이탈 알림 토글**을 inline으로 표시합니다.
- 토글 상태를 확인하고 "Start Hiking"을 눌러 산행을 시작합니다.
- 설정은 `localStorage`(`off-route-alert-enabled` 키)에 저장되어 다음 실행에도 유지됩니다.

### GPS 위치를 얻지 못한 경우
`navigator.geolocation.getCurrentPosition` 오류 또는 권한 거부 시 거리 체크 없이 바로 산행을 시작합니다.

---

## 5. 경로 이탈 알림 (Off-route Alert)

### 설정
- **임계 거리**: `useOffRouteSettings`의 `threshold` (기본 30 m, 범위 20–100 m)
- **활성화 여부**: `useOffRouteSettings`의 `enabled` (기본 `true`)
  - `localStorage` 키: `off-route-alert-enabled`

### 활성 조건
`isHiking === true && hikingMode === "active" && offRouteEnabled === true`

### 지도 토글 버튼
산행 중 지도 우측 나침반 버튼 위에 벨 아이콘 버튼이 표시됩니다.
- 활성: `ph:bell-ringing` (primary 색)
- 비활성: `ph:bell-slash` (회색)

---

## 6. 관련 코드 위치
- 시간 계산 엔진: `src/lib/safetyEngine.ts`
- Start Hiking 플로우 · 실시간 계산: `src/components/ui/TrailSection.tsx`
- Off-route 설정: `src/lib/useOffRouteSettings.ts`
- UI 표시 (ETA): `src/components/ui/FloatingTrailHeader.tsx`
- Bottom sheet (Start 플로우 UI): `src/components/ui/HikingBottomSheet.tsx`
- 지도 토글 버튼: `src/components/ui/MapView.tsx`
