"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Gem, Lock, Mail, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const error = params.get("error_description") || params.get("error");
      if (error) {
        let cleanError = decodeURIComponent(error).replace(/\+/g, " ");
        if (cleanError.toLowerCase().includes("exchange external code")) {
          cleanError = "Google OAuth Mismatch: The Client Secret or Client ID configured in your Supabase Dashboard is incorrect. Please verify your Google Cloud Console credentials and save them in Supabase.";
        }
        setErrorMsg(cleanError);
      }
    }
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // Validate matching passwords
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      setSuccessMsg("Account created successfully! Check your email or sign in below.");
      // Clear forms
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred during sign up.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      let msg = err.message || "Failed to initiate Google sign in.";
      if (msg.toLowerCase().includes("provider") && (msg.toLowerCase().includes("not enabled") || msg.toLowerCase().includes("unsupported"))) {
        msg = "Google authentication is not enabled in this Supabase project. Go to your Supabase Dashboard -> Authentication -> Providers -> Google, enable it, and configure your Google Client ID/Secret.";
      }
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-8 premium-card bg-[#121212] border border-border p-8 rounded-2xl shadow-2xl">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
            <Gem className="text-primary w-8 h-8 animate-pulse" />
          </div>
          <h2 className="font-serif font-bold text-3xl tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-[#C9A96E] to-[#EAD4A9]">
            CREATE ACCOUNT
          </h2>
          <p className="text-xs text-muted max-w-xs leading-normal">
            Join Maeven CRM to manage customer lifecycles and AI marketing campaigns.
          </p>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="flex items-center gap-2.5 p-3.5 bg-amber-500/10 border border-amber-500/25 text-amber-500 rounded-lg text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-lg text-xs font-semibold">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSignup} className="space-y-5">
          <div className="space-y-4">
            
            {/* Email field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-muted/60" />
                <input
                  type="email"
                  required
                  placeholder="name@maeven.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="premium-input pl-11 text-sm text-foreground placeholder:text-muted/40 w-full"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-muted/60" />
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="premium-input pl-11 text-sm text-foreground placeholder:text-muted/40 w-full"
                />
              </div>
            </div>

            {/* Confirm Password field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-muted/60" />
                <input
                  type="password"
                  required
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="premium-input pl-11 text-sm text-foreground placeholder:text-muted/40 w-full"
                />
              </div>
            </div>

          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading}
            className="premium-button-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-background" />
                <span>Registering Account...</span>
              </>
            ) : (
              <span>Register Account</span>
            )}
          </button>
        </form>

        {/* OAuth Separator */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/60"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#121212] px-2.5 text-muted/60">Or continue with</span>
          </div>
        </div>

        {/* OAuth Buttons */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-border bg-[#1A1A1A] text-sm font-semibold text-foreground hover:bg-[#222] hover:border-primary/20 hover:text-primary transition-all duration-200"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Login redirect footer */}
        <div className="text-center pt-4 border-t border-border/40">
          <p className="text-xs text-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-semibold">
              Sign In
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
