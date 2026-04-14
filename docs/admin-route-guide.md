# 관리자 경로 설정 가이드 (Admin Route Configuration Guide)

이 문서는 Summit 애플리케이션의 관리자 화면에서 등산로 및 교통 거점을 등록하고 관리하는 방법을 설명합니다. 특히 최근 업데이트된 **버스+도보 복합 경로** 설정법을 중점적으로 다룹니다.

## 📌 전체 프로세스 요약
전체 데이터 구축은 다음의 4단계로 이루어집니다.

1.  **거점(Waypoints) 등록**: 산의 핵심 지점(지하철역, 버스정류장, 입구, 정상 등)을 생성합니다.
2.  **구간(Segments) 업로드**: 두 거점 사이의 실제 GPS 경로(GPX/GeoJSON)를 업로드합니다.
3.  **루트(Routes) 구성**: 업로드된 구간들을 순서대로 조합하여 최종 등산 코스를 완성합니다.
4.  **사진(Photos) 업로드**: 루트에 풍경 사진을 추가하여 지도와 고도 그래프에 카메라 마커로 표시합니다.

---

## 🏗️ 1단계: 거점 관리 (Manage Waypoints)

등산로의 시작, 경유, 끝이 되는 지점들을 정의합니다.

### 지원 타입
-   **Station**: 지하철역. (출구 번호 입력 가능)
-   **Bus Stop (신규)**: 버스 정류장. (ARS ID 고유번호 입력 가능)
-   **Trailhead**: 등산로 입구.
-   **Summit**: 산 정상.
-   **Junction**: 갈림길.
-   **Shelter**: 대피소.

### 주요 입력 사항
-   **Name (EN/KO)**: 영문명과 국문명.
-   **Slug**: 시스템 내부 식별자 (영문명 기반 자동 생성 권장).
-   **Photo**: 해당 지점의 대표 이미지. (EXIF 정보가 있는 사진 업로드 시 위도/경도가 자동 입력됩니다.)
-   **GPS Info**: 위도(Lat), 경도(Lon), 고도(Elevation).

---

## 🛤️ 2단계: 구간 업로드 (Upload Segment)

두 거점을 잇는 물리적 이동 경로를 설정합니다.

### 구간 타입 (Segment Type)
-   **Approach**: 역/정류장에서 등산로 입구까지의 접근로.
-   **Ascent**: 입구에서 정상까지의 등라로.
-   **Descent**: 정상에서 하산 지점까지의 하산로.
-   **Return**: 하산 지점에서 다시 역/정류장으로 돌아가는 길.

### 🚌 버스+도보 복합 경로 (Bus + Walk Hybrid)
`Approach` 또는 `Return` 타입에서 버스 환승이 필요한 경우 사용합니다.

1.  **Add Bus Route 체크**: 복합 경로 입력 폼이 활성화됩니다.
2.  **3점 연결 구조**:
    -   **Start**: 출발 지점 (예: 지하철역)
    -   **Transit**: 경유 지점 (예: 버스 정류장)
    -   **End**: 도착 지점 (예: 등산로 입구)
3.  **버스 정보 입력**:
    -   **Bus Type**: 간선(Blue), 지선/마을(Green), 광역(Red), 순환(Yellow) 선택. 지도의 실선 색상에 반영됩니다.
    -   **Bus Number**: 버스 번호 직접 입력 (예: 704, 서대문03).
4.  **GPS 파일 분리 업로드**:
    -   **Bus GPS**: 버스가 이동하는 구간의 GPX 파일.
    -   **Walk GPS**: 정류장에서 내려서 걷는 구간의 GPX 파일.
    -   *시스템이 두 파일을 합쳐서 `bus_details` 데이터로 저장합니다.*

---

## 🗺️ 3단계: 루트 빌더 (Build Route)

최종적으로 사용자에게 노출될 등산 코스를 조립합니다.

1.  **이름 설정**: 루트의 제목 (예: "북한산 백운대 초보 코스").
2.  **구간 선택**: 해당 산에 등록된 구간들을 순서대로 추가합니다.
3.  **순서 조정**: 리스트의 화살표 버튼을 이용해 `Approach -> Ascent -> Descent -> Return` 순서를 맞춥니다.
4.  **자동 계산**: 선택된 구간들의 거리, 소요 시간, 난이도가 합산되어 루트 정보로 저장됩니다.

---

## 📸 4단계: 사진 업로드 (Photo Upload)

루트의 풍경 사진을 업로드하면 지도와 고도 그래프에 카메라 아이콘으로 표시되며, 하이커가 탭하면 사진과 설명 팝업이 열립니다.

### 업로드 프로세스

1.  **루트 선택**: 산 → 루트를 순서대로 선택합니다. 기존에 등록된 사진 목록이 자동으로 로드됩니다.
2.  **사진 선택**: 업로드 영역을 탭하거나 파일을 드래그&드롭합니다. 여러 장 동시 선택 가능.
3.  **자동 처리 (클라이언트 사이드)**:
    -   EXIF GPS 추출 — WebP 변환 **전에** 원본에서 좌표를 읽습니다.
    -   Canvas API로 가로 최대 1200px 리사이징 + WebP 80% 품질 변환.
    -   처리된 파일을 서버로 전송합니다.
4.  **서버 처리**:
    -   Supabase Storage에 WebP 저장 (`waypoints` 버킷 / `photos/{routeId}/` 경로).
    -   GPS 좌표가 있으면 루트의 모든 구간 트랙과 Haversine 거리 비교 → 100m 이내 가장 가까운 구간에 자동 매핑.
5.  **설명 입력**: 업로드 완료 후 각 사진 카드에서 영문/국문 설명 입력 후 **Save Description** 클릭.

### GPS 매핑 규칙

| 조건 | 처리 |
|---|---|
| GPS 있음 + 경로 100m 이내 | 해당 구간에 자동 매핑 (초록색 "auto-mapped" 표시) |
| GPS 있음 + 경로 100m 초과 | 구간 미지정 — 드롭다운으로 수동 선택 |
| GPS 없음 | 구간 미지정 — 드롭다운으로 수동 선택 |

> **팁**: EXIF GPS가 없는 사진(스크린샷, 편집본 등)도 업로드 후 구간을 수동으로 지정하면 지도에 표시됩니다.

### 하이커 뷰에서의 표시

-   **지도(MapView)**: 앰버(황금색) 원형 카메라 마커. 탭하면 사진 팝업 오픈.
-   **고도 그래프(ElevationChart)**: 해당 거리 지점에 카메라 dot + 세로 점선. 탭하면 동일 팝업 오픈.
-   **팝업**: 사진 전체 표시 + 영문/국문 설명.

---

## 💾 기술 참조 (Technical Reference)

### 데이터베이스 테이블 (Supabase)
-   `mountains`: 산의 기본 정보.
-   `waypoints`: 7개의 타입을 가진 지점 정보. `ars_id`는 버스 정류장용 필드.
-   `segments`: 최신 `is_bus_combined` 필드가 `true`이면 `bus_details` JSON 내에 경유지 ID와 버스 전용 GPS가 보관됩니다.
-   `routes`: `segment_ids` 배열을 통해 구간을 순서대로 참조합니다.
-   `route_photos`: 루트에 연결된 풍경 사진. `route_id` (필수), `segment_id` (선택), `lat/lon`, `url`, `description_en`, `description_ko`, `order_index` 컬럼. Migration: `supabase/migrations/20260414_add_route_photos.sql`.

### 사진 API 엔드포인트

| Method | Endpoint | 설명 |
|---|---|---|
| `GET` | `/api/admin/route-photos?routeId=X` | 루트의 사진 목록 조회 |
| `POST` | `/api/admin/route-photos` | 사진 업로드 (multipart/form-data) |
| `PATCH` | `/api/admin/route-photos` | description / segment_id 수정 |
| `DELETE` | `/api/admin/route-photos?id=X` | 사진 삭제 (Storage + DB 동시 삭제) |

### 슬러그(Slug) 규칙
세그먼트 슬러그는 `[산-슬러그]-[타입]-[시작점-슬러그]-to-[도착점-슬러그]` 형태로 자동 생성되어 데이터 일관성을 유지합니다.
