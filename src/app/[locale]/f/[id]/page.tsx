import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { FormRenderer } from "@/components/form-renderer";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const form = await prisma.form.findFirst({
    where: { OR: [{ slug: id }, { id }], isPublished: true },
    select: { title: true },
  });
  return { title: form?.title ?? "Stelld" };
}

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  // Try slug lookup first
  let form = await prisma.form.findFirst({
    where: { slug: id, isPublished: true },
  });

  if (!form) {
    // Fall back to UUID lookup
    form = await prisma.form.findFirst({
      where: { id, isPublished: true },
    });

    if (!form) notFound();

    // If accessed by UUID but form has a slug, redirect to slug URL
    if (form.slug) {
      redirect(`/${locale}/f/${form.slug}`);
    }
  }

  const settings = form.settings as {
    thankYouMessage?: string;
    bannerUrl?: string;
    footerText?: string;
    footerLink?: string;
  };

  const subscription = await prisma.subscription.findUnique({
    where: { userId: form.userId },
  });
  const isPaid = subscription?.plan === "PRO" || subscription?.plan === "BUSINESS";

  return (
    <FormRenderer
      formId={form.id}
      schema={form.schema as object}
      title={form.title}
      description={form.description ?? ""}
      thankYouMessage={settings.thankYouMessage}
      bannerUrl={settings.bannerUrl}
      footerText={settings.footerText}
      footerLink={settings.footerLink}
      isPaid={isPaid}
      locale={locale}
    />
  );
}
