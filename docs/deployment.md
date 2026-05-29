# 배포 방법

GitHub `main` 브랜치에 push하면 Vercel이 자동으로 배포합니다.

```bash
git add .
git commit -m "커밋 메시지"
git push origin main
```

빌드 상태는 Vercel 대시보드 → summit → Deployments 에서 확인.

---

## 환경변수 (Vercel 대시보드 → Settings → Environment Variables)

| 변수 | 출처 |
|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | account.mapbox.com → Access tokens |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role |
| `KASI_API_KEY` | data.go.kr → 천문연구원 일출몰 API |

---

## DB 마이그레이션

`supabase/migrations/` 파일들은 자동 적용 안 됨 — 수동으로 실행 필요.

```bash
supabase db push
```

---

## Google Play Store (TWA) 배포

PWA를 Trusted Web Activity(TWA)로 래핑해 Google Play Store에 등록한다.

### 사전 준비

- Vercel 배포 완료 + 커스텀 도메인 (HTTPS 필수)
- Google Play Console 개발자 계정
- Android Studio 또는 Java 11+ (키스토어 생성용)
- Node.js — `@bubblewrap/cli` 실행용

### 1. Bubblewrap CLI 설치

```bash
npm install -g @bubblewrap/cli
```

### 2. TWA 프로젝트 초기화

```bash
mkdir s3-twa && cd s3-twa
bubblewrap init --manifest https://<your-domain>/manifest.json
```

`bubblewrap init` 이 물어보는 주요 항목:

| 항목 | 값 |
|---|---|
| Application ID | `com.seoulsubwaytosummit.app` (예시) |
| Host | `<your-domain>` |
| Start URL | `/` |
| Signing key | 새로 생성하거나 기존 `.jks` 경로 입력 |

완료 후 `android/` 폴더와 키스토어 파일이 생성된다.

### 3. Digital Asset Links 설정 (`assetlinks.json`)

TWA가 검증되려면 웹사이트에서 앱의 서명 지문을 선언해야 한다.

**지문 확인:**

```bash
keytool -list -v -keystore <your-keystore.jks> -alias <alias>
```

출력의 `SHA-256` 값을 복사한다.

**`public/.well-known/assetlinks.json` 파일 생성:**

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.seoulsubwaytosummit.app",
    "sha256_cert_fingerprints": ["AA:BB:CC:..."]
  }
}]
```

**Next.js에서 `/.well-known/` 경로 허용** — `vercel.json` 에 헤더 추가:

```json
{
  "regions": ["icn1"],
  "headers": [
    {
      "source": "/.well-known/assetlinks.json",
      "headers": [{ "key": "Content-Type", "value": "application/json" }]
    }
  ]
}
```

배포 후 브라우저에서 `https://<your-domain>/.well-known/assetlinks.json` 접근이 되는지 확인.

### 4. PWA 체크리스트 (배포 전 필수)

| 항목 | 상태 | 비고 |
|---|---|---|
| `manifest.json` `display: standalone` | ✅ | |
| 아이콘 192×192, 512×512 | ✅ | |
| `purpose` 분리 (`any` / `maskable` 별도) | ✅ | 192/512 각각 2개 항목으로 분리 완료 |
| Service Worker 상시 등록 유지 | ✅ | activate 핸들러에서 `unregister()` 제거, 구버전 캐시만 삭제 |
| SW 알림 아이콘 경로 | ✅ | `/images/icon-192.png` |
| `assetlinks.json` | ✅ | `D:\projects_keystores\seoul-subway-to-summit\s3-release.jks` (alias: s3-release) |
| HTTPS | ✅ Vercel 자동 |  |

### 5. APK 빌드 및 서명

```bash
cd s3-twa
bubblewrap build
```

`app-release-signed.apk` 생성 확인.

### 6. Play Console 업로드

1. Play Console → 앱 만들기
2. 내부 테스트 트랙 → APK/AAB 업로드
3. 출시 → 프로덕션 검토 제출

### 참고

- [Bubblewrap CLI GitHub](https://github.com/GoogleChromeLabs/bubblewrap)
- [Digital Asset Links 공식 문서](https://developers.google.com/digital-asset-links)
- [TWA 체크리스트 — web.dev](https://web.dev/articles/using-a-pwa-in-your-android-app)
