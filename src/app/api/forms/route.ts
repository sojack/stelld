import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
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
