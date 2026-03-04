import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-xl text-gray-900">Stelld</Link>
        <div className="flex items-center gap-5">
          <span className="text-sm font-medium text-gray-700">{session.user.email}</span>
          <form action={async () => {
            "use server";
            const { signOut } = await import("@/lib/auth");
            await signOut({ redirectTo: "/login" });
          }}>
            <button type="submit" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
              Log out
            </button>
          </form>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-8">{children}</main>
    </div>
  );
}
