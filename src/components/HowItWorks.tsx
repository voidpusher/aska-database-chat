import {
  BarChart3,
  Database,
  MessageSquare,
  Mic,
} from "lucide-react";
import { ImageWithFallback } from "./ImageWithFallback";
import { Card, CardContent } from "./ui/card";

export function HowItWorks() {
  const steps = [
    {
      icon: Database,
      title: "Connect Your Data",
      description:
        "Link your existing databases, POS systems, or upload spreadsheets. We support all major formats.",
      step: "01",
    },
    {
      icon: Mic,
      title: "Ask Questions Naturally",
      description:
        "Simply speak or type your questions in plain English. No need to learn complex database languages.",
      step: "02",
    },
    {
      icon: MessageSquare,
      title: "Get Instant Answers",
      description:
        "Our AI understands your business context and provides relevant, accurate answers in seconds.",
      step: "03",
    },
    {
      icon: BarChart3,
      title: "Make Better Decisions",
      description:
        "Use insights to optimize inventory, understand customers, and grow your business strategically.",
      step: "04",
    },
  ];

  return (
    <section id="how-it-works" className="bg-muted/30 py-20">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold lg:text-5xl">
            How It
            <span className="text-primary"> Works</span>
          </h2>
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
            Get started in minutes. No technical expertise required - just
            connect your data and start asking questions.
          </p>
        </div>

        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div className="space-y-8">
            {steps.map((step, index) => (
              <Card key={index} className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <step.icon className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="rounded bg-primary/10 px-2 py-1 text-sm font-medium text-primary">
                          {step.step}
                        </span>
                        <h3 className="font-semibold">{step.title}</h3>
                      </div>
                      <p className="leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-2xl shadow-2xl">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1641567535859-c58187ac4954?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB0ZWNoJTIwaW50ZXJmYWNlJTIwZGFzaGJvYXJkfGVufDF8fHx8MTc1ODcwODc4OXww&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Modern tech dashboard interface"
                className="h-[500px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent"></div>
            </div>

            <div className="absolute right-4 top-4 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
              <div className="text-sm">
                <div className="text-muted-foreground">Setup Time</div>
                <div className="font-bold text-green-600">
                  &lt; 5 minutes
                </div>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
              <div className="text-sm">
                <div className="text-muted-foreground">Query Speed</div>
                <div className="font-bold text-blue-600">
                  &lt; 2 seconds
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
