# 관리자 코스 등록 가이드

Summit 앱의 관리자 화면에서 등산 코스를 등록하고 관리하는 방법을 설명합니다.

---

## 신규 코스 등록: Guided Wizard (`/admin/new-route`)

Admin 홈(`/admin`) 상단의 **"Create New Route (Guided Wizard)"** 버튼으로 진입합니다.

### 전체 흐름 (7단계)

```
1. 산 선택 → 2. GPS → 3. 사진 → 4. 지점 → 5. 구간 → 6. 캡션 → 7. 저장
```

---

### 1단계: 산 선택

드롭다운에서 산을 선택합니다.

---

### 2단계: GPS 파일 업로드

전체 등산 코스를 **하나의** GPX 또는 GeoJSON 파일로 올립니다.

- 역 출발 → 정상 → 역 도착까지 전 구간을 하나로 기록한 파일이어야 합니다.
- 구간별 분리는 Step 4에서 웨이포인트 기준으로 자동 처리됩니다.
- 업로드 시 포인트 수·총 거리가 미리 표시됩니다.

---

### 3단계: 사진 업로드 + 웨이포인트 태깅

등산 중 찍은 사진을 한 번에 모두 업로드합니다.

**자동 처리:**
- EXIF GPS 추출
- WebP 변환 (가로 최대 1200px)

**웨이포인트 태깅:**
각 사진 아래의 드롭다운에서 지점 유형을 선택합니다.
EXIF GPS가 있는 사진을 태깅하면, 다음 단계에서 좌표가 자동으로 채워집니다.

| 유형 | 언제 사용 |
|---|---|
| 역 (Station) | 출발·도착 지하철역 |
| 버스 정류장 (Bus Stop) | 버스 환승 지점 |
| 등산로 입구 (Trailhead) | 산행 시작·종료 지점 |
| 정상 (Summit) | 최고점 |
| 갈림길 (Junction) | 분기점 |

태깅한 사진 수는 하단에 표시됩니다. GPS가 없는 사진을 태깅한 경우 Step 4에서 좌표를 수동 입력합니다.

---

### 4단계: 지점 확인 및 이름 입력

Step 3에서 태깅된 사진이 웨이포인트 슬롯으로 **자동 변환**됩니다.
GPS 좌표는 이미 채워져 있으며, **이름(KO/EN)만 입력하면 됩니다.**

#### 일반적인 웨이포인트 순서
```
출발역 → [버스 정류장] → 상행 등산로 입구 → 정상 → 하행 등산로 입구 → [버스 정류장] → 도착역
```
버스가 없는 경우 버스 정류장은 생략합니다.

#### 웨이포인트 등록 방법

**① 자동 (권장)** — Step 3 사진 태깅으로 슬롯이 미리 생성됩니다.
이름만 입력하면 됩니다.

**② 기존 웨이포인트 선택** — "Existing" 탭에서 해당 산에 등록된 웨이포인트를 선택합니다.

**③ 수동 등록** — "New waypoint" 탭에서 직접 입력합니다.
GPS가 없는 경우 "Pick a photo"로 사진에서 좌표를 가져오거나 직접 입력합니다.

#### 유형별 추가 입력 항목

| 유형 | 추가 항목 |
|---|---|
| Station | 지하철 노선, 역 이름(KO/EN), 출구 번호 |
| Bus Stop | ARS ID, 버스 번호, 버스 색상(간선/지선/광역/순환), 탑승 소요시간(분) |
| Trailhead / Summit / Junction | 없음 (기본 정보만) |

#### 저장 시 자동 처리

GPS 트랙이 각 웨이포인트 좌표 기준으로 **자동 분리**되며 Segment 타입이 추론됩니다.

| 웨이포인트 연결 패턴 | Segment 타입 |
|---|---|
| Station → Trailhead | APPROACH |
| Station → **Bus Stop** → Trailhead | APPROACH (버스 복합) |
| Trailhead → Summit | ASCENT |
| Summit → Trailhead | DESCENT |
| Trailhead → Station | RETURN |
| Trailhead → **Bus Stop** → Station | RETURN (버스 복합) |

버스 복합 Segment: `bus_track_data` = 역→버스정류장(버스), `track_data` = 버스정류장→등산로 입구(도보)

---

### 5단계: 구간 확인

자동 추론된 구간(Segment) 목록이 표시됩니다.
소요 시간은 Naismith 공식(경사 보정)으로 계산됩니다. 실제 표지판 기준으로 직접 수정 가능합니다.

---

### 6단계: 사진 캡션 (선택)

업로드된 사진 각각에 KO/EN 설명을 입력합니다.
건너뛰어도 됩니다. 저장 후 기존 Photo Upload 카드에서 편집할 수 있습니다.

---

### 7단계: 코스 저장

입력 항목:
- **코스 이름 (KO/EN)**
- **난이도 (1–5)**
- 설명, 태그, 하이라이트 (선택)

저장 순서:
1. 신규 웨이포인트 생성 → Segment 분리 생성 → Route 생성 (`POST /api/admin/create-route`)
2. 사진 업로드 + GPS 기반 Segment 자동 매핑 (`POST /api/admin/route-photos`)

---

## 기존 데이터 수정: 개별 카드 (`/admin`)

기존 웨이포인트·구간·코스를 편집하거나 내용을 추가할 때 사용합니다.

| 카드 | 역할 |
|---|---|
| Manage Waypoints | 웨이포인트 CRUD (산 선택 → 목록 확인·추가·수정·삭제) |
| Upload Segment | 구간 GPX 업로드·수정·삭제. 버스+도보 복합 경로 지원 |
| Build Route | 구간 조합으로 코스 구성. 이름·순서·방향 설정 |
| Route Edit | 태그·설명·하이라이트 수정. GPS 트랙 교체(오류 수정용) |
| Photo Upload | 사진 추가 업로드, 캡션 편집 |
| Translation Sync | 번역 동기화 |

---

## 기술 참조

### 데이터베이스 테이블 (Supabase)

| 테이블 | 설명 |
|---|---|
| `mountains` | 산 기본 정보 |
| `waypoints` | 5종 타입 지점. `ars_id`는 버스 정류장용 |
| `segments` | `is_bus_combined = true`이면 `bus_details.bus_track_data`에 버스 GPS 보관 |
| `routes` | `segment_ids` 배열로 구간 순서 참조 |
| `route_photos` | `route_id`(필수), `segment_id`(선택), GPS, URL, 설명, `order_index` |

### API 엔드포인트

#### 위저드용

| Method | Endpoint | 설명 |
|---|---|---|
| `POST` | `/api/admin/create-route` | 웨이포인트 생성 + GPS 자동 분리 + Segment + Route 원자적 생성 |

**Request body (JSON):**
```json
{
  "mountainId": 1,
  "routeNameEn": "Bukhansan Baegundae Beginner",
  "routeNameKo": "북한산 백운대 초보 코스",
  "routeDifficulty": 3,
  "trackPoints": [[lon, lat, ele], "..."],
  "waypointSpecs": [
    { "existingId": 42 },
    {
      "nameEn": "Dobong Bus Stop",
      "nameKo": "도봉 버스정류장",
      "type": "BUS_STOP",
      "lat": 37.689,
      "lon": 127.047,
      "arsId": "22194",
      "busNumbers": "704",
      "busColor": "#0068B7",
      "busDurationMin": 20
    }
  ]
}
```

**Response:**
```json
{ "routeId": 7, "segmentIds": [12, 13, 14, 15] }
```

#### 기존 CRUD

| Method | Endpoint | 설명 |
|---|---|---|
| `GET/POST/PATCH/DELETE` | `/api/admin/waypoints` | 웨이포인트 CRUD |
| `GET/POST/PATCH/DELETE` | `/api/admin/segments` | 구간 CRUD + GPX 파싱 |
| `GET/POST/PATCH/DELETE` | `/api/admin/routes` | 코스 CRUD |
| `GET/POST/PATCH/DELETE` | `/api/admin/route-photos` | 사진 업로드 / 설명 수정 / 삭제 |

### bus_details JSONB 구조

```json
{
  "bus_stop_id_key": "42",
  "bus_numbers":     ["704", "34"],
  "route_color":     "#0068B7",
  "bus_track_data":  { "type": "LineString", "coordinates": [[lon, lat, ele], "..."] },
  "bus_duration_min": 20
}
```

### Segment 슬러그 규칙

`{mountain}-{direction}-{type}-{start}-{end}`

예: `bukhansan-go-apr-dobongsan-station-dobong-trailhead`

### 사진 GPS 매핑 규칙

| 조건 | 처리 |
|---|---|
| GPS 있음 + 경로 100m 이내 | 해당 Segment에 자동 매핑 |
| GPS 있음 + 경로 100m 초과 | Segment 미지정 — 드롭다운으로 수동 선택 |
| GPS 없음 | Segment 미지정 — 드롭다운으로 수동 선택 |

### 마이그레이션 파일 위치

`supabase/migrations/` 아래 날짜순 정렬. 주요 파일:
- `20260402_redesign_schema.sql` — 4-테이블 구조
- `20260411_bus_tracking.sql` — is_bus_combined, bus_details
- `20260414_add_route_photos.sql` — route_photos 테이블
