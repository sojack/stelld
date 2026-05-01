import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setActiveAccountCookie } from "@/lib/account-context";
import { inviteLookupLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (inviteLookupLimiter(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: {
      account: { include: { owner: { select: { name: true, email: true } } } },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "INVALID" }, { status: 404 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json({ error: "ALREADY_ACCEPTED" }, { status: 410 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "EXPIRED" }, { status: 410 });
  }

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    accountName: invite.account.name,
    inviterName: invite.account.owner.name ?? invite.account.owner.email,
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const userEmail = session.user.email;

  const result = await prisma.$transaction(async (tx) => {
    const invite = await tx.invite.findUnique({ where: { token } });
    if (!invite) return { error: "INVALID" as const };
    if (invite.acceptedAt) return { error: "ALREADY_ACCEPTED" as const };
    if (invite.expiresAt < new Date()) return { error: "EXPIRED" as const };
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      return { error: "EMAIL_MISMATCH" as const, inviteEmail: invite.email };
    }

    const existing = await tx.accountMember.findUnique({
      where: { accountId_userId: { accountId: invite.accountId, userId } },
    });
    if (!existing) {
      await tx.accountMember.create({
        data: {
          accountId: invite.accountId,
          userId,
          role: invite.role,
        },
      });
    }
    await tx.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    return { ok: true as const, accountId: invite.accountId };
  });

  if ("error" in result) {
    const status = result.error === "EMAIL_MISMATCH" ? 403 : 410;
    return NextResponse.json(result, { status });
  }

  await setActiveAccountCookie(result.accountId);
  return NextResponse.json({ success: true, accountId: result.accountId });
}
