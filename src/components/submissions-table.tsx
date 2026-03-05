"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface Submission {
  id: string;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface SubmissionsTableProps {
  submissions: Submission[];
  formSchema: object;
}

export function SubmissionsTable({ submissions, formSchema }: SubmissionsTableProps) {
  const t = useTranslations("submissions");
  const tc = useTranslations("common");
  const [selected, setSelected] = useState<Submission | null>(null);

  const columns = getColumnsFromSubmissions(submissions);

  if (submissions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        {t("noSubmissions")}
      </div>
    );
  }

  return (
    <div>
      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-auto shadow-lg">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-gray-900">{t("title")}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-900 text-xl leading-none">&times;</button>
            </div>
            <dl className="space-y-4">
              {Object.entries(selected.data).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm font-semibold text-gray-700">{key}</dt>
                  <dd className="mt-1 text-gray-900">{String(value)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-sm text-gray-600">
              {t("submitted", { date: new Date(selected.createdAt).toLocaleString() })}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto bg-white border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">{t("date")}</th>
              {columns.slice(0, 5).map((col) => (
                <th key={col} className="text-left py-3 px-4 font-semibold text-gray-700">{col}</th>
              ))}
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((sub) => (
              <tr key={sub.id} className="border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 text-gray-600 font-medium">
                  {new Date(sub.createdAt).toLocaleDateString()}
                </td>
                {columns.slice(0, 5).map((col) => (
                  <td key={col} className="py-3 px-4 text-gray-900 max-w-[200px] truncate">
                    {String(sub.data[col] ?? "")}
                  </td>
                ))}
                <td className="py-3 px-4">
                  <button
                    onClick={() => setSelected(sub)}
                    className="text-sm font-medium text-green-700 hover:text-green-900 hover:underline transition-colors"
                  >
                    {tc("view")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getColumnsFromSubmissions(submissions: Submission[]): string[] {
  const keys = new Set<string>();
  for (const sub of submissions) {
    for (const key of Object.keys(sub.data)) {
      keys.add(key);
    }
  }
  return Array.from(keys);
}
