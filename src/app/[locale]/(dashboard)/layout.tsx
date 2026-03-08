import { auth } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/routing";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Footer } from "@/components/footer";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect({ href: "/login", locale: locale as "en" | "fr" });

  const t = await getTranslations("nav");
  const tb = await getTranslations("billing");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-xl text-gray-900">Stelld</Link>
        <div className="flex items-center gap-5">
          <Link href="/dashboard/billing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            {tb("title")}
          </Link>
          <LanguageSwitcher />
          <span className="text-sm font-medium text-gray-700">{session!.user!.email}</span>
          <form action={async () => {
            "use server";
            const { signOut } = await import("@/lib/auth");
            await signOut({ redirectTo: `/${locale}/login` });
          }}>
            <button type="submit" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
              {t("logOut")}
            </button>
          </form>
        </div>
      </nav>
      <main className="flex-1 max-w-6xl mx-auto p-8 w-full">{children}</main>
      <Footer />
    </div>
  );
}
