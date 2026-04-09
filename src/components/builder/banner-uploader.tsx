"use client";

import { useRef, useState } from "react";

interface BannerUploaderProps {
  formId: string;
  bannerUrl: string | undefined;
  onBannerChange: (url: string | null) => void;
  canUpload: boolean;
}

const MAX_BYTES = 5 * 1024 * 1024;

export function BannerUploader({ formId, bannerUrl, onBannerChange, canUpload }: BannerUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);

  if (!canUpload) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 p-4 text-center">
        <p className="text-xs text-gray-500 mb-1">Banner image</p>
        <p className="text-xs text-gray-400">
          Available on{" "}
          <a href="/en/dashboard/billing" className="text-green-700 underline">
            PRO plan
          </a>
        </p>
      </div>
    );
  }

  async function handleFile(file: File) {
    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be 5 MB or smaller.");
      return;
    }

    // Aspect ratio hint
    await new Promise<void>((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const ratio = img.width / img.height;
        URL.revokeObjectURL(url);
        if (ratio < 2 || ratio > 5) {
          setError("Tip: a 3:1 wide image (e.g. 1200×400) looks best as a banner.");
        }
        resolve();
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      img.src = url;
    });

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const res = await fetch(`/api/forms/${formId}/banner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ext, size: file.size, contentType: file.type }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        setError(msg ?? "Upload failed.");
        return;
      }

      const { uploadUrl, publicUrl } = await res.json();

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!putRes.ok) {
        setError("Upload to storage failed. Please try again.");
        return;
      }

      onBannerChange(publicUrl);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError("");
    try {
      await fetch(`/api/forms/${formId}/banner`, { method: "DELETE" });
      onBannerChange(null);
    } catch {
      setError("Failed to remove banner.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-900">Banner image</label>
      <p className="text-xs text-gray-500">Recommended: 1200×400px (3:1), max 5 MB</p>

      {bannerUrl ? (
        <div className="space-y-2">
          <div className="w-full aspect-[3/1] overflow-hidden rounded border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bannerUrl} alt="Form banner" className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-blue-600 hover:underline disabled:opacity-50"
            >
              Replace
            </button>
            <span className="text-xs text-gray-300">|</span>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="text-xs text-red-500 hover:underline disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-gray-300 rounded-md py-6 text-center text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Click to upload banner image"}
        </button>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
