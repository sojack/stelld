import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFormAccess, can } from "@/lib/access";
import { NextResponse } from "next/server";
import { getBannerUploadUrl, deleteBannerObject } from "@/lib/s3";
import { getPlanLimits } from "@/lib/plans";

const MAX_BANNER_BYTES = 5 * 1024 * 1024;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getFormAccess(session.user.id, id);
  if (!access || !can(access.role, "EDIT_FORM")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const account = await prisma.appAccount.findUnique({
    where: { id: access.form.accountId },
    select: { ownerId: true },
  });
  const subscription = await prisma.subscription.findUnique({
    where: { userId: account!.ownerId },
  });
  const limits = getPlanLimits(subscription?.plan);
  if (!limits.canUploadBanner) {
    return NextResponse.json({ error: "Upgrade to PRO to upload a banner" }, { status: 403 });
  }

  const body = await req.json();
  const { ext, size, contentType } = body as { ext: string; size: number; contentType: string };

  if (!ext || !contentType || !contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }
  if (size > MAX_BANNER_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  }

  const { uploadUrl, publicUrl } = await getBannerUploadUrl(id, ext, contentType);
  return NextResponse.json({ uploadUrl, publicUrl });
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
  if (!access || !can(access.role, "EDIT_FORM")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = access.form.settings as { bannerUrl?: string };
  if (settings.bannerUrl) {
    try {
      const url = new URL(settings.bannerUrl);
      const key = url.pathname.slice(1);
      await deleteBannerObject(key);
    } catch {
      // ignore S3 deletion failure; still clear setting
    }
  }

  const newSettings = { ...settings, bannerUrl: undefined };
  await prisma.form.update({
    where: { id },
    data: { settings: newSettings },
  });

  return NextResponse.json({ success: true });
}
