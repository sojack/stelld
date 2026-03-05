"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { SubmissionsTable } from "@/components/submissions-table";

interface FormData {
  id: string;
  title: string;
  schema: object;
  isPublished: boolean;
}

interface Submission {
  id: string;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export default function FormSubmissionsPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const params = useParams();
  const formId = params.id as string;
  const [form, setForm] = useState<FormData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/forms/${formId}/submissions`);
      if (res.ok) {
        const data = await res.json();
        setForm(data.form);
        setSubmissions(data.submissions);
      }
      setLoading(false);
    }
    load();
  }, [formId]);

  if (loading) return <div className="py-12 text-center text-gray-500">{tc("loading")}</div>;
  if (!form) return <div className="py-12 text-center text-gray-500">{t("formNotFound")}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">&larr; {t("allForms")}</Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-1">{form.title}</h1>
          <p className="text-sm font-medium text-gray-600 mt-1">
            {t("submissionCount", { count: submissions.length })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/builder/${formId}`}
            className="text-sm font-medium px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t("editForm")}
          </Link>
          <a
            href={`/api/forms/${formId}/submissions/export`}
            className="text-sm font-medium px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            {t("exportCsv")}
          </a>
        </div>
      </div>

      <SubmissionsTable submissions={submissions} formSchema={form.schema} />
    </div>
  );
}
