"use client";

import Link from "next/link";

interface FormCardProps {
  id: string;
  title: string;
  isPublished: boolean;
  submissionCount: number;
  updatedAt: string;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function FormCard({
  id, title, isPublished, submissionCount, updatedAt, onDelete, onDuplicate
}: FormCardProps) {
  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/builder/${id}`} className="font-medium hover:underline">
            {title}
          </Link>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span className={isPublished ? "text-green-600" : "text-gray-400"}>
              {isPublished ? "Published" : "Draft"}
            </span>
            <span>{submissionCount} submissions</span>
            <span>Updated {new Date(updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/forms/${id}`}
            className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
          >
            Submissions
          </Link>
          <button
            onClick={() => onDuplicate(id)}
            className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
          >
            Duplicate
          </button>
          <button
            onClick={() => onDelete(id)}
            className="text-sm px-3 py-1 border rounded text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
