"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { LanguageSwitcher } from "@/components/language-switcher";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const t = useTranslations("auth");
  const tc = useTranslations("common");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError(t("passwordsMismatch"));
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError(t("passwordMinLength"));
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      const apiErrors: Record<string, string> = {
        "Invalid or expired token": t("invalidOrExpiredToken"),
        "Token and password are required": t("tokenAndPasswordRequired"),
        "Password must be at least 8 characters": t("passwordMinLength"),
      };
      setError(apiErrors[data.error] || data.error || tc("error"));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (!token) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{t("invalidResetLink")}</h1>
        <p className="text-gray-600 mb-4">{t("invalidResetLinkDesc")}</p>
        <Link href="/forgot-password" className="text-sm font-medium text-gray-900 hover:underline">
          {t("requestNewLink")}
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("setNewPassword")}</h1>
      {success ? (
        <div>
          <p className="text-green-600 font-medium mb-4">{t("passwordResetSuccess")}</p>
          <Link href="/login" className="text-sm font-medium text-gray-900 hover:underline">
            {t("loginWithNewPassword")}
          </Link>
        </div>
      ) : (
        <>
          {error && <p className="text-red-600 font-medium mb-4">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">{t("newPassword")}</label>
              <input id="password" name="password" type="password" required minLength={8} className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600" />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">{t("confirmPassword")}</label>
              <input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-black text-white font-medium py-2.5 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50">
              {loading ? t("resetting") : t("resetPasswordBtn")}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  const tc = useTranslations("common");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex items-center justify-center gap-4">
          <Link href="/" className="text-xl font-bold text-gray-900">{tc("stelld")}</Link>
          <LanguageSwitcher />
        </div>
        <Suspense fallback={
          <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
            <p className="text-gray-500">{tc("loading")}</p>
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
