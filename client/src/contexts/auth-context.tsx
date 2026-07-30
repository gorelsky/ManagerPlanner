import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "../supabase";

type AppUser = SupabaseUser & {
  role?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  username?: string;
  profileImage?: string;
};

type AuthContextValue = {
  session: Session | null;
  user: AppUser | null;
  isLoading: boolean;
  login: (user: AppUser, session?: Session | null) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(supabaseUser: SupabaseUser): Promise<AppUser> {
  const query = supabase
    .from("users")
    .select("id, role, first_name, last_name, middle_name, username, email, profile_image");

  const byId = supabaseUser.id ? query.eq("id", supabaseUser.id) : null;
  const { data, error } =
    (byId ? await byId.maybeSingle() : await query.eq("email", supabaseUser.email ?? "").maybeSingle());

  if (error || !data) {
    return {
      ...supabaseUser,
      role: undefined,
      firstName: undefined,
      lastName: undefined,
      middleName: undefined,
      username: undefined,
      profileImage: undefined,
    };
  }

  return {
    ...supabaseUser,
    id: data.id,
    role: data.role ?? undefined,
    firstName: data.first_name ?? undefined,
    lastName: data.last_name ?? undefined,
    middleName: data.middle_name ?? undefined,
    username: data.username ?? undefined,
    profileImage: data.profile_image ?? undefined,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = async (nextSession: Session | null) => {
    setSession(nextSession);

    if (!nextSession?.user) {
      setUser(null);
      return;
    }

    const profile = await loadProfile(nextSession.user);
    setUser(profile);
  };

  const refreshSession = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      setSession(null);
      setUser(null);
      setIsLoading(false);
      return;
    }

    await applySession(data.session);
    setIsLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          setSession(null);
          setUser(null);
        } else {
          await applySession(data.session);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED" ||
        event === "INITIAL_SESSION"
      ) {
        try {
          setIsLoading(true);
          await applySession(nextSession);
        } finally {
          setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (nextUser: AppUser, nextSession: Session | null = null) => {
    setIsLoading(true);
    if (nextSession?.user) {
      const profile = await loadProfile(nextSession.user);
      setUser(profile);
      setSession(nextSession);
    } else {
      setUser(nextUser);
      setSession(nextSession);
    }
    setIsLoading(false);
  };

  const logout = async () => {
    setUser(null);
    setSession(null);
    setIsLoading(false);
    await supabase.auth.signOut({ scope: "local" }).catch(() => supabase.auth.signOut());
  };

  const value = useMemo(
    () => ({
      session,
      user,
      isLoading,
      login,
      logout,
      refreshSession,
    }),
    [session, user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}