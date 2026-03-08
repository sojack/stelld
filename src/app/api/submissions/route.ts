import { prisma } from "@/lib/db";
import { sendSubmissionNotification } from "@/lib/email";
import { getPlanLimits } from "@/lib/plans";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createRateLimiter } from "@/lib/rate-limit";

const isRateLimited = createRateLimiter(10, 60000); // 10 per minute

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

export async function POST(req: Request) {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many submissions" }, { status: 429 });
  }

  // Check body size before parsing
  const contentLength = headersList.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  const { formId, data, honeypot } = await req.json();

  // Honeypot check — if filled, silently succeed (don't tell bots it failed)
  if (honeypot) {
    return NextResponse.json({ success: true });
  }

  if (!formId || !data) {
    return NextResponse.json({ error: "Missing form ID or data" }, { status: 400 });
  }

  const form = await prisma.form.findFirst({
    where: { id: formId, isPublished: true },
    include: { user: { select: { email: true, name: true } } },
  });

  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: form.userId },
  });
  const limits = getPlanLimits(subscription?.plan);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const submissionCount = await prisma.submission.count({
    where: { formId: form.id, createdAt: { gte: monthStart } },
  });
  if (submissionCount >= limits.maxSubmissionsPerMonth) {
    return NextResponse.json({ error: "SUBMISSION_LIMIT_REACHED" }, { status: 403 });
  }

  const submission = await prisma.submission.create({
    data: {
      formId,
      data,
      metadata: {
        userAgent: headersList.get("user-agent") ?? "",
        referer: headersList.get("referer") ?? "",
        submittedAt: new Date().toISOString(),
      },
    },
  });

  // Send notification (fire-and-forget, don't block the response)
  if (form.user.email) {
    sendSubmissionNotification(
      form.user.email,
      form.title,
      form.id,
      submission.id
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
