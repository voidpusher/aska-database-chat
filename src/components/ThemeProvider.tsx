import { createContext, useContext, useEffect } from "react";
import { safeStorageSet } from "../lib/storage";
const ThemeContext = createContext<{ theme: "dark" } | undefined>(undefined);
const darkTheme = { theme: "dark" as const };
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
    safeStorageSet("aska_theme", "dark");
  }, []);
  return <ThemeContext.Provider value={darkTheme}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
