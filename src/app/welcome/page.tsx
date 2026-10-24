import { Suspense } from "react";
import { Welcome } from "@/components/welcome";
import { Spinner } from "@/components/ui";

// S-14 初回プロフィール設定
export default function WelcomePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Welcome />
    </Suspense>
  );
}
