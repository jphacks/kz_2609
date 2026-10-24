import { Suspense } from "react";
import { Login } from "@/components/login";
import { Spinner } from "@/components/ui";

// S-13 ログイン（URL の ?next= を読むので Suspense の中に置く）
export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Login />
    </Suspense>
  );
}
