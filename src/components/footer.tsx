"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export function Footer() {
  const tc = useTranslations("common");

  return (
    <footer className="border-t border-gray-200 bg-white px-6 py-6">
      <div className="max-w-4xl mx-auto text-center">
        <Link href="/" className="font-semibold text-gray-900 hover:underline">{tc("stelld")}</Link>
        <p className="text-sm text-gray-500 mt-1">{tc("builtInCanada")}</p>
      </div>
    </footer>
  );
}
