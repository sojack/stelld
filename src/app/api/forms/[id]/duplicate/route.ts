import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFormAccess, can } from "@/lib/access";
import { getPlanLimits } from "@/lib/plans";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getFormAccess(session.user.id, id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!can(access.role, "CREATE_FORM")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const account = await prisma.appAccount.findUnique({
    where: { id: access.form.accountId },
    select: { ownerId: true },
  });
  const subscription = await prisma.subscription.findUnique({
    where: { userId: account!.ownerId },
  });
  const limits = getPlanLimits(subscription?.plan);
  const formCount = await prisma.form.count({ where: { accountId: access.form.accountId } });
  if (formCount >= limits.maxForms) {
    return NextResponse.json({ error: "FORM_LIMIT_REACHED" }, { status: 403 });
  }

  const original = access.form;
  const duplicate = await prisma.form.create({
    data: {
      userId: session.user.id,
      accountId: original.accountId,
      title: `${original.title} (Copy)`,
      description: original.description,
      schema: original.schema as object,
      settings: original.settings as object,
      isPublished: false,
    },
  });

  return NextResponse.json(duplicate, { status: 201 });
}
