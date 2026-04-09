"use client";

import { useState, useRef } from "react";
import { SLUG_REGEX, SLUG_MIN, SLUG_MAX } from "@/lib/slug";

interface SlugInputProps {
  formId: string;
  currentSlug: string | undefined;
  onSlugChange: (slug: string | null) => void;
  canCustomize: boolean;
  locale: string;
}

export function SlugInput({ formId, currentSlug, onSlugChange, canCustomize, locale }: SlugInputProps) {
  const [value, setValue] = useState(currentSlug ?? "");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const lastChecked = useRef("");

  if (!canCustomize) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 p-4 text-center">
        <p className="text-xs text-gray-500 mb-1">Custom URL</p>
        <p className="text-xs text-gray-400">
          Available on{" "}
          <a href={`/${locale}/dashboard/billing`} className="text-green-700 underline">
            PRO plan
          </a>
        </p>
      </div>
    );
  }

  async function handleBlur() {
    const slug = value.trim();

    // No change
    if (slug === (currentSlug ?? "")) return;

    // Clear slug
    if (slug === "") {
      setSaving(true);
      await fetch(`/api/forms/${formId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: null }),
      });
      setSaving(false);
      setStatus("idle");
      onSlugChange(null);
      return;
    }

    // Client-side format check
    if (slug.length < SLUG_MIN || slug.length > SLUG_MAX || !SLUG_REGEX.test(slug)) {
      setStatus("invalid");
      setErrorMsg("Use only lowercase letters, numbers, and hyphens (3–60 characters, no leading/trailing hyphens)");
      return;
    }

    // Availability check
    setStatus("checking");
    lastChecked.current = slug;
    const res = await fetch(`/api/forms/${formId}/slug-check?slug=${encodeURIComponent(slug)}`);
    const { available, error } = await res.json();

    if (slug !== lastChecked.current) return; // stale

    if (error) {
      setStatus("invalid");
      setErrorMsg(error);
      return;
    }

    if (!available) {
      setStatus("taken");
      setErrorMsg("This URL is already taken");
      return;
    }

    // Save
    setSaving(true);
    const saveRes = await fetch(`/api/forms/${formId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    setSaving(false);

    if (!saveRes.ok) {
      const { error: saveErr } = await saveRes.json();
      setStatus("invalid");
      setErrorMsg(saveErr ?? "Failed to save");
      return;
    }

    setStatus("available");
    onSlugChange(slug);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
    setStatus("idle");
    setErrorMsg("");
  }

  async function handleClear() {
    setValue("");
    setStatus("idle");
    setErrorMsg("");
    setSaving(true);
    await fetch(`/api/forms/${formId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: null }),
    });
    setSaving(false);
    onSlugChange(null);
  }

  const displaySlug = value.trim() || "your-form-slug";

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-900">Custom URL</label>

      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="your-form-slug"
          className={`w-full border rounded px-3 py-1.5 text-sm text-gray-900 pr-7 ${
            status === "invalid" || status === "taken"
              ? "border-red-400 focus:ring-red-300"
              : status === "available"
              ? "border-green-400 focus:ring-green-300"
              : "border-gray-300"
          }`}
        />
        {value && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            type="button"
          >
            ×
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400">
        stelld.ca/{locale}/f/<span className="text-gray-600">{displaySlug}</span>
      </p>

      {status === "checking" && (
        <p className="text-xs text-gray-400">Checking availability…</p>
      )}
      {saving && (
        <p className="text-xs text-gray-400">Saving…</p>
      )}
      {status === "available" && !saving && (
        <p className="text-xs text-green-600">URL saved</p>
      )}
      {(status === "invalid" || status === "taken") && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}
    </div>
  );
}
