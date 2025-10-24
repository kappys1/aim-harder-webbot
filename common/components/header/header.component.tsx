"use client";

import { Button } from "@/common/ui/button";
import { useAuth } from "@/modules/auth/hooks/useAuth.hook";
import { Loader2, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function Header() {
  const pathname = usePathname();
  const { user, logout, isLoading, startRefresh, stopRefresh } = useAuth();

  const isActive = (path: string) => pathname === path;

  useEffect(() => {
    if (user) {
      startRefresh();
    }
    return () => {
      stopRefresh();
    };
  }, [user]);

  return (
    <header className="bg-background sticky top-0 z-50 border-b isolate">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity"
          >
            <Image
              src="/logo.png"
              alt="AimHarder Logo"
              width={32}
              height={32}
              className="rounded-md"
            />
            <span>AimHarder</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/dashboard"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive("/dashboard")
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              Dashboard
            </Link>
            {!isActive("/dashboard") && (
              <>
                {/* <Link
                  href="/booking"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/booking")
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  Clases
                </Link> */}
                <Link
                  href="/my-prebookings"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/my-prebookings")
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  Mis Pre-reservas
                </Link>
              </>
            )}
          </nav>

          {/* User & Logout */}
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.email}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex items-center gap-4 mt-3 pt-3 border-t">
          <Link
            href="/dashboard"
            className={`text-sm font-medium transition-colors hover:text-primary ${
              isActive("/dashboard") ? "text-primary" : "text-muted-foreground"
            }`}
          >
            Dashboard
          </Link>
          {/* <Link
            href="/booking"
            className={`text-sm font-medium transition-colors hover:text-primary ${
              isActive("/booking") ? "text-primary" : "text-muted-foreground"
            }`}
          >
            Reservas
          </Link> */}
          <Link
            href="/my-prebookings"
            className={`text-sm font-medium transition-colors hover:text-primary ${
              isActive("/my-prebookings")
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            Pre-reservas
          </Link>
        </nav>
      </div>
    </header>
  );
}
