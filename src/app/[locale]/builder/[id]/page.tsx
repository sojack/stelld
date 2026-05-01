import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/routing";
import { FormBuilder } from "@/components/form-builder";
import { getFormAccess } from "@/lib/access";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/login", locale: locale as "en" | "fr" });

  const access = await getFormAccess(session!.user!.id!, id);
  if (!access) notFound();

  const account = await prisma.appAccount.findUnique({
    where: { id: access.form.accountId },
    select: { ownerId: true },
  });
  const subscription = await prisma.subscription.findUnique({
    where: { userId: account!.ownerId },
  });

  return (
    <FormBuilder
      formId={access.form.id}
      initialSchema={access.form.schema as object}
      initialTitle={access.form.title}
      initialDescription={access.form.description ?? ""}
      initialSettings={(access.form.settings as { bannerUrl?: string; thankYouMessage?: string }) ?? {}}
      initialSlug={access.form.slug ?? undefined}
      isPublished={access.form.isPublished}
      locale={locale}
      plan={subscription?.plan ?? "FREE"}
      role={access.role}
    />
  );
}
