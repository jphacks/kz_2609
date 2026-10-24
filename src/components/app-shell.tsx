"use client";

import { Bookmark, Camera, Map as MapIcon, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppProvider, OnboardingRedirect } from "@/components/app-context";
import { Spinner, cn } from "@/components/ui";

const NAV: { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }[] = [
  { href: "/", label: "マップ", icon: MapIcon, match: (p) => p === "/" || p.startsWith("/spots") },
  { href: "/lists", label: "リスト", icon: Bookmark, match: (p) => p.startsWith("/lists") || p.startsWith("/plans") },
  { href: "/posts/new", label: "投稿", icon: Camera, match: (p) => p.startsWith("/posts") },
  { href: "/me", label: "マイページ", icon: User, match: (p) => p.startsWith("/me") },
];

// usePathname は Suspense の中で使う（cacheComponents のため）
function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1" aria-label="メイン">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm",
            item.match(pathname) ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-muted",
          )}
        >
          <item.icon size={20} strokeWidth={2} aria-hidden />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function BottomNav() {
  const pathname = usePathname();
  return (
    <>
      {NAV.map((item) => {
        const active = item.match(pathname);
        const isPost = item.href === "/posts/new";
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex flex-col items-center justify-center gap-0.5 text-[11px]", active ? "text-primary" : "text-muted")}
          >
            {isPost ? (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <item.icon size={24} strokeWidth={2} aria-hidden />
              </span>
            ) : (
              <item.icon size={24} strokeWidth={2} aria-hidden />
            )}
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

// 共通レイアウト（6章）：スマホは下部ナビ、PC（1024px以上）は上部ヘッダー
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <Suspense>
        <OnboardingRedirect />
      </Suspense>
      <header className="sticky top-0 z-30 hidden h-14 items-center gap-6 border-b border-border bg-surface px-6 lg:flex">
        <Link href="/" className="text-base font-bold">
          旅行どこいこう
        </Link>
        <Suspense>
          <HeaderNav />
        </Suspense>
      </header>

      <main className="flex min-h-0 flex-1 flex-col pb-16 lg:pb-0">
        <Suspense fallback={<Spinner />}>{children}</Suspense>
      </main>

      <nav
        aria-label="メイン"
        className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-4 border-t border-border bg-surface lg:hidden"
      >
        <Suspense>
          <BottomNav />
        </Suspense>
      </nav>
    </AppProvider>
  );
}
