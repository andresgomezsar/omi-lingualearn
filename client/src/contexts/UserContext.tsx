import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  username: string;
  omiUid: string | null;
  targetLanguage: string | null;
  nativeLanguage: string | null;
  streak: number;
  totalXp: number;
  level: number;
}

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (userIdOrOmiUid: string) => Promise<void>;
  logout: () => void;
  error: string | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const USER_KEY = "omi_lingualearn_user_id";

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-login on mount if user ID is stored
  useEffect(() => {
    const storedUserId = localStorage.getItem(USER_KEY);
    if (storedUserId) {
      fetchUser(storedUserId).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async (userIdOrOmiUid: string) => {
    try {
      setError(null);
      setIsLoading(true);

      // Try to fetch user profile
      const res = await apiRequest("GET", `/api/user/profile?userId=${encodeURIComponent(userIdOrOmiUid)}`);
      const userData = await res.json();

      setUser(userData);
      localStorage.setItem(USER_KEY, userData.id);
    } catch (err) {
      console.error("Failed to fetch user:", err);
      setError("Invalid user ID or Omi UID. Please check and try again.");
      localStorage.removeItem(USER_KEY);
      setUser(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userIdOrOmiUid: string) => {
    await fetchUser(userIdOrOmiUid);
  };

  const logout = () => {
    setUser(null);
    setError(null);
    localStorage.removeItem(USER_KEY);
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        error,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
