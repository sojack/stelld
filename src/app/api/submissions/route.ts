import { prisma } from "@/lib/db";
import { sendSubmissionNotification } from "@/lib/email";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

// Simple in-memory rate limiter
const rateLimit = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(ip, { count: 1, resetAt: now + 60000 });
    return false;
  }
  entry.count++;
  return entry.count > 10; // 10 per minute
}

export async function POST(req: Request) {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many submissions" }, { status: 429 });
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
