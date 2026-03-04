"use client";

import { useState } from "react";

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
  const [selected, setSelected] = useState<Submission | null>(null);

  const columns = getColumnsFromSubmissions(submissions);

  if (submissions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No submissions yet. Share your form to start collecting responses.
      </div>
    );
  }

  return (
    <div>
      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Submission Detail</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <dl className="space-y-3">
              {Object.entries(selected.data).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm font-medium text-gray-500">{key}</dt>
                  <dd className="mt-1">{String(value)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-gray-400">
              Submitted {new Date(selected.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3 font-medium text-gray-500">Date</th>
              {columns.slice(0, 5).map((col) => (
                <th key={col} className="text-left py-2 px-3 font-medium text-gray-500">{col}</th>
              ))}
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((sub) => (
              <tr key={sub.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3 text-gray-500">
                  {new Date(sub.createdAt).toLocaleDateString()}
                </td>
                {columns.slice(0, 5).map((col) => (
                  <td key={col} className="py-2 px-3 max-w-[200px] truncate">
                    {String(sub.data[col] ?? "")}
                  </td>
                ))}
                <td className="py-2 px-3">
                  <button
                    onClick={() => setSelected(sub)}
                    className="text-blue-600 hover:underline"
                  >
                    View
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
