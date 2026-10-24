import Link from "next/link";

// S-17 見つかりません
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-lg font-bold">ページが見つかりませんでした</h1>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        トップへ戻る
      </Link>
    </div>
  );
}
