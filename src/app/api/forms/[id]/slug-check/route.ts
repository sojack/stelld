import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFormAccess, can } from "@/lib/access";
import { NextResponse } from "next/server";
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

  const access = await getFormAccess(session.user.id, id);
  if (!access || !can(access.role, "EDIT_FORM")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";

  const validationError = validateSlug(slug);
  if (validationError) {
    return NextResponse.json({ available: false, error: validationError });
  }

  const existing = await prisma.form.findFirst({
    where: { slug, NOT: { id } },
  });

  return NextResponse.json({ available: !existing });
}
