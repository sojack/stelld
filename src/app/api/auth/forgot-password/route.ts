import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "crypto";
import { createRateLimiter } from "@/lib/rate-limit";

const isRateLimited = createRateLimiter(3, 60000); // 3 per minute

export async function POST(req: Request) {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { email } = await req.json();

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    );
  }

  // Always return success to avoid revealing whether email exists
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing reset tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    await prisma.verificationToken.create({
      data: { identifier: email, token, expires },
    });

    await sendPasswordResetEmail(email, token);
  }

  return NextResponse.json({ success: true });
}
