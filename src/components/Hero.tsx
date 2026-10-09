import { Mic, Database, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ImageWithFallback } from "./ImageWithFallback";

interface HeroProps {
  onGetStartedClick?: () => void;
}

export function Hero({ onGetStartedClick }: HeroProps) {
  return (
    <section className="bg-gradient-to-b from-background to-muted/20 py-20 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-8">
            <Badge variant="secondary" className="w-fit">
              <Zap className="mr-1 h-4 w-4" />
              AI-Powered Database Chat
            </Badge>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-tight lg:text-6xl">
                Ask Your Store Data
                <span className="block text-primary">
                  Anything, Anytime
                </span>
              </h1>
              <p className="max-w-lg text-xl text-muted-foreground">
                Transform how you manage your retail business. Simply speak to
                get instant insights from your inventory, sales, and customer
                data.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                className="gap-2"
                onClick={() => {
                  toast.info("Voice demo: sign up to try it live.");
                  onGetStartedClick?.();
                }}
              >
                <Mic className="h-5 w-5" />
                Try Voice Demo
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={() => {
                  const featuresSection =
                    document.getElementById("features");
                  featuresSection?.scrollIntoView({
                    behavior: "smooth",
                  });
                }}
              >
                <Database className="h-5 w-5" />
                View Features
              </Button>
            </div>

            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span>Works with any database</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                <span>Natural language queries</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl shadow-2xl">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1745340706418-489eb5cad9d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXRhaWwlMjBzdG9yZSUyMHNob3BrZWVwZXIlMjBzbWFsbCUyMGJ1c2luZXNzfGVufDF8fHx8MTc1ODcwODg3MHww&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Retail store owner managing inventory"
                className="h-[500px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>

            <div className="absolute -right-4 -top-4 rounded-lg border bg-background p-4 shadow-lg">
              <div className="flex items-center gap-2 text-sm">
                <Mic className="h-4 w-4 text-primary" />
                <span>"Show me today's sales"</span>
              </div>
            </div>

            <div className="absolute -bottom-4 -left-4 rounded-lg border bg-background p-4 shadow-lg">
              <div className="text-sm">
                <div className="font-medium">Today's Revenue</div>
                <div className="text-2xl font-bold text-green-600">
                  Rs 69,000
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
