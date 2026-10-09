import { Header } from "./Header";
import { Hero } from "./Hero";
import { Features } from "./Features";
import { HowItWorks } from "./HowItWorks";
import { ChatDemo } from "./ChatDemo";
import { LandingPricing } from "./LandingPricing";
import { CTA } from "./CTA";
import { Footer } from "./Footer";

interface LandingPageProps {
  onNavigateToAuth?: () => void;
  onNavigateToSignIn?: () => void;
  onNavigateToDemo?: () => void;
  onNavigateToSupport?: () => void;
}

export function LandingPage({
  onNavigateToAuth,
  onNavigateToSignIn,
  onNavigateToDemo,
  onNavigateToSupport,
}: LandingPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header
        onSignInClick={onNavigateToSignIn || onNavigateToAuth}
        onGetStartedClick={onNavigateToAuth}
        onDemoClick={onNavigateToDemo}
        onSupportClick={onNavigateToSupport}
      />
      <main>
        <Hero
          onGetStartedClick={onNavigateToAuth}
          onDemoClick={onNavigateToDemo}
        />
        <Features />
        <HowItWorks />
        <ChatDemo />
        <LandingPricing onGetStartedClick={onNavigateToAuth} />
        <CTA onGetStartedClick={onNavigateToAuth} />
      </main>
      <Footer onSupportClick={onNavigateToSupport} />
    </div>
  );
}
