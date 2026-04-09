import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getBannerUploadUrl, deleteBannerObject } from "@/lib/s3";
import { getPlanLimits } from "@/lib/plans";

const MAX_BANNER_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(
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

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
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

  const form = await prisma.form.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!form) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const settings = form.settings as { bannerUrl?: string };
  if (settings.bannerUrl) {
    // Extract S3 key from URL: https://bucket.s3.region.amazonaws.com/key
    try {
      const url = new URL(settings.bannerUrl);
      const key = url.pathname.slice(1); // strip leading /
      await deleteBannerObject(key);
    } catch {
      // If deletion from S3 fails, still clear the URL from settings
    }
  }

  const newSettings = { ...settings, bannerUrl: undefined };
  await prisma.form.updateMany({
    where: { id, userId: session.user.id },
    data: { settings: newSettings },
  });

  return NextResponse.json({ success: true });
}
