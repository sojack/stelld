import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-2xl">
          <h1 className="text-5xl font-bold text-gray-900 leading-tight tracking-tight">
            Build forms.
            <br />
            Keep data in Canada.
          </h1>
          <p className="mt-6 text-xl text-gray-600 leading-relaxed max-w-lg mx-auto">
            A simple, privacy-first form builder for Canadian businesses.
            All data stored on Canadian servers — no US transfers.
          </p>
          <div className="mt-8 flex gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-black text-white font-medium px-7 py-3 rounded-md text-lg hover:bg-gray-800 transition-colors"
            >
              Get started free
            </Link>
            <Link
              href="/login"
              className="border border-gray-300 font-medium px-7 py-3 rounded-md text-lg text-gray-700 hover:bg-white transition-colors"
            >
              Log in
            </Link>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-4 py-2">
            <span className="text-lg leading-none">🍁</span>
            Hosted in Canada
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-4">
              <span className="text-green-700 text-lg font-bold">#</span>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-2">Drag & Drop Builder</h3>
            <p className="text-gray-600 leading-relaxed">
              Build forms in minutes with an intuitive editor. No code required.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-4">
              <span className="text-green-700 text-lg font-bold">CA</span>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-2">Canadian Data Residency</h3>
            <p className="text-gray-600 leading-relaxed">
              All data stored in AWS ca-central-1. Your data never leaves the country.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-4">
              <span className="text-green-700 text-lg font-bold">@</span>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-2">Instant Notifications</h3>
            <p className="text-gray-600 leading-relaxed">
              Get email alerts the moment someone submits a response. Export to CSV anytime.
            </p>
          </div>
        </div>
      </section>

      {/* Shakespeare Quote */}
      <section className="px-6 pb-20">
        <div className="max-w-2xl mx-auto text-center">
          <blockquote className="text-gray-500 italic leading-relaxed">
            &ldquo;Mine eye hath play&apos;d the painter and hath stell&apos;d
            / Thy beauty&apos;s form in table of my heart.&rdquo;
          </blockquote>
          <cite className="mt-2 block text-sm text-gray-400 not-italic">
            — William Shakespeare, Sonnet 24
          </cite>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 py-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-semibold text-gray-900">Stelld</p>
          <p className="text-sm text-gray-500 mt-1">Built in Canada</p>
        </div>
      </footer>
    </div>
  );
}
