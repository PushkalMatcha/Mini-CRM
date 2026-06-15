"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Layers, 
  Megaphone, 
  Sparkles, 
  Gem,
  LogOut,
  Briefcase,
  Inbox
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  const menuItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Segments", href: "/segments", icon: Layers },
    { name: "Campaigns", href: "/campaigns", icon: Megaphone },
    { name: "AI Insights", href: "/insights", icon: Sparkles },
  ];

  return (
    <aside className="w-64 border-r border-border bg-[#070709] flex flex-col h-screen sticky top-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
        <Gem className="text-primary w-5 h-5 animate-pulse" />
        <span className="font-serif font-semibold text-lg tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
          MAEVEN
        </span>
        <span className="text-[9px] bg-primary/10 border border-primary/25 text-primary px-1.5 py-0.5 rounded font-sans font-medium uppercase tracking-wider">
          CRM
        </span>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-[#14120e] text-primary border-r-2 border-primary shadow-sm"
                  : "text-muted hover:text-foreground hover:bg-[#0f0f12]"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted"}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Log Out Action */}
      <div className="px-4 py-2 border-t border-border/40">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium text-rose-500/80 hover:text-rose-500 hover:bg-[#1c0d0d]/30 transition-all duration-200"
        >
          <LogOut className="w-4 h-4 text-rose-500/80" />
          <span>Log Out</span>
        </button>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border flex flex-col gap-0.5 text-[10px] text-muted/50 px-6 font-sans">
        <p className="font-medium">Maeven CRM v1.0.0</p>
        <p>© 2026 Maeven Retail Inc.</p>
      </div>
    </aside>
  );
}
