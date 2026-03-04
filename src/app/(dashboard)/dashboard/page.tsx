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

  if (loading) return <div className="py-12 text-center text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Forms</h1>
        <button
          onClick={createForm}
          className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
        >
          New Form
        </button>
      </div>
      {forms.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No forms yet. Create your first one!</p>
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
