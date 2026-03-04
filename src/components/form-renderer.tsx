"use client";

import { useCallback, useState } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.min.css";

interface FormRendererProps {
  formId: string;
  schema: object;
  thankYouMessage: string;
}

export function FormRenderer({ formId, schema, thankYouMessage }: FormRendererProps) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const onComplete = useCallback(async (sender: Model) => {
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formId,
        data: sender.data,
        honeypot: (document.getElementById("_hp_field") as HTMLInputElement)?.value ?? "",
      }),
    });

    if (!res.ok) {
      setError("Something went wrong. Please try again.");
      return;
    }

    setSubmitted(true);
  }, [formId]);

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold mb-2">Thank you!</h2>
          <p className="text-gray-600">{thankYouMessage}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const survey = new Model(schema);
  survey.onComplete.add(onComplete);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* Honeypot — hidden from humans, visible to bots */}
      <input
        id="_hp_field"
        name="_hp_field"
        type="text"
        style={{ position: "absolute", left: "-9999px", tabIndex: -1 } as React.CSSProperties}
        autoComplete="off"
        aria-hidden="true"
      />
      <div className="max-w-3xl mx-auto">
        <Survey model={survey} />
      </div>
    </div>
  );
}
