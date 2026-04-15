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
