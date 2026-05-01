import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFormAccess, can } from "@/lib/access";
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
  if (!access || !can(access.role, "EXPORT_SUBMISSIONS")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const submissions = await prisma.submission.findMany({
    where: { formId: id },
    orderBy: { createdAt: "desc" },
  });

  const allKeys = new Set<string>();
  for (const sub of submissions) {
    const data = sub.data as Record<string, unknown>;
    for (const key of Object.keys(data)) {
      allKeys.add(key);
    }
  }

  const columns = ["Submitted At", ...Array.from(allKeys)];

  const escapeCsv = (val: unknown): string => {
    const str = val === null || val === undefined ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [columns.map(escapeCsv).join(",")];
  for (const sub of submissions) {
    const data = sub.data as Record<string, unknown>;
    const row = [
      escapeCsv(sub.createdAt.toISOString()),
      ...Array.from(allKeys).map((key) => escapeCsv(data[key])),
    ];
    rows.push(row.join(","));
  }

  const csv = rows.join("\n");
  const filename = `${access.form.title.replace(/[^a-zA-Z0-9]/g, "_")}_submissions.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
