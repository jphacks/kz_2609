"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/client-api";
import { isSupabaseConfigured } from "@/lib/env";

export type Me = { id: string; displayName: string; avatarUrl: string | null; onboarded: boolean };
export type SystemStatus = {
  suspended: {
    transit: boolean;
    walking: boolean;
    driving: boolean;
    legs: boolean;
    placeSearch: boolean;
    posting: boolean;
    ai: boolean;
  };
  mockExternalApis: boolean;
};

type AppState = {
  configured: boolean;
  me: Me | null;
  meLoaded: boolean;
  status: SystemStatus | null;
  refreshMe: () => Promise<void>;
  // ログインが必要な操作の前に呼ぶ。未ログインならログイン画面へ移動して false を返す
  requireLogin: () => boolean;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [me, setMe] = useState<Me | null>(null);
  const [meLoaded, setMeLoaded] = useState(!configured);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const router = useRouter();

  const refreshMe = useCallback(async () => {
    if (!configured) return;
    try {
      const res = await api<{ user: Me | null }>("/me", { cache: "no-store" });
      setMe(res.user);
    } catch {
      setMe(null);
    } finally {
      setMeLoaded(true);
    }
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    api<{ user: Me | null }>("/me", { cache: "no-store" })
      .then((res) => setMe(res.user))
      .catch(() => setMe(null))
      .finally(() => setMeLoaded(true));
    api<SystemStatus>("/system/status")
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [configured]);

  const requireLogin = useCallback(() => {
    if (me) return true;
    const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    router.push(`/login?next=${encodeURIComponent(next)}`);
    return false;
  }, [me, router]);

  const value = useMemo(
    () => ({ configured, me, meLoaded, status, refreshMe, requireLogin }),
    [configured, me, meLoaded, status, refreshMe, requireLogin],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// 初回ログイン時は表示名の確認へ（F-6-2）。URL を読むので Suspense の中に置く
export function OnboardingRedirect() {
  const { me } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (me && !me.onboarded && pathname !== "/welcome") {
      router.replace(`/welcome?next=${encodeURIComponent(pathname)}`);
    }
  }, [me, pathname, router]);
  return null;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
