"use client";

import { ArrowDown, ArrowUp, Clock, ListChecks, MessageCircle, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Card, IconButton, Notice, cn, inputClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import type { TravelMode } from "@/lib/constants";
import { CHAT_MAX_TURNS, CHAT_MESSAGE_MAX, stripEmoji, type ChatMessage, type ChatReply } from "@/lib/plan-chat";
import type { ChatConditions } from "@/lib/planner/types";

type Props = {
  listId: string;
  spots: { id: string; name: string }[];
  common: { date: string; startTime: string; endTime: string; mode: TravelMode };
  conditions: ChatConditions;
  onConditions: (c: ChatConditions) => void;
  onSwitchToPreferences: () => void;
};

// S-10 AIと相談（F-5-5）。会話はこの画面の中だけに持ち、保存しない
export function PlanChat({ listId, spots, common, conditions, onConditions, onSwitchToPreferences }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unclear, setUnclear] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const turns = messages.filter((m) => m.role === "user").length;
  const limitReached = turns >= CHAT_MAX_TURNS;
  const example = spots[0] ? `夕日は${spots[spots.length - 1].name}で見たい。午前はのんびり、歩くのは少なめがいい` : "";

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending || limitReached || spots.length === 0) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setSending(true);
    setError(null);
    try {
      const res = await api<ChatReply>("/plans/chat", {
        method: "POST",
        json: { listId, spotIds: spots.map((s) => s.id), ...common, messages: next, conditions },
      });
      setMessages([...next, { role: "assistant", content: stripEmoji(res.reply) }]);
      setUnclear(res.unclear);
      if (!res.unclear) onConditions(res.conditions);
    } catch (e) {
      // 送れなかったメッセージは入力欄に戻す
      setMessages(messages);
      setDraft(content);
      setError(errorMessage(e));
    } finally {
      setSending(false);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "nearest" }));
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-sm text-muted">
        行きたい時間帯や順番、ペースなどを自由に書いてください。AIが条件に置き換えます。経路は条件をもとにアプリが計算します。
      </p>

      <ol className="flex flex-col gap-2" aria-label="AIとの会話" aria-live="polite">
        {messages.length === 0 && example && (
          <li>
            <button
              type="button"
              onClick={() => setDraft(example)}
              className="min-h-11 rounded-xl border border-dashed border-border px-3 py-2 text-left text-sm text-muted hover:bg-surface-muted"
            >
              例：{example}
            </button>
          </li>
        )}
        {messages.map((m, i) => (
          <li key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm",
                m.role === "user" ? "bg-primary-soft" : "border border-border bg-surface",
              )}
            >
              {m.role === "assistant" && (
                <span className="mb-1 flex items-center gap-1 text-xs text-muted">
                  <MessageCircle size={14} strokeWidth={2} aria-hidden />
                  AI
                </span>
              )}
              {m.content}
            </div>
          </li>
        ))}
        {sending && <li className="text-sm text-muted">AIが考えています…</li>}
      </ol>
      <div ref={bottomRef} />

      {unclear && (
        <Notice tone="info">
          <span className="flex flex-col gap-2">
            うまく伝わらないときは、選択式でも条件を決められます。
            <Button variant="secondary" icon={ListChecks} className="self-start" onClick={onSwitchToPreferences}>
              選択式で作る
            </Button>
          </span>
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {limitReached && <Notice tone="info">会話は{CHAT_MAX_TURNS}往復までです。下の条件を確認して経路案を作ってください</Notice>}

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <label className="sr-only" htmlFor="plan-chat-input">
          AIへのメッセージ
        </label>
        <textarea
          id="plan-chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter で送信、Shift+Enter で改行。日本語の変換中は送らない
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(draft);
            }
          }}
          maxLength={CHAT_MESSAGE_MAX}
          rows={2}
          disabled={sending || limitReached}
          placeholder="例：兼六園は混む前に行きたい"
          className={cn(inputClass, "resize-none py-2 text-base")}
        />
        <IconButton
          type="submit"
          icon={Send}
          label="送信"
          disabled={sending || limitReached || draft.trim() === ""}
        />
      </form>
    </Card>
  );
}

// AIが読み取った「時刻の指定・順番の希望・除外」の一覧。不要なものは外せる（F-5-5：確認・修正してから作成）
export function ChatConditionsList({
  conditions,
  spotNames,
  onChange,
}: {
  conditions: ChatConditions;
  spotNames: Map<string, string>;
  onChange: (c: ChatConditions) => void;
}) {
  const name = (id: string) => spotNames.get(id) ?? "（選んでいないスポット）";
  const rows: { key: string; icon: typeof Clock; text: string; remove: () => void }[] = [
    ...conditions.timeWindows.map((w, i) => ({
      key: `w${i}`,
      icon: Clock,
      text: `${name(w.spotId)}に ${w.from}〜${w.to} に着く`,
      remove: () => onChange({ ...conditions, timeWindows: conditions.timeWindows.filter((_, j) => j !== i) }),
    })),
    ...conditions.orderHints.map((h, i) => ({
      key: `o${i}`,
      icon: h.position === "last" || h.position === "after" ? ArrowDown : ArrowUp,
      text:
        h.position === "first"
          ? `${name(h.spotId)}に最初に行く`
          : h.position === "last"
            ? `${name(h.spotId)}に最後に行く`
            : `${name(h.spotId)}は${name(h.relativeTo ?? "")}より${h.position === "before" ? "前" : "後"}に行く`,
      remove: () => onChange({ ...conditions, orderHints: conditions.orderHints.filter((_, j) => j !== i) }),
    })),
    ...conditions.exclude.map((id) => ({
      key: `x${id}`,
      icon: X,
      text: `${name(id)}には今回行かない`,
      remove: () => onChange({ ...conditions, exclude: conditions.exclude.filter((x) => x !== id) }),
    })),
  ];
  if (rows.length === 0) return null;
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">時刻・順番の希望</legend>
      <ul className="flex flex-col gap-1">
        {rows.map(({ key, icon: Icon, text, remove }) => (
          <li key={key} className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface pl-3">
            <Icon size={16} strokeWidth={2} className="shrink-0" aria-hidden />
            <span className="flex-1 text-sm">{text}</span>
            <IconButton icon={X} label={`「${text}」を外す`} onClick={remove} className="border-0" />
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
