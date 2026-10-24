import type { Metadata } from "next";
import { SharedListView } from "@/components/shared-list";

// URL の合言葉が検索エンジンや外部サイトに漏れないよう、検索結果に出さず、リンク先へ URL を送らない
export const metadata: Metadata = {
  title: "共有されたリスト",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// S-13 共有リスト（F-4-6）
export default function SharedListPage() {
  return <SharedListView />;
}
