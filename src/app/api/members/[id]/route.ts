import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveAccount } from "@/lib/account-context";
import { can } from "@/lib/access";
import { NextResponse } from "next/server";
import type { MemberRole } from "@/generated/prisma/client";

export async function PATCH(
  req: Request,
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

  const body = await req.json();
  const role = body.role as MemberRole;
  if (role !== "VIEWER" && role !== "EDITOR") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const member = await prisma.accountMember.findUnique({ where: { id } });
  if (!member || member.accountId !== ctx.accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.accountMember.update({ where: { id }, data: { role } });
  return NextResponse.json({ success: true });
}

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

  const member = await prisma.accountMember.findUnique({ where: { id } });
  if (!member || member.accountId !== ctx.accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.accountMember.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
