"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormCard } from "@/components/form-card";

interface Form {
  id: string;
  title: string;
  isPublished: boolean;
  updatedAt: string;
  _count: { submissions: number };
}

export default function DashboardPage() {
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
    if (!confirm("Delete this form and all its submissions?")) return;
    await fetch(`/api/forms/${id}`, { method: "DELETE" });
    fetchForms();
  }

  async function duplicateForm(id: string) {
    const res = await fetch(`/api/forms/${id}/duplicate`, { method: "POST" });
    if (res.ok) fetchForms();
  }

  if (loading) return <div className="py-12 text-center text-gray-600 text-lg">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Your Forms</h1>
        <button
          onClick={createForm}
          className="bg-black text-white font-medium px-5 py-2.5 rounded-md hover:bg-gray-800 transition-colors"
        >
          + New Form
        </button>
      </div>
      {forms.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No forms yet</p>
          <p className="text-sm">Create your first form to get started.</p>
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
