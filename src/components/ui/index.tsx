import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variant === "primary" && "bg-ember text-white hover:bg-ember-dark",
        variant === "secondary" && "bg-white border border-line text-ink hover:border-ink-950",
        variant === "ghost" && "text-muted hover:text-ink hover:bg-black/5",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx("bg-paper-raised border border-line rounded-lg", className)}>
      {children}
    </div>
  );
}

const STAT_CARD_TONES: Record<string, { border: string; bg: string; label: string }> = {
  sage: { border: "border-sage/30", bg: "bg-sage-light", label: "text-sage" },
  ember: { border: "border-ember/25", bg: "bg-ember/5", label: "text-ember-dark" },
  marigold: { border: "border-marigold/30", bg: "bg-marigold/10", label: "text-[#006e85]" },
};

export function StatCard({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  /** Resalta la tarjeta con un color de acento — opcional, no afecta las pantallas que no lo pasan (ej. Dashboard). */
  tone?: "sage" | "ember" | "marigold";
}) {
  const t = tone ? STAT_CARD_TONES[tone] : null;
  return (
    <Card className={clsx("ticket-edge p-5", t && `border ${t.border} ${t.bg}`)}>
      <p className={clsx("text-xs font-medium uppercase tracking-wide", t ? t.label : "text-muted")}>{label}</p>
      <p className="font-display text-3xl font-semibold mt-1.5">{value}</p>
      {sublabel && <p className="text-xs text-muted mt-1">{sublabel}</p>}
    </Card>
  );
}

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-sage-light text-sage",
  SUSPENDED: "bg-ember/10 text-ember-dark",
  active: "bg-sage-light text-sage",
  inactive: "bg-black/5 text-muted",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status] ?? "bg-black/5 text-muted"
      )}
    >
      {label}
    </span>
  );
}
