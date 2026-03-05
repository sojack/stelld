import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export default function NotFound() {
  const t = useTranslations("notFound");
  const tc = useTranslations("common");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("title")}</h2>
        <p className="text-gray-600 mb-8">{t("description")}</p>
        <Link
          href="/"
          className="inline-block bg-black text-white font-medium px-6 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
        >
          {t("goHome")}
        </Link>
        <p className="mt-12 text-sm text-gray-400">{tc("stelld")}</p>
      </div>
    </div>
  );
}
