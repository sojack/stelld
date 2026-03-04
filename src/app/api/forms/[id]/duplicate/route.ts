import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const original = await prisma.form.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!original) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const duplicate = await prisma.form.create({
    data: {
      userId: session.user.id,
      title: `${original.title} (Copy)`,
      description: original.description,
      schema: original.schema as object,
      settings: original.settings as object,
      isPublished: false,
    },
  });

  return NextResponse.json(duplicate, { status: 201 });
}
