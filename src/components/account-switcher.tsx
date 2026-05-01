"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";

interface AccountOption {
  id: string;
  name: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
}

export function AccountSwitcher() {
  const t = useTranslations("members");
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        setAccounts(data.accounts ?? []);
        setActiveId(data.activeAccountId ?? null);
      });
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function switchTo(id: string) {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    await fetch("/api/accounts/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: id }),
    });
    router.refresh();
    setOpen(false);
    setSwitching(false);
    // Force a reload so server components re-read the cookie.
    window.location.href = "/dashboard";
  }

  if (accounts.length === 0) return null;
  if (accounts.length === 1) {
    return <span className="text-sm font-medium text-gray-700">{accounts[0].name}</span>;
  }

  const active = accounts.find((a) => a.id === activeId) ?? accounts[0];

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen(!open)}
        className="text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-1"
      >
        {active.name}
        <span className="text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => switchTo(a.id)}
              disabled={switching}
              className={`block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${a.id === activeId ? "bg-gray-50 font-medium" : ""}`}
            >
              <div>{a.name}</div>
              {a.role !== "OWNER" && (
                <div className="text-xs text-gray-500">
                  {a.role === "EDITOR" ? t("roleEditor") : t("roleViewer")}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
