"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import { useTranslations } from "next-intl";
import "survey-core/survey-core.min.css";
import "./form-renderer.css";
import { LanguageSwitcher } from "./language-switcher";

interface FormRendererProps {
  formId: string;
  schema: object;
  title?: string;
  description?: string;
  thankYouMessage?: string;
  bannerUrl?: string;
  footerText?: string;
  footerLink?: string;
  isPaid?: boolean;
  locale: string;
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

export function FormRenderer({ formId, schema, title, description, thankYouMessage, bannerUrl, footerText, footerLink, isPaid, locale }: FormRendererProps) {
  const t = useTranslations("renderer");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const survey = useMemo(() => {
    const s = new Model(schema);
    s.applyTheme(THEME_OVERRIDES as Parameters<typeof s.applyTheme>[0]);
    s.showCompletedPage = false;
    // Set SurveyJS locale for built-in UI translations and localized field strings
    s.locale = locale;
    return s;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update SurveyJS locale when the URL locale changes
  useEffect(() => {
    survey.locale = locale;
  }, [survey, locale]);

  // Check if form has a payment field
  const hasPayment = (() => {
    const s = schema as { pages?: { elements?: Array<{ type: string; paymentAmount?: number }> }[] };
    return s?.pages?.[0]?.elements?.some((el) => el.type === "expression" && el.paymentAmount) ?? false;
  })();

  useEffect(() => {
    const handler = async (sender: Model) => {
      // If form has payment, redirect to Stripe Checkout instead of submitting directly
      if (hasPayment) {
        const res = await fetch("/api/billing/payment-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ formId, data: sender.data, locale }),
        });
        const { url } = await res.json();
        if (url) {
          window.location.href = url;
          return;
        }
        setError(t("submitError"));
        return;
      }

      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId,
          data: sender.data,
          honeypot: (document.getElementById("_hp_field") as HTMLInputElement)?.value ?? "",
        }),
      });

      if (res.status === 403) {
        setError(t("submissionLimitReached"));
        return;
      }
      if (!res.ok) {
        setError(t("submitError"));
        return;
      }

      setSubmitted(true);
    };

    survey.onComplete.add(handler);
    return () => { survey.onComplete.remove(handler); };
  }, [survey, formId, t, hasPayment, locale]);

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

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-sm border max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("thankYou")}</h2>
          <p className="text-gray-600">{thankYouMessage || t("defaultThankYou")}</p>
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

  return (
    <div ref={containerRef} className="min-h-screen bg-gray-50 flex flex-col">
      <input
        id="_hp_field"
        name="_hp_field"
        type="text"
        tabIndex={-1}
        style={{ position: "absolute", left: "-9999px" }}
        autoComplete="off"
        aria-hidden="true"
      />
      <div className="flex justify-end max-w-3xl mx-auto w-full pt-4 px-4">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 max-w-3xl mx-auto w-full py-10">
        {bannerUrl && (
          <div className="w-full aspect-[3/1] overflow-hidden rounded-lg mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        {(title || description) && (
          <div className="text-center mb-6 px-4">
            {title && <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>}
            {description && <p className="text-gray-600">{description}</p>}
          </div>
        )}
        <Survey model={survey} />
      </div>
      {isPaid ? (
        <footer className="border-t border-gray-100 py-6 px-6 text-center space-y-2">
          {footerText && (
            <p className="text-sm font-medium text-gray-700">
              {footerLink ? (
                <a href={footerLink} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {footerText}
                </a>
              ) : footerText}
            </p>
          )}
          <p className="text-xs text-gray-300">Stelld &mdash; Canadian form builder</p>
        </footer>
      ) : (
        <footer className="border-t border-gray-200 py-8 px-6 text-center">
          <p className="text-base font-semibold text-gray-700">Stelld</p>
          <p className="text-sm text-gray-500 mt-1">Canadian form builder</p>
        </footer>
      )}
    </div>
  );
}
