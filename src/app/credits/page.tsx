import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { SEED_PHOTOS } from "@/lib/photo-credits";
import { TRANSIT_SOURCE } from "@/lib/transit/network";

export const metadata = { title: "写真とデータのクレジット" };

// 初期データの写真の作者・ライセンス一覧（CC BY / CC BY-SA の表示条件。src/lib/photo-credits.ts）と、
// 公共交通の経路計算に使う国土数値情報の出典（CC BY 4.0。ADR-0026）
export default function CreditsPage() {
  const spots = [...new Set(SEED_PHOTOS.map((p) => p.spot))];
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8 text-sm leading-7">
      <PageHeader title="写真とデータのクレジット" backHref="/" />
      <p>
        初期データのスポットの写真は、Wikimedia Commons でクリエイティブ・コモンズ・ライセンスなどにより公開されている画像を、縮小して使っています。各写真の作者・ライセンス・出典は次のとおりです。
      </p>
      {spots.map((spot) => (
        <section key={spot} className="mt-4">
          <h2 className="font-bold">{spot}</h2>
          <ul className="mt-1 flex flex-col gap-2">
            {SEED_PHOTOS.filter((p) => p.spot === spot).map((p) => (
              <li key={p.full} className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/${p.thumb}`} alt={p.label} loading="lazy" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                <span>
                  {p.label}
                  <br />
                  作者：{p.artist} ／ {p.license} ／{" "}
                  <a href={p.page} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">
                    {p.title}
                    <ExternalLink size={12} strokeWidth={2} aria-hidden />
                    <span className="sr-only">（新しいタブで開く）</span>
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="mt-6">
        <h2 className="font-bold">公共交通のデータ</h2>
        <p className="mt-1">
          経路作成の公共交通（バス停・駅の位置と路線）には、次のデータ（クリエイティブ・コモンズ 表示 4.0）を使っています。
        </p>
        <p className="mt-1">{TRANSIT_SOURCE}</p>
        <ul className="mt-1 flex flex-col gap-1">
          {[
            ["国土数値情報 バス停留所データ", "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P11-2022.html"],
            ["国土数値情報 鉄道データ", "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2024.html"],
          ].map(([label, href]) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">
                {label}
                <ExternalLink size={12} strokeWidth={2} aria-hidden />
                <span className="sr-only">（新しいタブで開く）</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
