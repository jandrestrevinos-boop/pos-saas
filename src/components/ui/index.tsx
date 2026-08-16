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

export function StatCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <Card className="ticket-edge p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
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
