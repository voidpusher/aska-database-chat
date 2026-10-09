import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { 
  Mic, 
  Database, 
  BarChart3, 
  Clock, 
  Shield, 
  Smartphone 
} from "lucide-react";

export function Features() {
  const features = [
    {
      icon: Mic,
      title: "Voice-First Interface",
      description: "Simply speak your questions in natural language. No complex queries or technical knowledge required.",
      color: "text-blue-600"
    },
    {
      icon: Database,
      title: "Universal Database Support",
      description: "Connect to any database system - MySQL, PostgreSQL, MongoDB, or even Excel spreadsheets.",
      color: "text-green-600"
    },
    {
      icon: BarChart3,
      title: "Instant Analytics",
      description: "Get real-time insights about sales, inventory, customer trends, and business performance.",
      color: "text-purple-600"
    },
    {
      icon: Clock,
      title: "24/7 Availability",
      description: "Access your business data anytime, anywhere. Perfect for busy retail owners on the go.",
      color: "text-orange-600"
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your data stays protected with enterprise-grade security and privacy controls.",
      color: "text-red-600"
    },
    {
      icon: Smartphone,
      title: "Mobile Optimized",
      description: "Works seamlessly on any device - phone, tablet, or computer. Manage your store from anywhere.",
      color: "text-indigo-600"
    }
  ];

  return (
    <section id="features" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold mb-4">
            Everything You Need to
            <span className="text-primary block">Grow Your Business</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed specifically for retail businesses. 
            Get insights that help you make better decisions faster.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}