// 共通の見た目（8章）。カードは四辺同じ枠線か淡い背景色で区切り、片側だけの色帯は使わない
import { CircleAlert, Info, LoaderCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-surface text-foreground border border-border hover:bg-surface-muted",
  ghost: "text-foreground hover:bg-surface-muted",
  danger: "bg-surface text-danger border border-border hover:bg-danger-soft",
};

export function Button({
  variant = "primary",
  icon: Icon,
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: LucideIcon; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? (
        <LoaderCircle size={20} strokeWidth={2} className="animate-spin" aria-hidden />
      ) : (
        Icon && <Icon size={20} strokeWidth={2} aria-hidden />
      )}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  className,
  active,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; active?: boolean }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface transition hover:bg-surface-muted disabled:opacity-50",
        active && "bg-primary-soft text-primary",
        className,
      )}
    >
      <Icon size={20} strokeWidth={2} aria-hidden />
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border border-border bg-surface", className)}>{children}</div>;
}

const BADGE_TONES = {
  neutral: "bg-surface-muted text-muted",
  primary: "bg-primary-soft text-primary",
  popular: "bg-[#fdf0e1] text-popular",
  very_popular: "bg-[#fde8dc] text-very-popular",
  hidden_gem: "bg-hidden-gem-soft text-hidden-gem",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  icon: Icon,
  children,
  tone = "neutral",
}: {
  icon?: LucideIcon;
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", BADGE_TONES[tone])}>
      {Icon && <Icon size={14} strokeWidth={2} aria-hidden />}
      {children}
    </span>
  );
}

const NOTICE_TONES = {
  info: { icon: Info, cls: "bg-primary-soft text-primary border-primary-soft" },
  warning: { icon: TriangleAlert, cls: "bg-warning-soft text-warning border-warning-soft" },
  error: { icon: CircleAlert, cls: "bg-danger-soft text-danger border-danger-soft" },
};

export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: keyof typeof NOTICE_TONES;
  children: ReactNode;
  className?: string;
}) {
  const { icon: Icon, cls } = NOTICE_TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-xl border p-3 text-sm", cls, className)}
    >
      <Icon size={16} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Spinner({ label = "読み込み中" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted" role="status">
      <LoaderCircle size={20} strokeWidth={2} className="animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-surface-muted px-6 py-10 text-center">
      <Icon size={24} strokeWidth={2} className="text-muted" aria-hidden />
      <p className="font-medium">{title}</p>
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, backHref, action }: { title: string; backHref?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-3">
      {backHref && (
        <Link
          href={backHref}
          aria-label="戻る"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-surface-muted"
        >
          <BackIcon />
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h1>
      {action}
    </div>
  );
}

// chevron-left（Server Component からも使えるよう直接 SVG を描く）
function BackIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function Chip({
  selected,
  icon: Icon,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; icon?: LucideIcon }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition disabled:opacity-50",
        selected ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-foreground hover:bg-surface-muted",
        props.className,
      )}
    >
      {Icon && <Icon size={16} strokeWidth={2} aria-hidden />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-xl border border-border bg-surface px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft";
