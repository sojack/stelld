import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveAccount } from "@/lib/account-context";
import { can } from "@/lib/access";
import { sendInviteEmail } from "@/lib/email";
import { inviteSendLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function POST(
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

  if (inviteSendLimiter(session.user.id)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite || invite.accountId !== ctx.accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json({ error: "Already accepted" }, { status: 400 });
  }

  let token = invite.token;
  let expiresAt = invite.expiresAt;
  if (expiresAt < new Date()) {
    token = randomBytes(32).toString("base64url");
    expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.invite.update({
      where: { id },
      data: { token, expiresAt },
    });
  }

  const account = await prisma.appAccount.findUnique({
    where: { id: ctx.accountId },
    include: { owner: { select: { email: true, name: true } } },
  });

  await sendInviteEmail({
    toEmail: invite.email,
    accountName: account!.name,
    inviterName: account!.owner.name ?? account!.owner.email,
    role: invite.role,
    token,
  });

  return NextResponse.json({ success: true });
}
