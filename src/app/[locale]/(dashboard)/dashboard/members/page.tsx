import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { getActiveAccount } from "@/lib/account-context";
import { getPlanLimits } from "@/lib/plans";
import { prisma } from "@/lib/db";
import { MembersPage } from "@/components/members-page";

export default async function MembersRoutePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/login", locale: locale as "en" | "fr" });

  const ctx = await getActiveAccount(session!.user!.id!);
  if (!ctx || ctx.role !== "OWNER") {
    redirect({ href: "/dashboard", locale: locale as "en" | "fr" });
  }

  const account = await prisma.appAccount.findUnique({ where: { id: ctx!.accountId } });
  const subscription = await prisma.subscription.findUnique({
    where: { userId: account!.ownerId },
  });
  const limits = getPlanLimits(subscription?.plan);

  return (
    <MembersPage
      accountName={account!.name}
      maxMembers={limits.maxMembers === Infinity ? Number.MAX_SAFE_INTEGER : limits.maxMembers}
    />
  );
}
