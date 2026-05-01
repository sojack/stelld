import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveAccount } from "@/lib/account-context";
import { can } from "@/lib/access";
import { getPlanLimits } from "@/lib/plans";
import { sendInviteEmail } from "@/lib/email";
import { inviteSendLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import type { MemberRole } from "@/generated/prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getActiveAccount(session.user.id);
  if (!ctx || !can(ctx.role, "MANAGE_MEMBERS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.invite.findMany({
    where: { accountId: ctx.accountId, acceptedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invites);
}

export async function POST(req: Request) {
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

  const body = await req.json();
  const email = (body.email ?? "").toLowerCase().trim();
  const role = body.role as MemberRole;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (role !== "VIEWER" && role !== "EDITOR") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const account = await prisma.appAccount.findUnique({
    where: { id: ctx.accountId },
    include: { owner: { select: { email: true, name: true } } },
  });
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (account.owner.email.toLowerCase() === email) {
    return NextResponse.json({ error: "SELF_INVITE" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMember = await prisma.accountMember.findUnique({
      where: { accountId_userId: { accountId: ctx.accountId, userId: existingUser.id } },
    });
    if (existingMember) {
      return NextResponse.json({ error: "ALREADY_MEMBER" }, { status: 409 });
    }
  }

  const existingInvite = await prisma.invite.findUnique({
    where: { accountId_email: { accountId: ctx.accountId, email } },
  });
  if (existingInvite && !existingInvite.acceptedAt && existingInvite.expiresAt > new Date()) {
    return NextResponse.json({ error: "INVITE_DUPLICATE" }, { status: 409 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: account.ownerId },
  });
  const limits = getPlanLimits(subscription?.plan);
  const memberCount = await prisma.accountMember.count({ where: { accountId: ctx.accountId } });
  const pendingInviteCount = await prisma.invite.count({
    where: { accountId: ctx.accountId, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (memberCount + pendingInviteCount >= limits.maxMembers) {
    return NextResponse.json({ error: "MEMBER_LIMIT_REACHED" }, { status: 403 });
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invite = await prisma.invite.upsert({
    where: { accountId_email: { accountId: ctx.accountId, email } },
    update: { token, role, expiresAt, acceptedAt: null, invitedBy: session.user.id },
    create: {
      accountId: ctx.accountId,
      email,
      role,
      token,
      expiresAt,
      invitedBy: session.user.id,
    },
  });

  await sendInviteEmail({
    toEmail: email,
    accountName: account.name,
    inviterName: account.owner.name ?? account.owner.email,
    role,
    token,
  });

  return NextResponse.json(invite, { status: 201 });
}
