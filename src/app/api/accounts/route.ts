import { auth } from "@/lib/auth";
import { listAccessibleAccounts } from "@/lib/access";
import { getActiveAccount } from "@/lib/account-context";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await listAccessibleAccounts(session.user.id);
  const ctx = await getActiveAccount(session.user.id);

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      id: a.account.id,
      name: a.account.name,
      role: a.role,
    })),
    activeAccountId: ctx?.accountId ?? null,
  });
}
