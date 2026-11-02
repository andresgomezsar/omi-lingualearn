import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { apiRequest, queryClient, clearPrivateCache } from "@/lib/queryClient";

interface User {
  id: string; username: string; omiUid: string | null;
  targetLanguage: string | null; nativeLanguage: string | null;
  streak: number; totalXp: number; level: number;
}
interface UserContextType {
  user: User | null; isLoading: boolean; isAuthenticated: boolean;
  login: (token: string) => Promise<void>; logout: () => Promise<void>; error: string | null;
}
const UserContext = createContext<UserContextType | undefined>(undefined);
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    localStorage.removeItem("omi_lingualearn_user_id");
    const controller = new AbortController();
    const current = ++generation.current;
    fetch("/api/auth/session", { credentials: "include", signal: controller.signal })
      .then(async res => res.ok ? res.json() : null)
      .then(data => { if (current === generation.current) setUser(data); })
      .catch(() => { if (current === generation.current) setUser(null); })
      .finally(() => { if (current === generation.current) setIsLoading(false); });
    return () => { controller.abort(); generation.current++; };
  }, []);
  const login = async (token: string) => {
    const current = ++generation.current;
    setIsLoading(true); setUser(null); setError(null);
    await clearPrivateCache();
    try {
      const res = await apiRequest("POST", "/api/auth/session", { token });
      const data = await res.json();
      if (current === generation.current) setUser(data);
    } catch (err) {
      await clearPrivateCache();
      if (current === generation.current) setError("Could not sign in. Check your access token and try again.");
      throw err;
    } finally { if (current === generation.current) setIsLoading(false); }
  };
  const logout = async () => {
    generation.current++;
    setIsLoading(true); setUser(null); setError(null);
    await clearPrivateCache();
    try { await apiRequest("DELETE", "/api/auth/session"); }
    catch { setError("Server sign-out failed. Retry before sharing this browser."); }
    finally { await clearPrivateCache(); setIsLoading(false); }
  };
  return <UserContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout, error }}>{children}</UserContext.Provider>;
}
export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
}
