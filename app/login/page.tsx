"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.ok) {
      router.replace("/");
    } else {
      setError(result.error ?? "Invalid email or password.");
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://www.nuanu.com/_next/image?url=%2Fnuanu-impact-2025.webp&w=3840&q=75')",
        }}
      />
      {/* Dark overlay for legibility */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 to-slate-900/75" />

      {/* Content layer */}
      <div className="relative z-10 flex w-full flex-col items-center">
      {/* Logo lockup */}
      <div className="mb-8 flex flex-col items-center gap-4">
        <Image
          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS8rCDTckVq3MiavNsW646gIm0afBWgG79oHNgaD7Wsy26_G2qdhePaHw0&s=10"
          alt="Nuanu"
          width={72}
          height={72}
          className="h-[72px] w-[72px] rounded-full object-cover ring-2 ring-white/20"
          unoptimized
        />
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold text-white">Nuanu</h1>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-300">
            HR Recruitment ATS
          </p>
        </div>
      </div>

      {/* Login card */}
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <h2 className="font-heading text-xl font-bold text-slate-900">
          Welcome back
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to access your dashboard
        </p>

        <div className="my-6 h-px bg-slate-100" />

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <span className="text-xs font-medium text-slate-400 cursor-default">
                Forgot password?
              </span>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-[18px] w-[18px]" />
                ) : (
                  <Eye className="h-[18px] w-[18px]" />
                )}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm font-medium text-red-600">{error}</p>
          )}

          {/* Keep me signed in */}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-400"
            />
            <span className="text-sm text-slate-600">Keep me signed in</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-800 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Access Dashboard
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-xs text-slate-400">
        © 2026 Nuanu · Enterprise HR Platform
      </p>
      </div>
    </div>
  );
}
