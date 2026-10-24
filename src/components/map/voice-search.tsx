"use client";

import { Mic, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/components/ui";

// ブラウザの音声認識（Web Speech API）。Chrome（Android・PC）と iOS の Safari で使える
type RecognitionResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: RecognitionResultList }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

export function speechRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const subscribeNothing = () => () => undefined;

// 音声入力が使えるブラウザか（サーバー描画では「使えない」として扱う）
export function useCanVoice(): boolean {
  return useSyncExternalStore(subscribeNothing, () => speechRecognitionCtor() !== null, () => false);
}

// F-1-11：音声で検索する。聞き取った言葉を検索欄に入れて候補を出す
export function VoiceSearch({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "ja-JP";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) {
        t += e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText = t;
      }
      setText(t);
    };
    rec.onerror = () => setFailed(true);
    rec.onend = () => {
      if (finalText.trim()) onResultRef.current(finalText.trim());
      else setFailed(true);
    };
    try {
      rec.start();
    } catch {
      // マイクの許可がない・二重に開始したなど。描画が終わってから失敗表示にする
      queueMicrotask(() => setFailed(true));
    }
    return () => {
      // 閉じたときに古い認識の終了通知で失敗表示にならないよう、先に受け取りをやめる
      rec.onresult = rec.onerror = rec.onend = null;
      rec.abort();
    };
  }, [attempt]);

  const listening = !failed && speechRecognitionCtor() !== null;
  return (
    <div role="dialog" aria-label="音声で検索" className="fixed inset-0 z-50 flex flex-col bg-surface">
      <p className={cn("px-6 pt-12 text-2xl leading-relaxed", text && listening ? "text-foreground" : "text-muted")} aria-live="polite">
        {!listening ? "聞き取れませんでした。もう一度お試しください。" : text || "お話しください"}
      </p>
      <div className="relative mt-auto flex items-center justify-center pb-16">
        {listening && (
          <>
            <span className="absolute h-64 w-64 rounded-full border border-border bg-surface-muted/40" aria-hidden />
            <span className="absolute h-48 w-48 animate-pulse rounded-full bg-surface-muted" aria-hidden />
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setText("");
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
          aria-label={listening ? "聞き取り中" : "もう一度話す"}
          className="relative inline-flex h-20 w-20 items-center justify-center rounded-full bg-danger text-white shadow-md"
        >
          <Mic size={32} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="音声入力を閉じる"
          className="absolute bottom-16 right-6 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-muted"
        >
          <X size={24} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
