import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getAccountAccess, type Role } from "@/lib/access";

export const ACCOUNT_COOKIE = "stelld_account";

export interface AccountContext {
  accountId: string;
  role: Role;
  isPersonal: boolean;
}

export async function getActiveAccount(userId: string): Promise<AccountContext | null> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ACCOUNT_COOKIE)?.value;

  if (cookieValue) {
    const role = await getAccountAccess(userId, cookieValue);
    if (role) {
      const personal = await prisma.appAccount.findUnique({
        where: { ownerId: userId },
        select: { id: true },
      });
      return {
        accountId: cookieValue,
        role,
        isPersonal: personal?.id === cookieValue,
      };
    }
  }

  const personal = await prisma.appAccount.findUnique({
    where: { ownerId: userId },
    select: { id: true },
  });
  if (!personal) return null;
  return { accountId: personal.id, role: "OWNER", isPersonal: true };
}

export async function setActiveAccountCookie(accountId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACCOUNT_COOKIE, accountId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
