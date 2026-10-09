import { Button } from "./ui/button";
import { Menu } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  onSignInClick?: () => void;
  onGetStartedClick?: () => void;
  onSupportClick?: () => void;
}

export function Header({ onSignInClick, onGetStartedClick, onSupportClick }: HeaderProps) {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Logo />
        
        <nav className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
            How It Works
          </a>
          <a href="#demo" className="text-muted-foreground hover:text-foreground transition-colors">
            Demo
          </a>
          <button
            onClick={onSupportClick}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Support
          </button>
        </nav>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button 
            variant="ghost" 
            className="hidden md:inline-flex"
            onClick={onSignInClick}
          >
            Sign In
          </Button>
          <Button onClick={onGetStartedClick}>
            Get Started
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
