import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }

  const account = await prisma.appAccount.findUnique({ where: { id: accountId } });
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (account.ownerId === session.user.id) {
    return NextResponse.json({ error: "Cannot leave your own account" }, { status: 400 });
  }

  await prisma.accountMember.deleteMany({
    where: { accountId, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
