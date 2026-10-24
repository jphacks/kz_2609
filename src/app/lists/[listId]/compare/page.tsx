import { Suspense } from "react";
import { ListCompare } from "@/components/list-compare";
import { Spinner } from "@/components/ui";

// S-08 スポット比較（URL の ?ids= を読むので Suspense の中に置く）
export default function ComparePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ListCompare />
    </Suspense>
  );
}
