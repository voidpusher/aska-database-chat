import {
  ArrowLeft,
  Book,
  Clock,
  Mail,
  MessageCircle,
  Phone,
  Users,
  Video,
} from "lucide-react";
import { Logo } from "./Logo";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

interface SupportPageProps {
  onBackToHome: () => void;
  onNavigateToAuth: () => void;
}

export function SupportPage({
  onBackToHome,
  onNavigateToAuth,
}: SupportPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/35">
      <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBackToHome}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            <Logo iconClassName="h-6 w-6" />
          </div>
          <Button onClick={onNavigateToAuth}>Sign In</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 sm:py-12">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center rounded-full border border-border/70 bg-card/85 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground shadow-sm backdrop-blur">
            Support Centre
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Need a hand with your store setup?
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-muted-foreground">
            Reach the Aska team for onboarding help, reporting questions, or
            day-to-day product support across your retail workflow.
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-6 w-6 text-primary" />
                <CardTitle>Live Chat</CardTitle>
              </div>
              <CardDescription>
                Get instant help from the support team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  24/7 Available
                </Badge>
              </div>
              <Button className="w-full">Start Chat</Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Phone className="h-6 w-6 text-primary" />
                <CardTitle>Phone Support</CardTitle>
              </div>
              <CardDescription>
                Speak directly with a support specialist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  Mon-Fri 9AM-6PM
                </Badge>
              </div>
              <Button variant="outline" className="w-full">
                Call +91 9871074567
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="h-6 w-6 text-primary" />
                <CardTitle>Email Support</CardTitle>
              </div>
              <CardDescription>
                Send a detailed note to the support desk.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  24hr Response
                </Badge>
              </div>
              <Button variant="outline" className="w-full">
                Email Us
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mb-12">
          <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">
            Self-Help Resources
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="cursor-pointer bg-card/88 transition-transform duration-200 hover:-translate-y-1">
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/80 shadow-sm">
                  <Book className="h-7 w-7 text-primary" />
                </div>
                <CardTitle>Documentation</CardTitle>
                <CardDescription>
                  Comprehensive guides and setup walkthroughs.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer bg-card/88 transition-transform duration-200 hover:-translate-y-1">
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/80 shadow-sm">
                  <Video className="h-7 w-7 text-primary" />
                </div>
                <CardTitle>Video Tutorials</CardTitle>
                <CardDescription>
                  Step-by-step walkthroughs for store teams.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer bg-card/88 transition-transform duration-200 hover:-translate-y-1">
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/80 shadow-sm">
                  <Users className="h-7 w-7 text-primary" />
                </div>
                <CardTitle>Community</CardTitle>
                <CardDescription>
                  Learn from other retailers and operators.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer bg-card/88 transition-transform duration-200 hover:-translate-y-1">
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/80 shadow-sm">
                  <MessageCircle className="h-7 w-7 text-primary" />
                </div>
                <CardTitle>FAQ</CardTitle>
                <CardDescription>
                  Quick answers for common product questions.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">
            Frequently Asked Questions
          </h2>
          <div className="mx-auto max-w-3xl space-y-6">
            <Card className="bg-card/90">
              <CardHeader>
                <CardTitle>How do I connect my store data?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Aska supports modern retail connection workflows through the
                  setup page. Choose your preferred source, review the required
                  fields, and follow the guided connection steps.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/90">
              <CardHeader>
                <CardTitle>
                  What kind of voice and text input does Aska support?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  The current experience is optimized for English-language
                  voice and text input, with a conversational flow designed for
                  day-to-day business questions from store owners and operators.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/90">
              <CardHeader>
                <CardTitle>Is my business data secure?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes. The product is designed around controlled access, secure
                  account flows, and clear connection management so business
                  information stays limited to authorised use.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/90">
              <CardHeader>
                <CardTitle>
                  Can I explore Aska before connecting my own data?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes. You can explore the experience through the built-in demo
                  flow and evaluate the reporting, chat, and setup experience
                  before using it with your own data.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/90">
              <CardHeader>
                <CardTitle>How should I use voice queries effectively?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Voice input is meant to make everyday business questions
                  faster to ask. Results depend on the connected data and the
                  phrasing of the request, so the best experience comes from
                  clear store and reporting data.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="rounded-[1.75rem] bg-primary px-8 py-10 text-center text-primary-foreground shadow-[0_24px_70px_-34px_rgba(17,24,39,0.55)]">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight">
            Still Need Help?
          </h2>
          <p className="mb-6 text-lg opacity-90">
            Our team is available to help you get the best out of your
            reporting, setup, and store operations workflow.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button variant="secondary" size="lg">
              <MessageCircle className="mr-2 h-5 w-5" />
              Start Live Chat
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-primary-foreground bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary"
            >
              <Phone className="mr-2 h-5 w-5" />
              Schedule a Call
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
