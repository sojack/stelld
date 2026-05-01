import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveAccount } from "@/lib/account-context";
import { can } from "@/lib/access";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getActiveAccount(session.user.id);
  if (!ctx || !can(ctx.role, "MANAGE_MEMBERS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite || invite.accountId !== ctx.accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.invite.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
