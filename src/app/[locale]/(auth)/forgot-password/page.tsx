"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: formData.get("email") }),
    });

    setSubmitted(true);
    setLoading(false);
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
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("resetPassword")}</h1>
          {submitted ? (
            <div>
              <p className="text-gray-600 mb-4">
                {t("resetEmailSent")}
              </p>
              <Link href="/login" className="text-sm font-medium text-gray-900 hover:underline">
                {t("backToLogin")}
              </Link>
            </div>
          ) : (
            <>
              <p className="text-gray-600 text-sm mb-4">
                {t("resetEmailPrompt")}
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">{tc("email")}</label>
                  <input id="email" name="email" type="email" required className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600" />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-black text-white font-medium py-2.5 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50">
                  {loading ? t("sending") : t("sendResetLink")}
                </button>
              </form>
              <p className="mt-5 text-sm text-center text-gray-600">
                {t("rememberPassword")} <Link href="/login" className="font-medium text-gray-900 hover:underline">{t("logIn")}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
