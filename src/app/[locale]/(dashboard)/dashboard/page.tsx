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
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchForms();
  }, []);

  async function fetchForms() {
    try {
      const res = await fetch("/api/forms");
      const data = await res.json();
      setForms(data);
    } catch {
      setError(tc("error"));
    } finally {
      setLoading(false);
    }
  }

  async function createForm() {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/forms", { method: "POST" });
      const form = await res.json();
      router.push(`/builder/${form.id}`);
    } catch {
      setError(tc("error"));
      setCreating(false);
    }
  }

  async function deleteForm(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    setError("");
    try {
      await fetch(`/api/forms/${id}`, { method: "DELETE" });
      fetchForms();
    } catch {
      setError(tc("error"));
    }
  }

  async function duplicateForm(id: string) {
    setError("");
    try {
      const res = await fetch(`/api/forms/${id}/duplicate`, { method: "POST" });
      if (res.ok) fetchForms();
    } catch {
      setError(tc("error"));
    }
  }

  if (loading) return <div className="py-12 text-center text-gray-600 text-lg">{tc("loading")}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t("yourForms")}</h1>
        <button
          onClick={createForm}
          disabled={creating}
          className="bg-black text-white font-medium px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {creating ? t("creating") : t("newForm")}
        </button>
      </div>
      {error && <p className="text-red-600 font-medium mb-4">{error}</p>}
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
