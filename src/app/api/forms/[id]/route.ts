import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getPlanLimits } from "@/lib/plans";
import { validateSlug } from "@/lib/slug";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await prisma.form.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!form) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(form);
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

  const body = await req.json();

  // Handle slug update
  if (body.slug !== undefined) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });
    const limits = getPlanLimits(subscription?.plan);
    if (!limits.canCustomizeSlug) {
      return NextResponse.json({ error: "Upgrade to PRO to use custom URLs" }, { status: 403 });
    }

    // null or empty string clears the slug
    if (body.slug === null || body.slug === "") {
      await prisma.form.updateMany({
        where: { id, userId: session.user.id },
        data: { slug: null },
      });
      return NextResponse.json({ success: true });
    }

    const validationError = validateSlug(body.slug);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Check uniqueness excluding this form
    const existing = await prisma.form.findFirst({
      where: { slug: body.slug, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: "This URL is already taken" }, { status: 409 });
    }

    await prisma.form.updateMany({
      where: { id, userId: session.user.id },
      data: { slug: body.slug },
    });
    return NextResponse.json({ success: true });
  }

  // Existing non-slug fields
  const form = await prisma.form.updateMany({
    where: { id, userId: session.user.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.schema !== undefined && { schema: body.schema }),
      ...(body.settings !== undefined && { settings: body.settings }),
      ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
      ...(body.description !== undefined && { description: body.description }),
    },
  });

  if (form.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.form.deleteMany({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
