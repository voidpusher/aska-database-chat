export interface SessionIdentity {
  id?: unknown;
  email?: unknown;
  authProvider?: unknown;
}

export function isDemoUser(user: SessionIdentity | null | undefined) {
  return (
    user?.authProvider === "demo" ||
    user?.id === "demo-user" ||
    String(user?.email || "").trim().toLowerCase() === "demo@orrico.com"
  );
}
