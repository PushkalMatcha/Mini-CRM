"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import { RefreshCw } from "lucide-react";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checkingOAuth, setCheckingOAuth] = useState(false);

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    const hasOAuthParams = typeof window !== "undefined" && (
      window.location.search.includes("code=") ||
      window.location.hash.includes("access_token=") ||
      window.location.hash.includes("id_token=")
    );

    if (hasOAuthParams && !user) {
      setCheckingOAuth(true);
      const timer = setTimeout(() => {
        setCheckingOAuth(false);
      }, 3500); // 3.5s timeout fallback to prevent getting stuck
      return () => clearTimeout(timer);
    } else {
      setCheckingOAuth(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !checkingOAuth) {
      if (!user && !isAuthPage) {
        const search = typeof window !== "undefined" ? window.location.search : "";
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        router.push(`/login${search}${hash}`);
      } else if (user && isAuthPage) {
        router.push("/");
      }
    }
  }, [user, loading, checkingOAuth, pathname, router, isAuthPage]);

  // Full screen loader matching Maeven luxury style
  if (loading || checkingOAuth) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-muted">
        <RefreshCw className="w-10 h-10 animate-spin text-primary mb-4" />
        <span className="font-serif font-semibold text-sm uppercase tracking-widest text-[#DCD6C7]">
          Verifying Identity...
        </span>
      </div>
    );
  }

  // Redirect handling: render blank while navigating
  if (!user && !isAuthPage) {
    return null;
  }
  if (user && isAuthPage) {
    return null;
  }

  // If on login/signup pages, do not render Sidebar navigation shell
  if (isAuthPage) {
    return <div className="w-full h-full min-h-screen">{children}</div>;
  }

  // Authenticated state layout with Sidebar
  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden select-none">
      {/* Navigation Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto p-8 relative">
        {children}
      </main>
    </div>
  );
}
