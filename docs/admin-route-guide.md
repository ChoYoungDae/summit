# 관리자 경로 설정 가이드 (Admin Route Configuration Guide)

이 문서는 Summit 애플리케이션의 관리자 화면에서 등산 코스를 등록하고 관리하는 방법을 설명합니다.

---

## ✨ 신규: Guided Wizard (`/admin/new-route`)

기존 4단계 수동 작업 대신, **가이드 위저드**에서 한 번에 루트를 완성할 수 있습니다.
Admin 홈(`/admin`) 상단의 **"Create New Route (Guided Wizard)"** 버튼으로 진입합니다.

### 전체 흐름 (6단계)

```
1. Mountain  →  2. GPS  →  3. Photos  →  4. Waypoints  →  5. Captions  →  6. Save
```

---

### 1단계: 산 선택
드롭다운에서 산을 선택합니다. (변경 없음)

---

### 2단계: GPS 파일 업로드

**구간별 분리 없이**, 전체 등산 코스 하나의 GPX 또는 GeoJSON 파일을 올립니다.
- 역 출발 → 정상 → 역 도착까지 전체를 하나로 기록한 파일이어야 합니다.
- 업로드 시 포인트 수와 총 거리가 미리 표시됩니다.

---

### 3단계: 사진 업로드

등산 중 찍은 사진을 한 번에 모두 업로드합니다.
- 클라이언트에서 자동으로 EXIF GPS 추출 + WebP 변환 + 가로 최대 1200px 리사이즈
- GPS 좌표가 있는 사진에는 "GPS" 뱃지 표시
- 사진은 나중에 Step 5에서 설명을 입력하거나 삭제할 수 있습니다.

---

### 4단계: Waypoint 지정

GPS 트랙의 자동 분리 기준점이 되는 Waypoint를 **순서대로** 추가합니다.

#### 추가 순서 (일반적인 경우)
```
출발역 → [버스 정류장] → 상행 트레일헤드 → 정상 → 하행 트레일헤드 → [버스 정류장] → 도착역
```
버스가 없는 경우 버스 정류장은 생략합니다.

#### Waypoint 등록 방법 — 2가지

**① 이 산에 기존 등록된 Waypoint 선택**
- "Existing" 탭 선택 후 드롭다운에서 고릅니다.
- 해당 산에 등록된 Waypoint 목록이 자동으로 표시됩니다.

**② 새로 등록**
- "New waypoint" 탭 선택
- **사진에서 GPS 좌표 추출**: "Pick a photo" 버튼으로 Step 3에서 올린 사진 중 해당 지점에서 찍은 사진을 선택하면 EXIF GPS가 좌표 필드에 자동 입력됩니다.
- EXIF GPS가 없는 경우 좌표를 직접 입력합니다.
- 타입, 이름(EN/KO), 고도를 입력합니다.

#### 타입별 추가 입력 항목

| 타입 | 추가 항목 |
|---|---|
| Station | 지하철 노선, 역 이름, 출구 번호 |
| Bus Stop | ARS ID, 버스 번호, 버스 색상(간선/지선/광역/순환), 탑승 소요시간(분) |
| Trailhead / Summit / Junction / Shelter | 없음 (기본 정보만) |

#### 저장 시 자동 처리
- GPS 트랙이 각 Waypoint 좌표를 기준으로 **자동 분리**됩니다.
- 출발역·도착역 바깥 구간은 자동으로 제거됩니다.
- Segment 타입이 자동 추론됩니다:

| Waypoint 연결 패턴 | Segment 타입 |
|---|---|
| Station → Trailhead | APPROACH |
| Station → **Bus Stop** → Trailhead | APPROACH (is_bus_combined = true) |
| Trailhead → Summit | ASCENT |
| Summit → Trailhead | DESCENT |
| Trailhead → Station | RETURN |
| Trailhead → **Bus Stop** → Station | RETURN (is_bus_combined = true) |

버스 복합 Segment의 경우:
- **bus_track_data** = Station→Bus Stop 구간 (버스 이동)
- **track_data** = Bus Stop→Trailhead 구간 (도보 이동)

---

### 5단계: 사진 캡션 (선택)

업로드된 사진 각각에 EN/KO 설명을 입력합니다.
- 이 단계는 건너뛰어도 됩니다. 저장 후 기존 Photo Upload 카드에서 편집 가능합니다.

---

### 6단계: 루트 저장

- **Route 이름 (EN/KO)**
- **난이도 (1–5)** 선택
- "Create Route" 버튼 클릭

저장 순서:
1. 신규 Waypoint 생성 → Segment 분리 생성 → Route 생성 (`POST /api/admin/create-route`)
2. 사진 업로드 + GPS 기반 Segment 자동 매핑 (`POST /api/admin/route-photos`)

---

## 🛠 기존 방식: 수동 4단계 (`/admin`)

개별 Waypoint / Segment / Route 를 직접 편집하거나 기존 루트를 수정할 때 사용합니다.

### Step 1: 거점 관리 (Manage Waypoints)
- 타입: STATION, BUS_STOP, TRAILHEAD, SUMMIT, JUNCTION, SHELTER
- EXIF가 있는 사진 업로드 시 위도/경도 자동 입력

### Step 2: 구간 업로드 (Upload Segment)
- GPX / GeoJSON 파일을 구간별로 업로드
- 버스+도보 복합 경로: "Add Bus Route" 체크 → 버스 GPS / 도보 GPS 각각 업로드

### Step 3: 루트 빌더 (Build Route)
- 구간들을 순서대로 조합 (`Approach → Ascent → Descent → Return`)
- 거리·시간·난이도 자동 합산

### Step 4: 사진 업로드 (Photo Upload)
- EXIF GPS 기반 100m 이내 Segment 자동 매핑
- 설명 입력, 순서 조정, 삭제

---

## 💾 기술 참조 (Technical Reference)

### 데이터베이스 테이블 (Supabase)

| 테이블 | 설명 |
|---|---|
| `mountains` | 산의 기본 정보 |
| `waypoints` | 7종 타입 지점 정보. `ars_id`는 버스 정류장용 |
| `segments` | `is_bus_combined = true`이면 `bus_details.bus_track_data`에 버스 GPS 보관 |
| `routes` | `segment_ids` 배열로 구간 순서 참조 |
| `route_photos` | `route_id`(필수), `segment_id`(선택), GPS, URL, 설명, `order_index` |

### API 엔드포인트

#### 신규 위저드용

| Method | Endpoint | 설명 |
|---|---|---|
| `POST` | `/api/admin/create-route` | Waypoint 생성 + GPS 자동 분리 + Segment + Route 원자적 생성 |

**Request body (JSON):**
```json
{
  "mountainId": 1,
  "routeNameEn": "Bukhansan Baegundae Beginner",
  "routeNameKo": "북한산 백운대 초보 코스",
  "routeDifficulty": 3,
  "trackPoints": [[lon, lat, ele], ...],
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
| `GET/POST/PATCH/DELETE` | `/api/admin/waypoints` | Waypoint CRUD |
| `GET/POST/PATCH/DELETE` | `/api/admin/segments` | Segment CRUD + GPX 파싱 |
| `GET/POST/PATCH/DELETE` | `/api/admin/routes` | Route CRUD |
| `GET/POST/PATCH/DELETE` | `/api/admin/route-photos` | 사진 업로드 / 설명 수정 / 삭제 |

### bus_details JSONB 구조

```json
{
  "bus_stop_id_key": "42",
  "bus_numbers":     ["704", "34"],
  "route_color":     "#0068B7",
  "bus_track_data":  { "type": "LineString", "coordinates": [[lon, lat, ele], ...] },
  "bus_duration_min": 20
}
```

### Segment 슬러그 규칙

`{mountain}-{direction}-{type}-{start}-{end}`

예: `bukhansan-go-apr-dobongsan-station-dobong-trailhead`

### 사진 GPS 매핑 규칙

| 조건 | 처리 |
|---|---|
| GPS 있음 + 경로 100m 이내 | 해당 Segment에 자동 매핑 (green "auto-mapped") |
| GPS 있음 + 경로 100m 초과 | Segment 미지정 — 드롭다운으로 수동 선택 |
| GPS 없음 | Segment 미지정 — 드롭다운으로 수동 선택 |

### 마이그레이션 파일 위치

`supabase/migrations/` 아래 날짜순 정렬. 주요 파일:
- `20260402_redesign_schema.sql` — 4-테이블 구조
- `20260411_bus_tracking.sql` — is_bus_combined, bus_details
- `20260414_add_route_photos.sql` — route_photos 테이블
