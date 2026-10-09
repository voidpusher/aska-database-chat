import {
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { Separator } from "./ui/separator";
import { Logo } from "./Logo";

interface FooterProps {
  onSupportClick?: () => void;
  onPricingClick?: () => void;
}

export function Footer({ onSupportClick, onPricingClick }: FooterProps) {
  const footerSections = [
    {
      title: "Product",
      links: [
        "Features",
        "Demo",
        "Pricing",
        "API Documentation",
        "Integrations",
      ],
    },
    {
      title: "Company",
      links: [
        "About Us",
        "Careers",
        "Press",
        "Partners",
        "Contact",
      ],
    },
    {
      title: "Resources",
      links: [
        "Help Center",
        "Community",
        "Tutorials",
        "Blog",
        "Status",
      ],
    },
    {
      title: "Legal",
      links: [
        "Privacy Policy",
        "Terms of Service",
        "Cookie Policy",
        "GDPR",
        "Security",
      ],
    },
  ];

  return (
    <footer className="bg-muted/30 border-t">
      <div className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Logo textClassName="text-xl font-bold" />
            <p className="text-muted-foreground max-w-md">
              Retail analytics for sales, inventory, orders, and
              customer insights in one place.
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>hello@orrico.ai</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4" />
                <span>+91 9871074567</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>Dwarka, Delhi, India</span>
              </div>
            </div>
          </div>

          {footerSections.map((section) => (
            <div key={section.title} className="space-y-4">
              <h4 className="font-semibold">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link) => {
                  const isSupportLink = link === "Help Center" || link === "Contact";
                  const isPricingLink = link === "Pricing";

                  return (
                    <li key={link}>
                      {isPricingLink ? (
                        <a
                          href="#pricing"
                          onClick={onPricingClick}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link}
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={isSupportLink ? onSupportClick : undefined}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                        >
                          {link}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            (c) 2026 Aska.
          </p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </button>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms
            </button>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cookies
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
