"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export function PricingSection() {
  const t = useTranslations("pricing");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const yearly = cycle === "yearly";

  return (
    <section className="px-6 pb-16">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-2">{t("title")}</h2>
        <p className="text-gray-500 text-center mb-8">{t("subtitle")}</p>

        {/* Billing cycle toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setCycle("monthly")}
            className={`text-sm font-medium px-4 py-1.5 rounded-md transition-colors ${
              !yearly ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t("monthly")}
          </button>
          <button
            onClick={() => setCycle("yearly")}
            className={`text-sm font-medium px-4 py-1.5 rounded-md transition-colors ${
              yearly ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t("yearly")} <span className="text-green-600 ml-1">{t("savePercent")}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col">
            <h3 className="text-lg font-bold text-gray-900">{t("free")}</h3>
            <p className="text-4xl font-bold text-gray-900 mt-3">
              $0
              <span className="text-sm font-normal text-gray-500">{t("perMonth")}</span>
            </p>
            <ul className="mt-6 space-y-2 text-sm text-gray-600 flex-1">
              <li className="flex items-start gap-2"><Check />{t("free5Forms")}</li>
              <li className="flex items-start gap-2"><Check />{t("free100Submissions")}</li>
              <li className="flex items-start gap-2"><Check />{t("emailNotifications")}</li>
              <li className="flex items-start gap-2"><Check />{t("csvExport")}</li>
            </ul>
            <Link
              href="/signup"
              className="mt-8 block text-center border border-gray-300 text-gray-700 font-medium py-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              {t("getStartedFree")}
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-white border-2 border-green-600 rounded-lg p-6 flex flex-col relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
              {t("popular")}
            </span>
            <h3 className="text-lg font-bold text-gray-900">{t("pro")}</h3>
            <p className="text-4xl font-bold text-gray-900 mt-3">
              ${yearly ? "190" : "19"}
              <span className="text-sm font-normal text-gray-500">
                {yearly ? t("perYear") : t("perMonth")}
              </span>
            </p>
            <ul className="mt-6 space-y-2 text-sm text-gray-600 flex-1">
              <li className="flex items-start gap-2"><Check />{t("pro50Forms")}</li>
              <li className="flex items-start gap-2"><Check />{t("pro1000Submissions")}</li>
              <li className="flex items-start gap-2"><Check />{t("emailNotifications")}</li>
              <li className="flex items-start gap-2"><Check />{t("csvExport")}</li>
              <li className="flex items-start gap-2"><Check />{t("customSlug")}</li>
              <li className="flex items-start gap-2"><Check />{t("bannerImage")}</li>
            </ul>
            <Link
              href="/signup"
              className="mt-8 block text-center bg-green-600 text-white font-medium py-2 rounded-md hover:bg-green-700 transition-colors"
            >
              {t("getStarted")}
            </Link>
          </div>

          {/* Business */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col">
            <h3 className="text-lg font-bold text-gray-900">{t("business")}</h3>
            <p className="text-4xl font-bold text-gray-900 mt-3">
              ${yearly ? "490" : "49"}
              <span className="text-sm font-normal text-gray-500">
                {yearly ? t("perYear") : t("perMonth")}
              </span>
            </p>
            <ul className="mt-6 space-y-2 text-sm text-gray-600 flex-1">
              <li className="flex items-start gap-2"><Check />{t("businessUnlimitedForms")}</li>
              <li className="flex items-start gap-2"><Check />{t("business10000Submissions")}</li>
              <li className="flex items-start gap-2"><Check />{t("emailNotifications")}</li>
              <li className="flex items-start gap-2"><Check />{t("csvExport")}</li>
              <li className="flex items-start gap-2"><Check />{t("customSlug")}</li>
              <li className="flex items-start gap-2"><Check />{t("bannerImage")}</li>
              <li className="flex items-start gap-2"><Check />{t("paymentCollection")}</li>
            </ul>
            <Link
              href="/signup"
              className="mt-8 block text-center border border-gray-300 text-gray-700 font-medium py-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              {t("getStarted")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Check() {
  return (
    <svg className="w-4 h-4 text-green-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
