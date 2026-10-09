import { ArrowRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { ImageWithFallback } from "./ImageWithFallback";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";

interface CTAProps {
  onGetStartedClick?: () => void;
}

export function CTA({ onGetStartedClick }: CTAProps) {
  const benefits = [
    "Start free with your existing data",
    "No technical setup required",
    "24/7 customer support",
    "Cancel anytime",
  ];

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid lg:grid-cols-2">
              <div className="flex flex-col justify-center p-12 lg:p-16">
                <div className="space-y-6">
                  <h2 className="text-3xl font-bold lg:text-4xl">
                    Ready to Transform
                    <span className="block text-primary">
                      Your Business?
                    </span>
                  </h2>
                  <p className="text-xl text-muted-foreground">
                    Join thousands of retail owners who are already using AI to
                    make smarter business decisions. Start your free trial
                    today.
                  </p>

                  <div className="space-y-3">
                    {benefits.map((benefit, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-4 pt-4 sm:flex-row">
                    <Button
                      size="lg"
                      className="gap-2"
                      onClick={onGetStartedClick}
                    >
                      Start Free Trial
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() =>
                        toast.success(
                          "Demo scheduled! We'll contact you shortly.",
                        )
                      }
                    >
                      Schedule Demo
                    </Button>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    No credit card required | 14-day free trial | Setup in
                    minutes
                  </p>
                </div>
              </div>

              <div className="relative bg-gradient-to-br from-primary/5 to-primary/10">
                <ImageWithFallback
                  src="https://clotouch.com/wp-content/uploads/2025/10/learn-6-smart-clothing-store-pos-software-strategies-for-india-featured.jpg"
                  alt="Business analytics and data visualization"
                  className="h-full min-h-[400px] w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent"></div>

                <div className="absolute left-8 top-8 rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur">
                  <div className="text-sm">
                    <div className="text-muted-foreground">
                      Average Improvement
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      +34%
                    </div>
                    <div className="text-muted-foreground">
                      Decision Speed
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-8 right-8 rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur">
                  <div className="text-sm">
                    <div className="text-muted-foreground">
                      Time Saved Weekly
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      12 hrs
                    </div>
                    <div className="text-muted-foreground">
                      On Data Analysis
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
