"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export function useAuth() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";
  const isUnauthenticated = status === "unauthenticated";

  const logout = async () => {
    await signOut({ redirect: false });
    router.push("/");
  };

  const refreshSession = async () => {
    await update();
  };

  return {
    user: session?.user,
    session,
    isAuthenticated,
    isLoading,
    isUnauthenticated,
    logout,
    refreshSession,
  };
}
