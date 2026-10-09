import { useState, useEffect } from "react";
import { api, type BillingPlan, type BillingStatusResponse } from "../lib/api";

interface Props {
  onBack: () => void;
  onLogout: () => void;
}

const PLAN_DESCRIPTIONS: Record<string, string> = {
  free: "Get started for free. No credit card required.",
  pro: "For growing businesses that need more power.",
  enterprise: "Unlimited scale. Priority support included.",
};

const PLAN_BADGE: Record<string, string> = {
  pro: "Most Popular",
};

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <div className="text-xs text-muted-foreground">
        {used.toLocaleString()} messages used — unlimited
      </div>
    );
  }
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{used.toLocaleString()} / {limit.toLocaleString()} messages this month</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  isCurrent,
  stripeEnabled,
  onUpgrade,
  onManage,
  loading,
}: {
  plan: BillingPlan;
  isCurrent: boolean;
  stripeEnabled: boolean;
  onUpgrade: (key: string) => void;
  onManage: () => void;
  loading: string | null;
}) {
  const isHighlighted = plan.key === "pro";
  const badge = PLAN_BADGE[plan.key];

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-shadow
        ${isHighlighted
          ? "border-primary shadow-lg shadow-primary/10"
          : "border-border"
        }
        ${isCurrent ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background" : ""}
      `}
    >
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
          {badge}
        </span>
      )}
      {isCurrent && (
        <span className="absolute -top-3 right-4 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-semibold text-white">
          Current plan
        </span>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{PLAN_DESCRIPTIONS[plan.key]}</p>
      </div>

      <div className="mb-6 flex items-end gap-1">
        <span className="text-4xl font-bold text-foreground">
          ${plan.priceMonthly}
        </span>
        <span className="mb-1 text-sm text-muted-foreground">/ month</span>
      </div>

      <ul className="mb-6 flex-1 space-y-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
            <CheckIcon />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {isCurrent ? (
        plan.priceMonthly > 0 && stripeEnabled ? (
          <button
            onClick={onManage}
            disabled={loading !== null}
            className="w-full rounded-lg border border-border py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            {loading === "portal" ? "Redirecting…" : "Manage subscription"}
          </button>
        ) : (
          <div className="w-full rounded-lg bg-emerald-50 py-2 text-center text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Active plan
          </div>
        )
      ) : plan.priceMonthly === 0 ? (
        <div className="w-full rounded-lg bg-muted py-2 text-center text-sm font-medium text-muted-foreground">
          Free forever
        </div>
      ) : !stripeEnabled ? (
        <div className="w-full rounded-lg bg-muted py-2 text-center text-sm text-muted-foreground">
          Billing not configured
        </div>
      ) : (
        <button
          onClick={() => onUpgrade(plan.key)}
          disabled={loading !== null}
          className={`w-full rounded-lg py-2 text-sm font-semibold transition disabled:opacity-50
            ${isHighlighted
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border border-border text-foreground hover:bg-muted"
            }`}
        >
          {loading === plan.key ? "Redirecting…" : `Upgrade to ${plan.name}`}
        </button>
      )}
    </div>
  );
}

export function PricingPage({ onBack, onLogout }: Props) {
  const [status, setStatus] = useState<BillingStatusResponse | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    api.billingStatus()
      .then(setStatus)
      .catch(() => setFetchError("Could not load billing info. Please try again."));
  }, []);

  async function handleUpgrade(planKey: string) {
    setLoading(planKey);
    setError(null);
    try {
      const { url } = await api.billingCheckout(planKey);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setLoading(null);
    }
  }

  async function handleManage() {
    setLoading("portal");
    setError(null);
    try {
      const { url } = await api.billingPortal();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open billing portal.");
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back
          </button>
          <span className="text-sm font-semibold text-foreground">Aska</span>
          <button
            onClick={onLogout}
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12">
        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Simple, transparent pricing
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Start free. Upgrade when you need more. Cancel anytime.
          </p>
        </div>

        {/* Current usage */}
        {status && (
          <div className="mb-10 rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Your usage this month —{" "}
                <span className="text-primary">{status.plan.name} plan</span>
              </p>
            </div>
            <UsageBar
              used={status.usage.messagesThisMonth}
              limit={status.usage.messagesLimit}
            />
          </div>
        )}

        {fetchError && (
          <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {fetchError}
          </div>
        )}

        {error && (
          <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Plan cards */}
        {status ? (
          <div className="grid gap-6 md:grid-cols-3">
            {status.plans.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                isCurrent={status.plan.key === plan.key}
                stripeEnabled={status.stripeEnabled}
                onUpgrade={handleUpgrade}
                onManage={handleManage}
                loading={loading}
              />
            ))}
          </div>
        ) : !fetchError ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 animate-pulse rounded-2xl border border-border bg-muted" />
            ))}
          </div>
        ) : null}

        {/* FAQ */}
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {[
            {
              q: "What counts as a chat message?",
              a: "Every question you send to the AI chat counts as one message. Dashboard views, data imports, and database connections do not count.",
            },
            {
              q: "Can I switch plans any time?",
              a: "Yes. Upgrades take effect immediately. Downgrades take effect at the end of your billing period.",
            },
            {
              q: "What happens when I hit the message limit?",
              a: "Chat is paused until the next calendar month or until you upgrade. All other features — dashboard, data imports, connections — remain fully available.",
            },
            {
              q: "Do you offer a refund?",
              a: "Yes, we offer a full refund within 7 days of any charge. Just email support and we'll sort it out.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-xl border border-border p-5">
              <p className="font-medium text-foreground">{q}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{a}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
