import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import AuthGate from "@/components/AuthGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maeven CRM | AI-Native Retail Analytics & Messaging",
  description: "Production-grade AI-native CRM built for elite retail and D2C brands.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground overflow-hidden select-none">
        <AuthProvider>
          <AuthGate>
            {children}
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
