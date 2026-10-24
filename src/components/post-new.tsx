"use client";

import { Camera, ChevronLeft, ImagePlus, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "@/components/app-context";
import { PlacePicker, type PickedPlace } from "@/components/place-picker";
import { PostFields } from "@/components/post-fields";
import { Button, Card, Notice, PageHeader, Spinner, cn } from "@/components/ui";
import { api, ApiClientError } from "@/lib/client-api";
import {
  CATEGORY_LABELS,
  COMMENT_MAX,
  MAX_IMAGES,
  STAY_LABELS,
  STORAGE_BUCKET,
  type Category,
  type StayDuration,
} from "@/lib/constants";
import { processImage, validateSourceImage, type ProcessedImage } from "@/lib/image";
import { getBrowserSupabase } from "@/lib/supabase/client";

const STEPS = ["写真", "場所", "内容", "確認"] as const;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

type Upload = { kind: "full" | "thumb"; path: string; token: string };

// 署名付きURLを発行してもらい、本画像とサムネイルを Storage の一時フォルダへ送る（F-2-4）
async function uploadImages(images: ProcessedImage[]) {
  const supabase = getBrowserSupabase();
  if (!supabase) throw new Error("not configured");
  const files = images.flatMap((img) => [
    { kind: "full" as const, contentType: img.contentType, size: img.full.size },
    { kind: "thumb" as const, contentType: img.contentType, size: img.thumb.size },
  ]);
  const { uploads } = await api<{ uploads: Upload[] }>("/uploads", { method: "POST", json: { files } });
  for (const [i, u] of uploads.entries()) {
    const img = images[Math.floor(i / 2)];
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .uploadToSignedUrl(u.path, u.token, u.kind === "full" ? img.full : img.thumb, { contentType: img.contentType });
    if (error) throw new Error(error.message);
  }
  return images.map((img, i) => ({
    fullPath: uploads[i * 2].path,
    thumbPath: uploads[i * 2 + 1].path,
    width: img.width,
    height: img.height,
  }));
}

function spotPayload(place: PickedPlace) {
  if (place.kind === "spot") return { spotId: place.spotId };
  const { name, lat, lng, source, accuracyM, externalRef, address, prefecture, city } = place;
  return { newSpot: { name, lat, lng, source, accuracyM, externalRef, address, prefecture, city } };
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4">
      <PageHeader title="投稿" />
      {children}
    </div>
  );
}

// S-04 投稿作成（F-2-2：写真選択 → 場所 → 内容入力 → 確認）
export function PostNew() {
  const { me, meLoaded, configured, status, requireLogin } = useApp();
  const router = useRouter();
  const presetSpotId = useSearchParams().get("spotId");
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [comment, setComment] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [stay, setStay] = useState<StayDuration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (meLoaded && configured && !me) requireLogin();
  }, [me, meLoaded, configured, requireLogin]);

  // スポット詳細の「ここに投稿」から来た場合は、場所を最初から入れておく
  useEffect(() => {
    if (!presetSpotId || !configured) return;
    api<{ id: string; name: string; lat: number; lng: number }>(`/spots/${presetSpotId}`)
      .then((s) => setPlace({ kind: "spot", spotId: s.id, name: s.name, lat: s.lat, lng: s.lng }))
      .catch(() => undefined);
  }, [presetSpotId, configured]);

  if (!configured) {
    return (
      <Shell>
        <Notice tone="warning">Supabase に接続すると投稿できます（docs/セットアップ手順.md）</Notice>
      </Shell>
    );
  }
  if (!me) return <Spinner />;
  if (status?.suspended.posting) {
    return (
      <Shell>
        <Notice tone="warning">現在、新しい投稿を受け付けていません</Notice>
      </Shell>
    );
  }

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const room = MAX_IMAGES - images.length;
    if (files.length > room) setError(`写真は${MAX_IMAGES}枚までです`);
    setProcessing(true);
    try {
      const out: ProcessedImage[] = [];
      for (const f of Array.from(files).slice(0, room)) {
        const invalid = validateSourceImage(f);
        if (invalid) {
          setError(invalid);
          continue;
        }
        try {
          out.push(await processImage(f));
        } catch {
          setError("写真を読み込めませんでした。別の写真を選んでください");
        }
      }
      setImages((prev) => [...prev, ...out]);
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    if (!category || !place) return;
    setSubmitting(true);
    setError(null);
    setConflicts([]);
    try {
      const uploaded = await uploadImages(images);
      const res = await api<{ postId: string; spotId: string }>("/posts", {
        method: "POST",
        json: { ...spotPayload(place), images: uploaded, comment, category, stayDuration: stay },
      });
      router.push(`/spots/${res.spotId}`);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "CONFLICT") {
        const d = e.details as { candidates?: { id: string; name: string }[] } | undefined;
        setConflicts(d?.candidates ?? []);
      }
      // 入力内容は残したまま、もう一度送れるようにする（F-2 の例外）
      setError(e instanceof ApiClientError ? e.message : "アップロードに失敗しました。もう一度試してください");
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = [images.length > 0 && !processing, place !== null, category !== null && comment.length <= COMMENT_MAX, true][step];

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-8">
      <PageHeader title="投稿" backHref="/" />
      <ol className="mb-4 grid grid-cols-4 gap-1 text-center text-xs" aria-label="投稿の手順">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "rounded-full py-1.5",
              i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary-soft text-primary" : "bg-surface-muted text-muted",
            )}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {error && (
        <Notice tone="error" className="mb-3">
          {error}
        </Notice>
      )}

      {step === 0 && (
        <section className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {images.map((img, i) => (
              <div key={img.previewUrl} className="relative aspect-square overflow-hidden rounded-xl bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.previewUrl} alt={`写真${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label={`写真${i + 1}を外す`}
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"
                >
                  <X size={20} strokeWidth={2} aria-hidden />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface text-sm text-muted"
              >
                <ImagePlus size={24} strokeWidth={2} aria-hidden />
                写真を追加（{images.length}/{MAX_IMAGES}）
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => addFiles(e.target.files)} />
          {processing && <Spinner label="写真を変換中" />}
          <p className="text-xs text-muted">1〜4枚。写真の位置情報などの情報は、アップロード前にすべて取り除きます。</p>
        </section>
      )}

      {step === 1 && <PlacePicker value={place} onChange={setPlace} />}

      {step === 2 && (
        <PostFields
          comment={comment}
          category={category}
          stay={stay}
          onChange={(v) => {
            if (v.comment !== undefined) setComment(v.comment);
            if (v.category !== undefined) setCategory(v.category);
            if (v.stay !== undefined) setStay(v.stay);
          }}
        />
      )}

      {step === 3 && (
        <Card className="flex flex-col gap-3 p-4">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={img.previewUrl} src={img.previewUrl} alt={`写真${i + 1}`} className="h-24 w-24 shrink-0 rounded-xl object-cover" />
            ))}
          </div>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted">場所</dt>
            <dd>{place?.name}</dd>
            <dt className="text-muted">カテゴリ</dt>
            <dd>{category ? CATEGORY_LABELS[category] : "-"}</dd>
            <dt className="text-muted">滞在時間</dt>
            <dd>{stay ? STAY_LABELS[stay] : "未入力"}</dd>
            <dt className="text-muted">コメント</dt>
            <dd className="whitespace-pre-wrap">{comment || "なし"}</dd>
          </dl>
          {conflicts.length > 0 && place && (
            <div className="flex flex-col gap-2">
              <p className="text-sm">近くに同じ名前のスポットがあります。こちらを選んでください。</p>
              {conflicts.map((c) => (
                <Button
                  key={c.id}
                  variant="secondary"
                  onClick={() => {
                    setPlace({ kind: "spot", spotId: c.id, name: c.name, lat: place.lat, lng: place.lng });
                    setConflicts([]);
                    setError(null);
                  }}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <Button variant="secondary" icon={ChevronLeft} onClick={() => setStep(step - 1)} disabled={submitting}>
            戻る
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button className="flex-1" onClick={() => setStep(step + 1)} disabled={!canNext}>
            次へ
          </Button>
        ) : (
          <Button className="flex-1" icon={Camera} onClick={submit} loading={submitting}>
            投稿する
          </Button>
        )}
      </div>
      {step === 0 && images.length > 0 && (
        <Button variant="ghost" icon={Trash2} className="mt-2 w-full" onClick={() => setImages([])}>
          写真をすべて外す
        </Button>
      )}
    </div>
  );
}
