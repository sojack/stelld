"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.min.css";
import "./form-renderer.css";

interface FormRendererProps {
  formId: string;
  schema: object;
  thankYouMessage: string;
}

const THEME_OVERRIDES = {
  cssVariables: {
    "--sjs-primary-backcolor": "#16a34a",
    "--sjs-primary-backcolor-light": "rgba(22, 163, 74, 0.1)",
    "--sjs-primary-backcolor-dark": "#15803d",
    "--sjs-primary-forecolor": "#ffffff",
    "--sjs-general-backcolor": "#ffffff",
    "--sjs-general-backcolor-dim": "#f9fafb",
    "--sjs-general-forecolor": "#111827",
    "--sjs-general-forecolor-light": "#4b5563",
    "--sjs-general-dim-forecolor": "#374151",
    "--sjs-general-dim-forecolor-light": "#6b7280",
    "--sjs-border-default": "#9ca3af",
    "--sjs-border-light": "#d1d5db",
    "--sjs-border-inside": "#9ca3af",
    "--sjs-font-family": "inherit",
    "--sjs-font-size": "16px",
    "--sjs-corner-radius": "6px",
    "--sjs-base-unit": "8px",
    "--sjs-shadow-small": "0 1px 2px 0 rgba(0,0,0,0.05)",
    "--sjs-shadow-inner": "none",
  },
};

export function FormRenderer({ formId, schema, thankYouMessage }: FormRendererProps) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const surveyRef = useRef<Model | null>(null);

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleFocusIn(e: FocusEvent) {
      const target = e.target as HTMLElement;
      if (
        (target instanceof HTMLInputElement &&
          (target.type === "text" || target.type === "email" || target.type === "tel" ||
           target.type === "number" || target.type === "date" || target.type === "url")) ||
        target instanceof HTMLTextAreaElement
      ) {
        setTimeout(() => {
          (target as HTMLInputElement | HTMLTextAreaElement).select();
        }, 50);
      }
    }

    container.addEventListener("focusin", handleFocusIn);
    return () => container.removeEventListener("focusin", handleFocusIn);
  }, []);

  useEffect(() => {
    if (!surveyRef.current) {
      const survey = new Model(schema);
      survey.applyTheme(THEME_OVERRIDES as Parameters<typeof survey.applyTheme>[0]);
      survey.showCompletedPage = false;
      survey.onComplete.add(onComplete);
      surveyRef.current = survey;
    }
  }, [schema, onComplete]);

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-sm border max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank you!</h2>
          <p className="text-gray-600">{thankYouMessage}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-sm border max-w-md">
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (!surveyRef.current) {
    return null;
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-gray-50 py-10">
      <input
        id="_hp_field"
        name="_hp_field"
        type="text"
        tabIndex={-1}
        style={{ position: "absolute", left: "-9999px" }}
        autoComplete="off"
        aria-hidden="true"
      />
      <div className="max-w-3xl mx-auto">
        <Survey model={surveyRef.current} />
      </div>
    </div>
  );
}
