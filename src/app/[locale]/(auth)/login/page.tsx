"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    const sessionRes = await fetch("/api/auth/session");
    const session = await sessionRes.json();

    if (session?.user) {
      window.location.href = `/${locale}/dashboard`;
      return;
    }

    setError(t("invalidCredentials"));
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex items-center justify-center gap-4">
          <Link href="/" className="text-xl font-bold text-gray-900">{tc("stelld")}</Link>
          <LanguageSwitcher />
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("logIn")}</h1>
          {error && <p className="text-red-600 font-medium mb-4">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">{tc("email")}</label>
              <input id="email" name="email" type="email" required className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">{tc("password")}</label>
                <Link href="/forgot-password" className="text-sm text-gray-600 hover:text-gray-900 hover:underline">{t("forgotPassword")}</Link>
              </div>
              <input id="password" name="password" type="password" required className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-black text-white font-medium py-2.5 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50">
              {loading ? t("loggingIn") : t("logIn")}
            </button>
          </form>
          <p className="mt-5 text-sm text-center text-gray-600">
            {t("noAccount")} <Link href="/signup" className="font-medium text-gray-900 hover:underline">{t("signUp")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
