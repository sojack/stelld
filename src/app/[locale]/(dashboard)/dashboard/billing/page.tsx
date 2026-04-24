"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/routing";

interface BillingStatus {
  plan: "FREE" | "PRO" | "BUSINESS";
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  limits: {
    maxForms: number;
    maxSubmissionsPerMonth: number;
    canCollectPayments: boolean;
  };
  usage: {
    forms: number;
    submissionsThisMonth: number;
  };
}

export default function BillingPage() {
  const t = useTranslations("billing");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [connect, setConnect] = useState<{ connected: boolean; onboardingComplete?: boolean; payoutsEnabled?: boolean } | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);

  const result = searchParams.get("result");

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((data) => {
        setBilling(data);
        setLoading(false);
      });
    fetch("/api/billing/connect").then((r) => r.json()).then(setConnect);
  }, []);

  async function handleCheckout(priceKey: string) {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceKey, locale }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  async function handleConnect() {
    const res = await fetch("/api/billing/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  async function handlePortal() {
    setPortalError(null);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPortalError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setPortalError("Something went wrong. Please try again.");
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-gray-600 text-lg">Loading...</div>;
  }

  if (!billing) return null;

  const planLabel = t(billing.plan.toLowerCase() as "free" | "pro" | "business");
  const isFreePlan = billing.plan === "FREE";
  const formsDisplay = billing.limits.maxForms >= 999999
    ? t("formsUsedUnlimited", { used: billing.usage.forms })
    : t("formsUsed", { used: billing.usage.forms, limit: billing.limits.maxForms });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("title")}</h1>

      {result === "success" && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm font-medium">
          {t("success")}
        </div>
      )}
      {result === "canceled" && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm font-medium">
          {t("canceled")}
        </div>
      )}

      {portalError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm font-medium">
          {portalError}
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">{t("currentPlan")}</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-gray-900">{planLabel}</p>
            {billing.cancelAtPeriodEnd && (
              <p className="text-sm text-orange-600 mt-1">{t("cancelAtPeriodEnd")}</p>
            )}
            {billing.status === "PAST_DUE" && (
              <p className="text-sm text-red-600 mt-1">{t("pastDue")}</p>
            )}
          </div>
          {!isFreePlan && (
            <button
              onClick={handlePortal}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md px-4 py-2 transition-colors"
            >
              {t("manageBilling")}
            </button>
          )}
        </div>
      </div>

      {/* Usage */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">{t("usage")}</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">{formsDisplay}</span>
            </div>
            {billing.limits.maxForms < 999999 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (billing.usage.forms / billing.limits.maxForms) * 100)}%` }}
                />
              </div>
            )}
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">
                {t("submissionsUsed", {
                  used: billing.usage.submissionsThisMonth,
                  limit: billing.limits.maxSubmissionsPerMonth,
                })}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (billing.usage.submissionsThisMonth / billing.limits.maxSubmissionsPerMonth) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stripe Connect (Business only) */}
      {billing.plan === "BUSINESS" && connect && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">{t("paymentField")}</h2>
          {connect.connected && connect.onboardingComplete ? (
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm text-gray-700">{t("stripeConnected")} — {t("payoutsEnabled")}</span>
            </div>
          ) : connect.connected ? (
            <div>
              <p className="text-sm text-yellow-700 mb-3">{t("onboardingIncomplete")}</p>
              <button
                onClick={handleConnect}
                className="text-sm font-medium text-green-600 hover:underline"
              >
                {t("onboardingIncomplete")}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="bg-green-600 text-white font-medium px-5 py-2 rounded-md hover:bg-green-700 transition-colors"
            >
              {t("connectStripe")}
            </button>
          )}
        </div>
      )}

      {/* Upgrade Cards (Free plan only) */}
      {isFreePlan && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`text-sm font-medium px-3 py-1 rounded-md ${billingCycle === "monthly" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"}`}
            >
              {t("monthly")}
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`text-sm font-medium px-3 py-1 rounded-md ${billingCycle === "yearly" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"}`}
            >
              {t("yearly")} <span className="text-green-600 text-xs ml-1">{t("savePercent")}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-bold text-gray-900">{t("pro")}</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ${billingCycle === "monthly" ? "19" : "190"}
                <span className="text-sm font-normal text-gray-500">
                  {billingCycle === "monthly" ? t("perMonth") : t("perYear")}
                </span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>50 forms</li>
                <li>1,000 submissions/month</li>
              </ul>
              <button
                onClick={() => handleCheckout(`pro_${billingCycle}`)}
                className="mt-6 w-full bg-green-600 text-white font-medium py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                {t("upgradeToPro")}
              </button>
            </div>

            <div className="bg-white rounded-lg border-2 border-green-600 p-6">
              <h3 className="text-lg font-bold text-gray-900">{t("business")}</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ${billingCycle === "monthly" ? "49" : "490"}
                <span className="text-sm font-normal text-gray-500">
                  {billingCycle === "monthly" ? t("perMonth") : t("perYear")}
                </span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>Unlimited forms</li>
                <li>10,000 submissions/month</li>
                <li>Payment collection</li>
              </ul>
              <button
                onClick={() => handleCheckout(`business_${billingCycle}`)}
                className="mt-6 w-full bg-green-600 text-white font-medium py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                {t("upgradeToBusiness")}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Pro -> Business upgrade */}
      {billing.plan === "PRO" && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2">{t("upgradeToBusiness")}</h3>
          <p className="text-sm text-gray-600 mb-4">Unlimited forms, 10,000 submissions/month, payment collection</p>
          <button
            onClick={handlePortal}
            className="bg-green-600 text-white font-medium px-5 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            {t("upgrade")}
          </button>
        </div>
      )}
    </div>
  );
}
