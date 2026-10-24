import { Suspense } from "react";
import { MapScreen } from "@/components/map/map-screen";

// S-01 マップ（トップ）。URL の ?q=（投稿のタグから開いたときの検索語）を読むので Suspense の中に置く
export default function Home() {
  return (
    <Suspense>
      <MapScreen />
    </Suspense>
  );
}
