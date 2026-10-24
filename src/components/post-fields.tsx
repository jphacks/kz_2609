"use client";

import { Clock } from "lucide-react";
import { CATEGORY_ICONS } from "@/components/category";
import { Chip, cn, inputClass } from "@/components/ui";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COMMENT_MAX,
  STAY_DURATIONS,
  STAY_LABELS,
  type Category,
  type StayDuration,
} from "@/lib/constants";

// 投稿の内容入力（F-2-8〜F-2-10）。作成と編集で共通
export function PostFields({
  comment,
  category,
  stay,
  onChange,
}: {
  comment: string;
  category: Category | null;
  stay: StayDuration | null;
  onChange: (v: { comment?: string; category?: Category; stay?: StayDuration | null }) => void;
}) {
  const remaining = COMMENT_MAX - comment.length;
  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">カテゴリ（必須）</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c} icon={CATEGORY_ICONS[c]} selected={category === c} onClick={() => onChange({ category: c })}>
              {CATEGORY_LABELS[c]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">コメント（任意）</span>
        <textarea
          value={comment}
          onChange={(e) => onChange({ comment: e.target.value })}
          rows={4}
          placeholder="おすすめの時間帯や見どころなど。#夜景 #自然界隈 のようにタグも付けられます"
          className={cn(inputClass, "py-2")}
          aria-describedby="comment-count"
        />
        <span id="comment-count" className={cn("text-right text-xs", remaining < 0 ? "font-medium text-danger" : "text-muted")}>
          {remaining < 0 ? `${-remaining}文字オーバーしています（${COMMENT_MAX}文字まで）` : `残り${remaining}文字`}
        </span>
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">滞在時間（任意）</legend>
        <div className="flex flex-wrap gap-2">
          {STAY_DURATIONS.map((d) => (
            <Chip key={d} icon={Clock} selected={stay === d} onClick={() => onChange({ stay: stay === d ? null : d })}>
              {STAY_LABELS[d]}
            </Chip>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">経路作成で滞在時間の目安に使います</p>
      </fieldset>
    </div>
  );
}
