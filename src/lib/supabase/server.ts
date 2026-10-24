import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured, serverEnv } from "@/lib/env";

// ログイン中のユーザーとして DB にアクセスする（RLS が効く）
export async function getServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component から呼ばれた場合は書き込めない。セッションの更新は proxy.ts が行う
        }
      },
    },
  });
}

let admin: SupabaseClient | null = null;

// サーバー専用の管理用クライアント（RLS を通らない）。集計・無料枠・スポット作成・Storage 操作に使う
export function getAdminSupabase(): SupabaseClient {
  const { serviceRoleKey } = serverEnv();
  if (!isSupabaseConfigured() || serviceRoleKey === "") {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }
  if (!admin) {
    admin = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
