"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SurveyCreatorComponent, SurveyCreator } from "survey-creator-react";
import "survey-core/defaultV2.min.css";
import "survey-creator-core/survey-creator-core.min.css";

interface FormBuilderProps {
  formId: string;
  initialSchema: object;
  initialTitle: string;
  isPublished: boolean;
}

export function FormBuilder({ formId, initialSchema, initialTitle, isPublished }: FormBuilderProps) {
  const [title, setTitle] = useState(initialTitle);
  const [published, setPublished] = useState(isPublished);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const creatorRef = useRef<SurveyCreator | null>(null);

  useEffect(() => {
    const creator = new SurveyCreator({
      showLogicTab: true,
      showJSONEditorTab: true,
      isAutoSave: false,
    });

    if (Object.keys(initialSchema).length > 0) {
      creator.JSON = initialSchema;
    }

    creator.saveSurveyFunc = (saveNo: number, callback: (no: number, success: boolean) => void) => {
      saveForm(creator.JSON).then(() => callback(saveNo, true));
    };

    creatorRef.current = creator;

    // Auto-save on change (debounced 3s)
    creator.onModified.add(() => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveForm(creator.JSON);
      }, 3000);
    });

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const saveForm = useCallback(async (schema?: object) => {
    setSaving(true);
    await fetch(`/api/forms/${formId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        schema: schema ?? creatorRef.current?.JSON,
      }),
    });
    setSaving(false);
    setLastSaved(new Date());
  }, [formId, title]);

  async function togglePublish() {
    const newState = !published;
    await fetch(`/api/forms/${formId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: newState }),
    });
    setPublished(newState);
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">&larr; Dashboard</a>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveForm()}
            className="font-medium text-lg border-none outline-none focus:ring-1 focus:ring-gray-300 rounded px-2 py-1"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {saving ? "Saving..." : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : ""}
          </span>
          {published && (
            <a
              href={`/f/${formId}`}
              target="_blank"
              className="text-sm text-blue-600 hover:underline"
            >
              View live form
            </a>
          )}
          <button
            onClick={togglePublish}
            className={`text-sm px-4 py-1.5 rounded ${
              published
                ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      {/* SurveyJS Creator */}
      <div className="flex-1">
        {creatorRef.current && <SurveyCreatorComponent creator={creatorRef.current} />}
      </div>
    </div>
  );
}
