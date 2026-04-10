"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { Footer } from "@/components/footer";
import { GoogleButton } from "@/components/auth/google-button";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function SignupPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const tf = useTranslations("footer");
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    if (!res.ok) {
      let data: { error?: string } = {};
      try { data = await res.json(); } catch { /* empty body */ }
      const apiErrors: Record<string, string> = {
        "Email already in use": t("emailInUse"),
        "Email and password are required": t("emailAndPasswordRequired"),
      };
      setError(apiErrors[data.error ?? ""] || data.error || tc("error"));
      setLoading(false);
      return;
    }

    router.push("/login?registered=true");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Link href="/">
            <Image src="/logo/logo-light.svg" alt="Stelld" width={160} height={40} priority />
          </Link>
          <LanguageSwitcher />
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("createAccount")}</h1>
          <GoogleButton label={t("continueWithGoogle")} />
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">{t("or")}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          {error && <p className="text-red-600 font-medium mb-4">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">{tc("name")}</label>
              <input id="name" name="name" type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">{tc("email")}</label>
              <input id="email" name="email" type="email" required className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">{tc("password")}</label>
              <input id="password" name="password" type="password" required minLength={8} maxLength={128} className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-black text-white font-medium py-2.5 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50">
              {loading ? t("creatingAccount") : t("signUp")}
            </button>
            <p className="text-xs text-gray-500 text-center">
              {tf("agreeToTerms")}{" "}
              <Link href="/terms" className="underline hover:text-gray-700">{tf("terms")}</Link>{" "}
              {tf("and")}{" "}
              <Link href="/privacy" className="underline hover:text-gray-700">{tf("privacy")}</Link>.
            </p>
          </form>
          <p className="mt-5 text-sm text-center text-gray-600">
            {t("hasAccount")} <Link href="/login" className="font-medium text-gray-900 hover:underline">{t("logIn")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
