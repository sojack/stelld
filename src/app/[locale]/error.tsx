"use client";

import { useTranslations } from "next-intl";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");
  const tc = useTranslations("common");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("title")}</h1>
        <p className="text-gray-600 mb-8">{t("description")}</p>
        <button
          onClick={reset}
          className="inline-block bg-black text-white font-medium px-6 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
        >
          {t("tryAgain")}
        </button>
        <p className="mt-12 text-sm text-gray-400">{tc("stelld")}</p>
      </div>
    </div>
  );
}
