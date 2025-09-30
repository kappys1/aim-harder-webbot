"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export function useAuth() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // Get user email from localStorage
    if (typeof window !== "undefined") {
      const email = localStorage.getItem("user-email");
      setUserEmail(email);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoggingOut(true);

    try {
      // Call logout API to clear cookies
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (response.ok) {
        // Clear localStorage
        if (typeof window !== "undefined") {
          localStorage.removeItem("user-email");
        }

        toast.success("Sesión cerrada exitosamente");

        // Redirect to login
        router.push("/login");
      } else {
        throw new Error("Failed to logout");
      }
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Error al cerrar sesión");
    } finally {
      setIsLoggingOut(false);
    }
  }, [router]);

  return {
    userEmail,
    logout,
    isLoggingOut,
  };
}