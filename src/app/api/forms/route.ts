import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlanLimits } from "@/lib/plans";
import { getActiveAccount } from "@/lib/account-context";
import { can } from "@/lib/access";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getActiveAccount(session.user.id);
  if (!ctx) {
    return NextResponse.json({ error: "No account" }, { status: 404 });
  }

  const forms = await prisma.form.findMany({
    where: { accountId: ctx.accountId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { submissions: true } },
      user: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({ forms, role: ctx.role });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getActiveAccount(session.user.id);
  if (!ctx) {
    return NextResponse.json({ error: "No account" }, { status: 404 });
  }
  if (!can(ctx.role, "CREATE_FORM")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const account = await prisma.appAccount.findUnique({
    where: { id: ctx.accountId },
    select: { ownerId: true },
  });
  if (!account) {
    return NextResponse.json({ error: "No account" }, { status: 404 });
  }
  const subscription = await prisma.subscription.findUnique({
    where: { userId: account.ownerId },
  });
  const limits = getPlanLimits(subscription?.plan);
  const formCount = await prisma.form.count({ where: { accountId: ctx.accountId } });
  if (formCount >= limits.maxForms) {
    return NextResponse.json({ error: "FORM_LIMIT_REACHED" }, { status: 403 });
  }

  const form = await prisma.form.create({
    data: {
      userId: session.user.id,
      accountId: ctx.accountId,
      title: "Untitled Form",
      schema: {},
      settings: { thankYouMessage: "Thank you for your submission!" },
    },
  });

  return NextResponse.json(form, { status: 201 });
}
