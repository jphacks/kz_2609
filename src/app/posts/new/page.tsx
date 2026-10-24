import { Suspense } from "react";
import { PostNew } from "@/components/post-new";
import { Spinner } from "@/components/ui";

// S-04 投稿作成（URL の ?spotId= を読むので Suspense の中に置く）
export default function NewPostPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <PostNew />
    </Suspense>
  );
}
