import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { Logo } from "./Logo";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Building2,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "../lib/api";
import { safeStorageRemove, safeStorageSet } from "../lib/storage";

const shopkeeperImage = new URL(
  "../assets/2609b7d59d0b4c5c57d1b7fab24a98ad05088a2f.png",
  import.meta.url,
).href;

interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface SignupForm {
  firstName: string;
  lastName: string;
  email: string;
  businessName: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

interface VerificationForm {
  email: string;
  token: string;
}

interface ForgotPasswordForm {
  email: string;
}

interface ResetPasswordForm {
  email: string;
  token: string;
  password: string;
  confirmPassword: string;
}

interface AuthPageProps {
  onBackToHome?: () => void;
  onNavigateToSupport?: () => void;
  onNavigateToDemo?: () => void;
  onLogin?: (user?: Record<string, unknown>) => void;
  initialMode?: "verify" | "reset";
  initialView?: "login" | "signup";
  initialEmail?: string;
  initialToken?: string;
}

export function AuthPage({
  onBackToHome,
  onNavigateToSupport,
  onNavigateToDemo,
  onLogin,
  initialMode,
  initialView = "login",
  initialEmail,
  initialToken,
}: AuthPageProps) {
  const [authMode, setAuthMode] = useState<
    "login" | "signup" | "verify" | "forgot" | "reset"
  >(initialMode || initialView);
  const isLogin = authMode === "login";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [entryMode, setEntryMode] = useState<"customer" | "demo">("customer");

  const loginForm = useForm<LoginForm>();
  const signupForm = useForm<SignupForm>();
  const verificationForm = useForm<VerificationForm>();
  const forgotPasswordForm = useForm<ForgotPasswordForm>();
  const resetPasswordForm = useForm<ResetPasswordForm>();
  useEffect(() => {
    if (initialEmail) {
      verificationForm.setValue("email", initialEmail);
      forgotPasswordForm.setValue("email", initialEmail);
      resetPasswordForm.setValue("email", initialEmail);
    }

    if (initialToken) {
      verificationForm.setValue("token", initialToken);
      resetPasswordForm.setValue("token", initialToken);
    }
  }, [
    forgotPasswordForm,
    initialEmail,
    initialToken,
    resetPasswordForm,
    verificationForm,
  ]);

  const persistSession = (token: string, user: unknown) => {
    // Only store the token locally for the offline demo session.
    // Real server sessions use httpOnly cookies set by the server.
    if (token === "local-demo-session") {
      safeStorageSet("orrico_auth_token", token);
    } else {
      safeStorageRemove("orrico_auth_token");
    }
    safeStorageSet(
      "orrico_current_user",
      JSON.stringify(user),
    );
  };

  const onLoginSubmit = async (data: LoginForm) => {
    setIsLoading(true);

    try {
      const session = await api.login({
        email: data.email,
        password: data.password,
      });

      persistSession(session.token, session.user);
      setIsLoading(false);
      toast.success(
        "Welcome back! Opening your workspace…",
      );
      setTimeout(() => {
        onLogin?.(session.user as Record<string, unknown>);
      }, 1000);
    } catch (error) {
      setIsLoading(false);
      const authError = error as Error & {
        status?: number;
        details?: {
          requiresEmailVerification?: boolean;
          email?: string;
          verificationToken?: string;
        };
      };

      if (
        authError.status === 403 &&
        authError.details?.requiresEmailVerification
      ) {
        verificationForm.setValue(
          "email",
          authError.details.email || data.email,
        );
        verificationForm.setValue(
          "token",
          authError.details.verificationToken || "",
        );
        setAuthMode("verify");
        toast.error(
          "This account still needs email verification. Check your inbox or resend the token.",
        );
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : "Login failed. Please try again.",
      );
      loginForm.setError("email", {
        message: "Invalid credentials",
      });
      loginForm.setError("password", {
        message: "Invalid credentials",
      });
    }
  };

  const onSignupSubmit = async (data: SignupForm) => {
    if (!data.agreeToTerms) {
      signupForm.setError("agreeToTerms", { message: "You must agree to the terms" });
      return;
    }
    if (data.password !== data.confirmPassword) {
      signupForm.setError("confirmPassword", {
        message: "Passwords do not match",
      });
      return;
    }

    if (data.password.length < 8) {
      signupForm.setError("password", {
        message: "Password must be at least 8 characters",
      });
      return;
    }

    setIsLoading(true);

    try {
      const session = await api.signup({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        businessName: data.businessName,
        password: data.password,
      });

      if (session.token) {
        persistSession(session.token, session.user);
        setIsLoading(false);
        toast.success(
          "Account created. Redirecting to your dashboard...",
        );
        setTimeout(() => {
          onLogin?.(session.user as Record<string, unknown>);
        }, 800);
        return;
      }

      setIsLoading(false);
      verificationForm.setValue("email", data.email);
      verificationForm.setValue(
        "token",
        session.verificationToken || "",
      );
      setAuthMode("verify");
      toast.success(
        session.verificationToken
          ? "Account created. Verify the email using the token shown in development."
          : "Account created. Verify your email to continue.",
      );
    } catch (error) {
      setIsLoading(false);
      const authError = error as Error & {
        status?: number;
        details?: {
          requiresEmailVerification?: boolean;
          email?: string;
          verificationToken?: string;
        };
      };

      if (
        authError.status === 409 &&
        authError.details?.requiresEmailVerification
      ) {
        verificationForm.setValue(
          "email",
          authError.details.email || data.email,
        );
        verificationForm.setValue(
          "token",
          authError.details.verificationToken || "",
        );
        setAuthMode("verify");
        toast.success(
          "This email is already registered. A verification email has been sent again.",
        );
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : "Account creation failed. Please try again.",
      );
    }
  };

  const onVerifySubmit = async (data: VerificationForm) => {
    setIsLoading(true);

    try {
      const session = await api.confirmEmailVerification(
        data.email,
        data.token,
      );
      persistSession(session.token, session.user);
      setIsLoading(false);
      toast.success("Email verified. Redirecting to your dashboard...");
      setTimeout(() => {
        onLogin?.(session.user as Record<string, unknown>);
      }, 800);
    } catch (error) {
      setIsLoading(false);
      const authError = error as Error & {
        status?: number;
        details?: {
          requiresEmailVerification?: boolean;
          email?: string;
          verificationToken?: string;
        };
      };
      if (authError.status === 403 && authError.details?.requiresEmailVerification) {
        verificationForm.setValue(
          "email",
          authError.details.email || data.email,
        );
        verificationForm.setValue(
          "token",
          authError.details.verificationToken || "",
        );
        setAuthMode("verify");
      }
      toast.error(
        error instanceof Error
          ? error.message
          : "Email verification failed.",
      );
    }
  };

  const onForgotPasswordSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true);

    try {
      const result = await api.requestPasswordReset(data.email);
      setIsLoading(false);
      resetPasswordForm.setValue("email", data.email);
      resetPasswordForm.setValue("token", result.resetToken || "");
      if (result.resetToken) {
        setAuthMode("reset");
      }
      toast.success(result.message);
    } catch (error) {
      setIsLoading(false);
      toast.error(
        error instanceof Error
          ? error.message
          : "Password reset request failed.",
      );
    }
  };

  const onResetPasswordSubmit = async (
    data: ResetPasswordForm,
  ) => {
    if (data.password !== data.confirmPassword) {
      resetPasswordForm.setError("confirmPassword", {
        message: "Passwords do not match",
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await api.confirmPasswordReset(
        data.email,
        data.token,
        data.password,
      );
      setIsLoading(false);
      setAuthMode("login");
      loginForm.setValue("email", data.email);
      toast.success(result.message);
    } catch (error) {
      setIsLoading(false);
      toast.error(
        error instanceof Error
          ? error.message
          : "Password reset failed.",
      );
    }
  };

  const benefits = [
    "Connect PostgreSQL, MySQL, or upload a CSV",
    "Ask questions in plain language",
    "Real-time analytics and insights",
    "SQL and query results you can inspect",
    "Encrypted database credentials",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            {onNavigateToSupport && (
              <Button
                variant="ghost"
                onClick={onNavigateToSupport}
              >
                Support
              </Button>
            )}
            {onBackToHome && (
              <Button
                variant="ghost"
                className="gap-2"
                onClick={onBackToHome}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          <div className="space-y-8">
            <div className="space-y-4">
              <Badge variant="secondary" className="w-fit">
                <CheckCircle className="w-4 h-4 mr-1" />
                Your data. Your workspace.
              </Badge>
              <h1 className="text-3xl lg:text-4xl font-bold">
                Transform Your Retail
                <span className="text-primary block">
                  Business Today
                </span>
              </h1>
              <p className="text-xl text-muted-foreground">
                Join growing retailers who use Aska to keep sales, stock,
                customers, and reporting in one clean operating workflow.
              </p>
            </div>

            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3"
                >
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            <div className="relative rounded-2xl overflow-hidden shadow-xl">
              <img
                src={shopkeeperImage}
                alt="Indian shopkeeper using computer in retail shop"
                className="w-full h-auto aspect-video object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent"></div>
            </div>
          </div>

          <div className="w-full max-w-md mx-auto">
            <Card className="shadow-2xl border-0">
              <CardHeader className="text-center space-y-4">
                <CardTitle className="text-2xl">
                  {authMode === "login" && "Welcome Back"}
                  {authMode === "signup" && "Create Account"}
                  {authMode === "verify" && "Verify Email"}
                  {authMode === "forgot" && "Reset Password"}
                  {authMode === "reset" && "Choose New Password"}
                </CardTitle>
                <CardDescription className="text-base">
                  {authMode === "login" &&
                    "Sign in to your account or try the live demo instantly"}
                  {authMode === "signup" &&
                    "Create your account or try the live demo to explore first"}
                  {authMode === "verify" &&
                    "Enter the verification token to activate your account"}
                  {authMode === "forgot" &&
                    "Request a reset token for your account"}
                  {authMode === "reset" &&
                    "Set a new password using your reset token"}
                </CardDescription>
                {isLogin && (
                  <div className="flex gap-2">
                    <Button type="button" variant={entryMode === "customer" ? "default" : "outline"} className="flex-1" onClick={() => setEntryMode("customer")} disabled={isLoading}>Customer Login</Button>
                    <Button type="button" variant={entryMode === "demo" ? "default" : "outline"} className="flex-1" onClick={() => setEntryMode("demo")} disabled={isLoading}>Demo Window</Button>
                  </div>
                )}
                {isLogin && entryMode === "demo" && (
                  <div className="bg-muted/50 border border-muted-foreground/20 rounded-lg p-3 text-sm">
                    <p className="text-muted-foreground"><strong>Demo Workspace</strong></p>
                    <p className="text-muted-foreground mt-1">Explore sample sales, products, customers, orders, and business chat.</p>
                  </div>
                )}
              </CardHeader>

              <CardContent className="space-y-6">
                {authMode === "login" && entryMode === "demo" && (
                  <Button type="button" className="w-full" disabled={isLoading} onClick={() => onLoginSubmit({ email: "demo@orrico.com", password: "demo123", rememberMe: false })}>
                    {isLoading ? "Opening demo..." : "Open Demo Workspace"}
                  </Button>
                )}
                {authMode === "login" && entryMode === "customer" && (
                  <form
                    onSubmit={loginForm.handleSubmit(
                      onLoginSubmit,
                    )}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="owner@dukaan.in"
                          className="pl-10"
                          {...loginForm.register("email", {
                            required: "Email is required",
                            pattern: {
                              value: /^\S+@\S+$/i,
                              message: "Invalid email address",
                            },
                          })}
                        />
                      </div>
                      {loginForm.formState.errors.email && (
                        <p className="text-sm text-destructive">
                          {
                            loginForm.formState.errors.email
                              .message
                          }
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type={
                            showPassword ? "text" : "password"
                          }
                          placeholder="Enter your password"
                          className="pl-10 pr-10"
                          {...loginForm.register("password", {
                            required: "Password is required",
                          })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-8 w-8"
                          onClick={() =>
                            setShowPassword(!showPassword)
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {loginForm.formState.errors.password && (
                        <p className="text-sm text-destructive">
                          {
                            loginForm.formState.errors.password
                              .message
                          }
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="rememberMe"
                          {...loginForm.register("rememberMe")}
                        />
                        <Label
                          htmlFor="rememberMe"
                          className="text-sm"
                        >
                          Remember me
                        </Label>
                      </div>
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        type="button"
                        onClick={() => {
                          forgotPasswordForm.setValue(
                            "email",
                            loginForm.getValues("email") || "",
                          );
                          setAuthMode("forgot");
                        }}
                      >
                        Forgot password?
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isLoading}
                      >
                        {isLoading ? "Signing in..." : "Sign In to Your Workspace"}
                      </Button>
                    </div>
                  </form>
                )}

                {authMode === "signup" && (
                  <form
                    onSubmit={signupForm.handleSubmit(
                      onSignupSubmit,
                    )}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">
                          First Name
                        </Label>
                        <Input
                          id="firstName"
                          placeholder="Arjun"
                          {...signupForm.register("firstName", {
                            required: "First name is required",
                          })}
                        />
                        {signupForm.formState.errors
                          .firstName && (
                          <p className="text-sm text-destructive">
                            {
                              signupForm.formState.errors
                                .firstName.message
                            }
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">
                          Last Name
                        </Label>
                        <Input
                          id="lastName"
                          placeholder="Sharma"
                          {...signupForm.register("lastName", {
                            required: "Last name is required",
                          })}
                        />
                        {signupForm.formState.errors
                          .lastName && (
                          <p className="text-sm text-destructive">
                            {
                              signupForm.formState.errors
                                .lastName.message
                            }
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="owner@dukaan.in"
                          className="pl-10"
                          {...signupForm.register("email", {
                            required: "Email is required",
                            pattern: {
                              value: /^\S+@\S+$/i,
                              message: "Invalid email address",
                            },
                          })}
                        />
                      </div>
                      {signupForm.formState.errors.email && (
                        <p className="text-sm text-destructive">
                          {
                            signupForm.formState.errors.email
                              .message
                          }
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="businessName">
                        Business Name
                      </Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="businessName"
                          placeholder="Sharma Electronics"
                          className="pl-10"
                          {...signupForm.register(
                            "businessName",
                            {
                              required:
                                "Business name is required",
                            },
                          )}
                        />
                      </div>
                      {signupForm.formState.errors
                        .businessName && (
                        <p className="text-sm text-destructive">
                          {
                            signupForm.formState.errors
                              .businessName.message
                          }
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="newPassword">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="newPassword"
                          type={
                            showPassword ? "text" : "password"
                          }
                          placeholder="Create a strong password"
                          className="pl-10 pr-10"
                          {...signupForm.register("password", {
                            required: "Password is required",
                            minLength: {
                              value: 8,
                              message:
                                "Password must be at least 8 characters",
                            },
                          })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-8 w-8"
                          onClick={() =>
                            setShowPassword(!showPassword)
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {signupForm.formState.errors.password && (
                        <p className="text-sm text-destructive">
                          {
                            signupForm.formState.errors.password
                              .message
                          }
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">
                        Confirm Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type={
                            showConfirmPassword
                              ? "text"
                              : "password"
                          }
                          placeholder="Confirm your password"
                          className="pl-10 pr-10"
                          {...signupForm.register(
                            "confirmPassword",
                            {
                              required:
                                "Please confirm your password",
                            },
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-8 w-8"
                          onClick={() =>
                            setShowConfirmPassword(
                              !showConfirmPassword,
                            )
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {signupForm.formState.errors
                        .confirmPassword && (
                        <p className="text-sm text-destructive">
                          {
                            signupForm.formState.errors
                              .confirmPassword.message
                          }
                        </p>
                      )}
                    </div>

                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="agreeToTerms"
                        checked={signupForm.watch("agreeToTerms") || false}
                        onCheckedChange={checked => signupForm.setValue("agreeToTerms", checked === true, { shouldValidate: true })}
                      />
                      <Label
                        htmlFor="agreeToTerms"
                        className="text-sm leading-5"
                      >
                        I agree to the{" "}
                        <Button
                          variant="link"
                          className="p-0 h-auto text-sm"
                        >
                          Terms of Service
                        </Button>{" "}
                        and{" "}
                        <Button
                          variant="link"
                          className="p-0 h-auto text-sm"
                        >
                          Privacy Policy
                        </Button>
                      </Label>
                    </div>
                    {signupForm.formState.errors
                      .agreeToTerms && (
                      <p className="text-sm text-destructive">
                        {
                          signupForm.formState.errors
                            .agreeToTerms.message
                        }
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading
                        ? "Creating Account..."
                        : "Create Account"}
                    </Button>
                  </form>
                )}

                {authMode === "verify" && (
                  <form
                    onSubmit={verificationForm.handleSubmit(
                      onVerifySubmit,
                    )}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="verifyEmail">Email Address</Label>
                      <Input
                        id="verifyEmail"
                        type="email"
                        placeholder="owner@dukaan.in"
                        {...verificationForm.register("email", {
                          required: "Email is required",
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="verifyToken">Verification Token</Label>
                      <Input
                        id="verifyToken"
                        placeholder="Enter verification token"
                        {...verificationForm.register("token", {
                          required: "Verification token is required",
                        })}
                      />
                    </div>
                    <div className="space-y-3">
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isLoading}
                      >
                        {isLoading ? "Verifying..." : "Verify Email"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={isLoading}
                        onClick={async () => {
                          const email = verificationForm.getValues("email");
                          if (!email) {
                            toast.error("Enter your email first.");
                            return;
                          }
                          try {
                            const result =
                              await api.requestEmailVerification(email);
                            if (result.verificationToken) {
                              verificationForm.setValue(
                                "token",
                                result.verificationToken,
                              );
                            }
                            toast.success(result.message);
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Verification could not be requested.",
                            );
                          }
                        }}
                      >
                        Resend Verification
                      </Button>
                    </div>
                  </form>
                )}

                {authMode === "forgot" && (
                  <form
                    onSubmit={forgotPasswordForm.handleSubmit(
                      onForgotPasswordSubmit,
                    )}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="forgotEmail">Email Address</Label>
                      <Input
                        id="forgotEmail"
                        type="email"
                        placeholder="owner@dukaan.in"
                        {...forgotPasswordForm.register("email", {
                          required: "Email is required",
                        })}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading
                        ? "Preparing Reset..."
                        : "Send Reset Token"}
                    </Button>
                  </form>
                )}

                {authMode === "reset" && (
                  <form
                    onSubmit={resetPasswordForm.handleSubmit(
                      onResetPasswordSubmit,
                    )}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="resetEmail">Email Address</Label>
                      <Input
                        id="resetEmail"
                        type="email"
                        placeholder="owner@dukaan.in"
                        {...resetPasswordForm.register("email", {
                          required: "Email is required",
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="resetToken">Reset Token</Label>
                      <Input
                        id="resetToken"
                        placeholder="Enter reset token"
                        {...resetPasswordForm.register("token", {
                          required: "Reset token is required",
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="resetPassword">New Password</Label>
                      <Input
                        id="resetPassword"
                        type="password"
                        placeholder="Enter new password"
                        {...resetPasswordForm.register("password", {
                          required: "Password is required",
                          minLength: {
                            value: 8,
                            message: "Password must be at least 8 characters",
                          },
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="resetConfirmPassword">Confirm Password</Label>
                      <Input
                        id="resetConfirmPassword"
                        type="password"
                        placeholder="Confirm new password"
                        {...resetPasswordForm.register("confirmPassword", {
                          required: "Please confirm your password",
                        })}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading
                        ? "Updating Password..."
                        : "Update Password"}
                    </Button>
                  </form>
                )}

                <div className="text-center">
                  {authMode === "login" && (
                    <>
                      <span className="text-muted-foreground">
                        Don't have an account?
                      </span>{" "}
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => setAuthMode("signup")}
                      >
                        Sign up
                      </Button>
                    </>
                  )}
                  {authMode === "signup" && (
                    <>
                      <span className="text-muted-foreground">
                        Already have an account?
                      </span>{" "}
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => setAuthMode("login")}
                      >
                        Sign in
                      </Button>
                    </>
                  )}
                  {(authMode === "verify" ||
                    authMode === "forgot" ||
                    authMode === "reset") && (
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => setAuthMode("login")}
                    >
                      Back to sign in
                    </Button>
                  )}
                </div>

                {(authMode === "login" || authMode === "signup") && (
                  <div className="border-t border-border/70 pt-6">
                    <div className="rounded-lg border border-border/70 bg-muted/45 p-4">
                      <div className="mb-3 flex items-start gap-3 text-left">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">Want to look around first?</p>
                          <p className="mt-1 text-sm leading-5 text-muted-foreground">
                            Open the separate demo account with sample sales,
                            products, orders, and customers already loaded.
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between"
                        onClick={onNavigateToDemo}
                      >
                        Explore Demo Account
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
