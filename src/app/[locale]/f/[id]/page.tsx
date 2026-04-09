import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { permanentRedirect } from "next/navigation";
import { FormRenderer } from "@/components/form-renderer";

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

    // If accessed by UUID but form has a slug, redirect permanently
    if (form.slug) {
      permanentRedirect(`/${locale}/f/${form.slug}`);
    }
  }

  const settings = form.settings as { thankYouMessage?: string; bannerUrl?: string };

  return (
    <FormRenderer
      formId={form.id}
      schema={form.schema as object}
      title={form.title}
      description={form.description ?? ""}
      thankYouMessage={settings.thankYouMessage}
      bannerUrl={settings.bannerUrl}
      locale={locale}
    />
  );
}
