"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (!token) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid reset link</h1>
        <p className="text-gray-600 mb-4">This password reset link is invalid or has expired.</p>
        <Link href="/forgot-password" className="text-sm font-medium text-gray-900 hover:underline">
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Set new password</h1>
      {success ? (
        <div>
          <p className="text-green-600 font-medium mb-4">Your password has been reset successfully.</p>
          <Link href="/login" className="text-sm font-medium text-gray-900 hover:underline">
            Log in with your new password
          </Link>
        </div>
      ) : (
        <>
          {error && <p className="text-red-600 font-medium mb-4">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input id="password" name="password" type="password" required minLength={8} className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600" />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-black text-white font-medium py-2.5 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50">
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-xl font-bold text-gray-900">Stelld</Link>
        </div>
        <Suspense fallback={
          <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
            <p className="text-gray-500">Loading...</p>
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
