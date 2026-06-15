"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import { RefreshCw, Sparkles, X } from "lucide-react";
import ChatComposer from "@/components/ChatComposer";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checkingOAuth, setCheckingOAuth] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const isChatPage = pathname === "/chat";

  useEffect(() => {
    setIsChatOpen(false);
  }, [pathname]);

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
        
        {/* Floating AI Chat button */}
        {!isChatPage && (
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="fixed bottom-6 right-6 z-40 p-4 bg-primary text-[#0F0F0F] rounded-full shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-110 active:scale-95 transition-all duration-200 ease-out border border-[#a8874d]"
            title="Open AI Chat Assistant"
          >
            <Sparkles className="w-5 h-5 text-[#0F0F0F]" />
          </button>
        )}
      </main>

      {/* Backdrop */}
      {isChatOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 transition-opacity duration-300"
          onClick={() => setIsChatOpen(false)}
        />
      )}
      
      {/* Side Drawer */}
      <div 
        className={`fixed right-0 top-0 h-screen w-full max-w-lg bg-[#0B0B0D] border-l border-border z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-out transform ${
          isChatOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-[#121212]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <div>
              <h2 className="font-serif font-bold text-sm tracking-wide text-foreground">
                Maeven AI Assistant
              </h2>
              <p className="text-[10px] text-muted">
                Compose segments, templates & campaigns
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsChatOpen(false)}
            className="p-1.5 hover:bg-[#1C1C1E] rounded-md transition-colors text-muted hover:text-foreground"
            title="Close Assistant"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
        
        {/* Drawer Body - Scrollable and Flex */}
        <div className="flex-1 overflow-hidden">
          <ChatComposer isDrawer={true} />
        </div>
      </div>
    </div>
  );
}
