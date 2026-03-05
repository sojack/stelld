"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { FormCard } from "@/components/form-card";

interface Form {
  id: string;
  title: string;
  isPublished: boolean;
  updatedAt: string;
  _count: { submissions: number };
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchForms();
  }, []);

  async function fetchForms() {
    const res = await fetch("/api/forms");
    const data = await res.json();
    setForms(data);
    setLoading(false);
  }

  async function createForm() {
    const res = await fetch("/api/forms", { method: "POST" });
    const form = await res.json();
    router.push(`/builder/${form.id}`);
  }

  async function deleteForm(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    await fetch(`/api/forms/${id}`, { method: "DELETE" });
    fetchForms();
  }

  async function duplicateForm(id: string) {
    const res = await fetch(`/api/forms/${id}/duplicate`, { method: "POST" });
    if (res.ok) fetchForms();
  }

  if (loading) return <div className="py-12 text-center text-gray-600 text-lg">{tc("loading")}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t("yourForms")}</h1>
        <button
          onClick={createForm}
          className="bg-black text-white font-medium px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
        >
          {t("newForm")}
        </button>
      </div>
      {forms.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">{t("noForms")}</p>
          <p className="text-sm">{t("noFormsDesc")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map((form) => (
            <FormCard
              key={form.id}
              id={form.id}
              title={form.title}
              isPublished={form.isPublished}
              submissionCount={form._count.submissions}
              updatedAt={form.updatedAt}
              onDelete={deleteForm}
              onDuplicate={duplicateForm}
            />
          ))}
        </div>
      )}
    </div>
  );
}
