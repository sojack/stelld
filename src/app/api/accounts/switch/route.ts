import { auth } from "@/lib/auth";
import { getAccountAccess } from "@/lib/access";
import { setActiveAccountCookie } from "@/lib/account-context";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId } = await req.json();
  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }

  const role = await getAccountAccess(session.user.id, accountId);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await setActiveAccountCookie(accountId);
  return NextResponse.json({ success: true });
}
