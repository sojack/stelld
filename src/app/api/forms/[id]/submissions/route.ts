import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFormAccess, can } from "@/lib/access";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getFormAccess(session.user.id, id);
  if (!access || !can(access.role, "VIEW_SUBMISSIONS")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const submissions = await prisma.submission.findMany({
    where: { formId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ form: access.form, submissions, role: access.role });
}
