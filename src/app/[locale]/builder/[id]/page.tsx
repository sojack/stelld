import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/routing";
import { FormBuilder } from "@/components/form-builder";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/login", locale: locale as "en" | "fr" });

  const [form, subscription] = await Promise.all([
    prisma.form.findFirst({
      where: { id, userId: session!.user!.id },
    }),
    prisma.subscription.findUnique({
      where: { userId: session!.user!.id },
    }),
  ]);

  if (!form) notFound();

  return (
    <FormBuilder
      formId={form.id}
      initialSchema={form.schema as object}
      initialTitle={form.title}
      initialDescription={form.description ?? ""}
      initialSettings={(form.settings as { bannerUrl?: string; thankYouMessage?: string }) ?? {}}
      isPublished={form.isPublished}
      locale={locale}
      plan={subscription?.plan ?? "FREE"}
    />
  );
}
