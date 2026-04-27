"use client";

import { useState } from "react";
import { Languages, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

const CARD = "rounded-2xl bg-white border border-[var(--color-border)] p-5 flex flex-col gap-4";
const BTN_PRIMARY = "flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed";

export default function TranslationSyncCard() {
  const [syncing, setSyncing] = useState(false);
  const [result, setSyncResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  async function handleSync() {
    if (!confirm("데이터베이스 전체를 검사하여 누락되거나 수정된 모든 언어(영어, 중국어, 일본어, 스페인어)를 AI가 번역하고 동기화합니다. 계속하시겠습니까?")) return;

    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch("/api/admin/translate/sync", {
        method: "POST",
      });
      const data = await res.json();
      setSyncResult(data);
    } catch (err) {
      setSyncResult({ success: false, error: "서버 연결에 실패했습니다." });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className={CARD}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Languages className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-[1rem]" style={{ fontFamily: "var(--font-en)" }}>
            AI Translation Sync
          </span>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            한/영 원문을 기반으로 5개 국어(KO, EN, ZH, JA, ES)를 자동 동기화합니다.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={handleSync}
          disabled={syncing}
          className={BTN_PRIMARY}
        >
          {syncing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              동기화 중... (수 분이 소요될 수 있습니다)
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              전체 번역 동기화 실행
            </>
          )}
        </button>

        {result && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}>
            {result.success ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {result.success ? result.message : result.error}
          </div>
        )}
      </div>
    </div>
  );
}
