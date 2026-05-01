import { prisma } from "@/lib/db";
import type { Form } from "@/generated/prisma/client";

export type Role = "OWNER" | "EDITOR" | "VIEWER";

export type Action =
  | "VIEW_FORM"
  | "CREATE_FORM"
  | "EDIT_FORM"
  | "DELETE_FORM"
  | "VIEW_SUBMISSIONS"
  | "EXPORT_SUBMISSIONS"
  | "DELETE_SUBMISSIONS"
  | "MANAGE_BILLING"
  | "MANAGE_MEMBERS";

const PERMISSIONS: Record<Role, Set<Action>> = {
  OWNER: new Set([
    "VIEW_FORM",
    "CREATE_FORM",
    "EDIT_FORM",
    "DELETE_FORM",
    "VIEW_SUBMISSIONS",
    "EXPORT_SUBMISSIONS",
    "DELETE_SUBMISSIONS",
    "MANAGE_BILLING",
    "MANAGE_MEMBERS",
  ]),
  EDITOR: new Set([
    "VIEW_FORM",
    "CREATE_FORM",
    "EDIT_FORM",
    "VIEW_SUBMISSIONS",
    "EXPORT_SUBMISSIONS",
  ]),
  VIEWER: new Set([
    "VIEW_FORM",
    "VIEW_SUBMISSIONS",
    "EXPORT_SUBMISSIONS",
  ]),
};

export function can(role: Role | null, action: Action): boolean {
  if (!role) return false;
  return PERMISSIONS[role].has(action);
}

export async function getAccountAccess(
  userId: string,
  accountId: string
): Promise<Role | null> {
  const account = await prisma.appAccount.findUnique({
    where: { id: accountId },
    select: { ownerId: true },
  });
  if (!account) return null;
  if (account.ownerId === userId) return "OWNER";

  const member = await prisma.accountMember.findUnique({
    where: { accountId_userId: { accountId, userId } },
    select: { role: true },
  });
  if (!member) return null;
  return member.role as Role;
}

export async function getFormAccess(
  userId: string,
  formId: string
): Promise<{ form: Form; role: Role } | null> {
  const form = await prisma.form.findUnique({ where: { id: formId } });
  if (!form) return null;
  const role = await getAccountAccess(userId, form.accountId);
  if (!role) return null;
  return { form, role };
}

export async function listAccessibleAccounts(userId: string) {
  const owned = await prisma.appAccount.findFirst({ where: { ownerId: userId } });
  const memberships = await prisma.accountMember.findMany({
    where: { userId },
    include: { account: true },
  });

  const ownedItem = owned ? { account: owned, role: "OWNER" as const } : null;
  const memberItems = memberships.map((m) => ({
    account: m.account,
    role: m.role as Role,
  }));

  return ownedItem ? [ownedItem, ...memberItems] : memberItems;
}
