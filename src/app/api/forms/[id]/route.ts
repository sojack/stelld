import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFormAccess, can } from "@/lib/access";
import { getPlanLimits } from "@/lib/plans";
import { validateSlug } from "@/lib/slug";
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
  if (!access || !can(access.role, "VIEW_FORM")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ...access.form, _role: access.role });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getFormAccess(session.user.id, id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!can(access.role, "EDIT_FORM")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  if (body.slug !== undefined) {
    const account = await prisma.appAccount.findUnique({
      where: { id: access.form.accountId },
      select: { ownerId: true },
    });
    const subscription = await prisma.subscription.findUnique({
      where: { userId: account!.ownerId },
    });
    const limits = getPlanLimits(subscription?.plan);
    if (!limits.canCustomizeSlug) {
      return NextResponse.json({ error: "Upgrade to PRO to use custom URLs" }, { status: 403 });
    }

    if (body.slug === null || body.slug === "") {
      await prisma.form.update({ where: { id }, data: { slug: null } });
      return NextResponse.json({ success: true });
    }

    const validationError = validateSlug(body.slug);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const existing = await prisma.form.findFirst({
      where: { slug: body.slug, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: "This URL is already taken" }, { status: 409 });
    }

    await prisma.form.update({ where: { id }, data: { slug: body.slug } });
    return NextResponse.json({ success: true });
  }

  await prisma.form.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.schema !== undefined && { schema: body.schema }),
      ...(body.settings !== undefined && { settings: body.settings }),
      ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
      ...(body.description !== undefined && { description: body.description }),
    },
  });

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

  const access = await getFormAccess(session.user.id, id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!can(access.role, "DELETE_FORM")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.form.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
