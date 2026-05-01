"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

interface FormCardProps {
  id: string;
  title: string;
  isPublished: boolean;
  submissionCount: number;
  updatedAt: string;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export function FormCard({
  id, title, isPublished, submissionCount, updatedAt, onDelete, onDuplicate
}: FormCardProps) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");

  return (
    <div className="bg-white border rounded-lg p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/builder/${id}`} className="text-base font-semibold text-gray-900 hover:underline block truncate max-w-md">
            {title}
          </Link>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className={`font-medium ${isPublished ? "text-green-700" : "text-gray-500"}`}>
              {isPublished ? t("published") : t("draft")}
            </span>
            <span className="text-gray-600">{t("submissionCount", { count: submissionCount })}</span>
            <span className="text-gray-600">{t("updated", { date: new Date(updatedAt).toLocaleDateString() })}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/forms/${id}`}
            className="text-sm font-medium px-3 py-1.5 border rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t("submissions")}
          </Link>
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(id)}
              className="text-sm font-medium px-3 py-1.5 border rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {tc("duplicate")}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(id)}
              className="text-sm font-medium px-3 py-1.5 border rounded-md text-red-600 hover:bg-red-50 transition-colors"
            >
              {tc("delete")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
