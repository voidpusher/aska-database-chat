import { useState, useEffect } from "react";
import { LandingPage } from "./components/LandingPage";
import { AuthPage } from "./components/AuthPage";
import { SupportPage } from "./components/SupportPage";
import { ChatPage } from "./components/ChatPage";
import { DashboardPage } from "./components/DashboardPage";
import { DatabaseConnectionPage } from "./components/DatabaseConnectionPage";
import { ShopSetupPage } from "./components/ShopSetupPage";
import { PricingPage } from "./components/PricingPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider } from "./components/ThemeProvider";
import { api } from "./lib/api";
import {
  safeJsonParse,
  safeStorageGet,
  safeStorageRemove,
  safeStorageSet,
} from "./lib/storage";

type Page =
  | "landing"
  | "auth"
  | "support"
  | "chat"
  | "dashboard"
  | "database"
  | "setup"
  | "pricing";

interface SessionUser {
  id?: string;
  authProvider?: string;
  businessName?: string;
  firstName?: string;
}

function workspacePageKey(user?: SessionUser | null) {
  const account = user || safeJsonParse<SessionUser | null>(safeStorageGet("orrico_current_user"), null);
  return `aska_last_page_${account?.id || "guest"}`;
}

function getShopSetupKey(userId: string) {
  return `orrico_shop_setup_${userId}`;
}

function hasCompletedShopSetup(user: SessionUser | null) {
  if (!user?.id) {
    return false;
  }

  if (user.authProvider === "demo") {
    return true;
  }

  return Boolean(safeStorageGet(getShopSetupKey(user.id)));
}

function getNextPageForUser(
  user: SessionUser | null,
  lastPage: string | null,
): Page {
  if (!user) {
    return "auth";
  }

  return lastPage === "chat" ||
    lastPage === "dashboard" ||
    lastPage === "database"
    ? lastPage
    : user.authProvider === "demo" ? "chat" : "database";
}

export default function App() {
  const [currentPage, setCurrentPage] =
    useState<Page>("landing");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authContext, setAuthContext] = useState<{
    mode?: "verify" | "reset";
    email?: string;
    token?: string;
  }>({});

  useEffect(() => { window.scrollTo(0, 0); }, [currentPage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authMode = params.get("auth");
    const email = params.get("email") || "";
    const token = params.get("token") || "";

    if (authMode === "verify" || authMode === "reset") {
      setAuthContext({
        mode: authMode,
        email,
        token,
      });
      setCurrentPage("auth");
    }

    // Always probe the session endpoint - real sessions use httpOnly cookies
    // (no localStorage token needed). Only the offline demo token is in localStorage.
    api
      .session()
      .then((session) => {
        const lastPage = safeStorageGet(workspacePageKey(session.user as SessionUser));
        safeStorageSet(
          "orrico_current_user",
          JSON.stringify(session.user),
        );
        setIsLoggedIn(true);
        if (authMode !== "verify" && authMode !== "reset") setCurrentPage(getNextPageForUser(session.user as SessionUser, lastPage));
      })
      .catch(() => {
        safeStorageRemove("orrico_auth_token");
        safeStorageRemove("orrico_current_user");
      });
  }, []);

  const handleLogin = (user?: SessionUser) => {
    const currentUser =
      user ||
      safeJsonParse<SessionUser | null>(
        safeStorageGet("orrico_current_user"),
        null,
      );
    setIsLoggedIn(true);
    setCurrentPage(
      getNextPageForUser(currentUser, safeStorageGet(workspacePageKey(currentUser))),
    );
  };

  const handleLogout = () => {
    api.logout().catch(() => undefined);
    safeStorageRemove("orrico_auth_token");
    safeStorageRemove("orrico_current_user");
    safeStorageRemove("orrico_last_page");
    safeStorageRemove("orrico_db_connection");
    setIsLoggedIn(false);
    setCurrentPage("landing");
  };

  const handleDatabaseConnectionComplete = () => {
    safeStorageSet(workspacePageKey(), "chat");
    setCurrentPage("chat");
  };

  const handleShopSetupComplete = (profile: Record<string, string>) => {
    const currentUser = safeJsonParse<SessionUser | null>(
      safeStorageGet("orrico_current_user"),
      null,
    );

    if (currentUser?.id) {
      safeStorageSet(
        getShopSetupKey(currentUser.id),
        JSON.stringify({
          ...profile,
          completedAt: new Date().toISOString(),
        }),
      );
    }

    setCurrentPage("database");
  };

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <div className="min-h-screen bg-background">
          {currentPage === "landing" && (
            <LandingPage
              onNavigateToAuth={() => setCurrentPage("auth")}
              onNavigateToSupport={() =>
                setCurrentPage("support")
              }
            />
          )}
          {currentPage === "auth" && (
            <AuthPage
              initialMode={authContext.mode}
              initialEmail={authContext.email}
              initialToken={authContext.token}
              onBackToHome={() => setCurrentPage("landing")}
              onNavigateToSupport={() =>
                setCurrentPage("support")
              }
              onLogin={handleLogin}
            />
          )}
          {currentPage === "support" && (
            <SupportPage
              onBackToHome={() => setCurrentPage("landing")}
              onNavigateToAuth={() => setCurrentPage("auth")}
            />
          )}
          {currentPage === "database" && isLoggedIn && (
            <DatabaseConnectionPage
              onComplete={handleDatabaseConnectionComplete}
              onLogout={handleLogout}
            />
          )}
          {currentPage === "setup" && isLoggedIn && (
            <ShopSetupPage
              onComplete={handleShopSetupComplete}
              onLogout={handleLogout}
            />
          )}
          {currentPage === "pricing" && isLoggedIn && (
            <PricingPage
              onBack={() => setCurrentPage(
                (safeStorageGet(workspacePageKey()) as Page) || "chat"
              )}
              onLogout={handleLogout}
            />
          )}
          {currentPage === "chat" && isLoggedIn && (
            <ChatPage
              onLogout={handleLogout}
              onNavigateToSupport={() =>
                setCurrentPage("support")
              }
              onNavigateToDashboard={() => {
                safeStorageSet(
                  workspacePageKey(),
                  "dashboard",
                );
                setCurrentPage("dashboard");
              }}
              onNavigateToLanding={() =>
                setCurrentPage("landing")
              }
              onNavigateToPricing={() => setCurrentPage("pricing")}
            />
          )}
          {currentPage === "dashboard" && isLoggedIn && (
            <DashboardPage
              onLogout={handleLogout}
              onNavigateToSupport={() =>
                setCurrentPage("support")
              }
              onNavigateToChat={() => {
                safeStorageSet(workspacePageKey(), "chat");
                setCurrentPage("chat");
              }}
              onNavigateToLanding={() =>
                setCurrentPage("landing")
              }
            />
          )}
          <Toaster />
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
