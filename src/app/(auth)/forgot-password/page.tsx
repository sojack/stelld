"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: formData.get("email") }),
    });

    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-xl font-bold text-gray-900">Stelld</Link>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Reset your password</h1>
          {submitted ? (
            <div>
              <p className="text-gray-600 mb-4">
                If an account exists with that email, we&apos;ve sent a password reset link. Check your inbox.
              </p>
              <Link href="/login" className="text-sm font-medium text-gray-900 hover:underline">
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <p className="text-gray-600 text-sm mb-4">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input id="email" name="email" type="email" required className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600" />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-black text-white font-medium py-2.5 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50">
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>
              <p className="mt-5 text-sm text-center text-gray-600">
                Remember your password? <Link href="/login" className="font-medium text-gray-900 hover:underline">Log in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
