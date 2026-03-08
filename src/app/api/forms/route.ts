import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlanLimits } from "@/lib/plans";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forms = await prisma.form.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { submissions: true } } },
  });

  return NextResponse.json(forms);
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });
  const limits = getPlanLimits(subscription?.plan);
  const formCount = await prisma.form.count({
    where: { userId: session.user.id },
  });
  if (formCount >= limits.maxForms) {
    return NextResponse.json({ error: "FORM_LIMIT_REACHED" }, { status: 403 });
  }

  const form = await prisma.form.create({
    data: {
      userId: session.user.id,
      title: "Untitled Form",
      schema: {},
      settings: { thankYouMessage: "Thank you for your submission!" },
    },
  });

  return NextResponse.json(form, { status: 201 });
}
