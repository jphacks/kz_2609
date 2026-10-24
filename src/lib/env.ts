// 環境変数の読み取り。キーが未設定でも画面は起動できるようにし、使えない機能は理由を表示する

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
}

// 開発用ログイン（ローカルのテストユーザー用）。本番では false のままにする
export const DEV_LOGIN_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true";

// 以下はサーバー専用
export function serverEnv() {
  return {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    googleRoutesApiKey: process.env.GOOGLE_ROUTES_API_KEY ?? "",
    // F-8-8：true の間は外部APIを呼ばず、直線距離からの概算を返す
    useMockExternalApis: (process.env.USE_MOCK_EXTERNAL_APIS ?? "true") === "true",
    nominatimUserAgent: process.env.NOMINATIM_USER_AGENT ?? "tabi-dokoikou (dev)",
    // 無料枠（14章。数値は各サービスの公式ページで確認して設定する）
    // Routes API Essentials（ADR-0019）。行列は組み合わせの件数、経路は回数で数える
    googleRouteMatrixMonthlyFree: Number(process.env.GOOGLE_ROUTE_MATRIX_MONTHLY_FREE ?? "10000"),
    googleRoutesMonthlyFree: Number(process.env.GOOGLE_ROUTES_MONTHLY_FREE ?? "10000"),
    nominatimDailyLimit: Number(process.env.NOMINATIM_DAILY_LIMIT ?? "500"),
  };
}
