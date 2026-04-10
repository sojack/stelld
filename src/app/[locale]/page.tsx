import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Footer } from "@/components/footer";
import { PricingSection } from "@/components/home/pricing-section";

export default async function HomePage() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Language switcher */}
      <div className="flex justify-end px-6 pt-4">
        <LanguageSwitcher />
      </div>
      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-2xl">
          <h1 className="text-5xl font-bold text-gray-900 leading-tight tracking-tight">
            {t("heroTitle1")}
            <br />
            {t("heroTitle2")}
          </h1>
          <p className="mt-6 text-xl text-gray-600 leading-relaxed max-w-lg mx-auto">
            {t("heroDescription")}
          </p>
          <div className="mt-8 flex gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-black text-white font-medium px-7 py-3 rounded-md text-lg hover:bg-gray-800 transition-colors"
            >
              {t("getStarted")}
            </Link>
            <Link
              href="/login"
              className="border border-gray-300 font-medium px-7 py-3 rounded-md text-lg text-gray-700 hover:bg-white transition-colors"
            >
              {t("logIn")}
            </Link>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-4 py-2">
            <span className="text-lg leading-none">🍁</span>
            {tc("hostedInCanada")}
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
            <h3 className="font-semibold text-gray-900 text-lg mb-2">{t("featureBuilderTitle")}</h3>
            <p className="text-gray-600 leading-relaxed">
              {t("featureBuilderDesc")}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-4">
              <span className="text-green-700 text-lg font-bold">CA</span>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-2">{t("featureDataTitle")}</h3>
            <p className="text-gray-600 leading-relaxed">
              {t("featureDataDesc")}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-4">
              <span className="text-green-700 text-lg font-bold">@</span>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-2">{t("featureNotifyTitle")}</h3>
            <p className="text-gray-600 leading-relaxed">
              {t("featureNotifyDesc")}
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <PricingSection />

      {/* Shakespeare Quote */}
      <section className="px-6 pb-20">
        <div className="max-w-2xl mx-auto text-center">
          <blockquote className="text-gray-500 italic leading-relaxed">
            &ldquo;{t("shakespeareQuote")}&rdquo;
          </blockquote>
          <cite className="mt-2 block text-sm text-gray-400 not-italic">
            {t("shakespeareAttribution")}
          </cite>
        </div>
      </section>

      <Footer />
    </div>
  );
}
