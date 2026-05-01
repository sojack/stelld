import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveAccount } from "@/lib/account-context";
import { can } from "@/lib/access";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getActiveAccount(session.user.id);
  if (!ctx || !can(ctx.role, "MANAGE_MEMBERS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await prisma.accountMember.findMany({
    where: { accountId: ctx.accountId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}
