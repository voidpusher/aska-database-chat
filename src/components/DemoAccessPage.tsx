import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Database,
  Loader2,
  MessageSquareText,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface DemoAccessPageProps {
  onBack: () => void;
  onCreateAccount: () => void;
  onEnterDemo: () => Promise<void>;
}

const previewMetrics = [
  { label: "Today's sales", value: "Rs 1,96,400", change: "+12.4%" },
  { label: "Orders", value: "29", change: "+8.1%" },
  { label: "Low stock", value: "4 items", change: "Needs review" },
];

const sampleQuestions = [
  "What were my sales yesterday?",
  "Which products are running low?",
  "Show my best customers this month",
];

export function DemoAccessPage({
  onBack,
  onCreateAccount,
  onEnterDemo,
}: DemoAccessPageProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState("");

  const handleEnterDemo = async () => {
    setIsOpening(true);
    setError("");

    try {
      await onEnterDemo();
    } catch (demoError) {
      setError(
        demoError instanceof Error
          ? demoError.message
          : "The demo workspace could not be opened.",
      );
      setIsOpening(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <button type="button" onClick={onBack} aria-label="Back to home">
            <Logo />
          </button>
          <div className="flex items-center gap-2">

            <Button variant="ghost" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to home</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 lg:py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-7">
            <Badge variant="secondary" className="gap-2 rounded-full px-3 py-1">
              <Sparkles className="h-3.5 w-3.5" />
              Preloaded demo workspace
            </Badge>

            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
                Take Aska for a spin.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-muted-foreground">
                Open a separate sample workspace with products, orders, customers,
                and sales history already loaded. Nothing you do here affects a
                real shop account.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-lg border border-border/70 bg-card p-4">
                <Database className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">Ready immediately</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    No signup or database setup required.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-border/70 bg-card p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">Fully isolated</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Demo data stays separate from real accounts.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="gap-2"
                onClick={handleEnterDemo}
                disabled={isOpening}
              >
                {isOpening ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquareText className="h-4 w-4" />
                )}
                {isOpening ? "Opening workspace..." : "Open Demo Workspace"}
              </Button>
              <Button size="lg" variant="outline" onClick={onCreateAccount} className="gap-2">
                Create my own shop
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)]">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div>
                <p className="font-semibold">Gupta Electronics</p>
                <p className="text-sm text-muted-foreground">Demo workspace</p>
              </div>
              <Badge variant="outline" className="gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Sample data live
              </Badge>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                {previewMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-lg border border-border/70 bg-background/65 p-4">
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                    <p className="mt-2 text-xl font-semibold">{metric.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{metric.change}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border/70 bg-background/65 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <p className="font-medium">Seven-day revenue</p>
                  </div>
                  <span className="text-sm text-green-600">+9.6%</span>
                </div>
                <div className="flex h-32 items-end gap-2" aria-label="Sample seven-day revenue chart">
                  {[46, 62, 55, 78, 68, 86, 74].map((height, index) => (
                    <div key={index} className="flex h-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-primary/80 transition-opacity hover:opacity-75"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/65 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <PackageCheck className="h-4 w-4" />
                  <p className="font-medium">Ask Aska</p>
                </div>
                <div className="space-y-2">
                  {sampleQuestions.map((question) => (
                    <div key={question} className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                      {question}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
