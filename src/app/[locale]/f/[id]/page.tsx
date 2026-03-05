import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { FormRenderer } from "@/components/form-renderer";

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  const form = await prisma.form.findFirst({
    where: { id, isPublished: true },
  });

  if (!form) notFound();

  const settings = form.settings as { thankYouMessage?: string };

  return (
    <FormRenderer
      formId={form.id}
      schema={form.schema as object}
      thankYouMessage={settings.thankYouMessage}
      locale={locale}
    />
  );
}
