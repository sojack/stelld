"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export function Footer() {
  const tc = useTranslations("common");
  const tf = useTranslations("footer");

  return (
    <footer className="border-t border-gray-200 bg-white px-6 py-6">
      <div className="max-w-4xl mx-auto text-center space-y-2">
        <Link href="/" className="font-semibold text-gray-900 hover:underline">{tc("stelld")}</Link>
        <p className="text-sm text-gray-500">{tc("builtInCanada")}</p>
        <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
          <Link href="/terms" className="hover:text-gray-600 hover:underline">{tf("terms")}</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-gray-600 hover:underline">{tf("privacy")}</Link>
        </div>
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} JS Designs. {tf("allRights")}</p>
      </div>
    </footer>
  );
}
