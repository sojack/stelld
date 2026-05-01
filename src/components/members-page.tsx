"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface Member {
  id: string;
  role: "VIEWER" | "EDITOR";
  user: { id: string; name: string | null; email: string; image: string | null };
}

interface Invite {
  id: string;
  email: string;
  role: "VIEWER" | "EDITOR";
  expiresAt: string;
  createdAt: string;
}

export function MembersPage({
  accountName,
  maxMembers,
}: {
  accountName: string;
  maxMembers: number;
}) {
  const t = useTranslations("members");
  const tc = useTranslations("common");

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"VIEWER" | "EDITOR">("EDITOR");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);

  async function refresh() {
    setLoading(true);
    const [mRes, iRes] = await Promise.all([
      fetch("/api/members"),
      fetch("/api/invites"),
    ]);
    const m = mRes.ok ? await mRes.json() : [];
    const i = iRes.ok ? await iRes.json() : [];
    setMembers(Array.isArray(m) ? m : []);
    setInvites(Array.isArray(i) ? i : []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function sendInvite() {
    setInviteError("");
    setInviting(true);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    setInviting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg: Record<string, string> = {
        MEMBER_LIMIT_REACHED: t("memberLimitReached", { max: maxMembers }),
        INVITE_DUPLICATE: t("inviteDuplicate"),
        SELF_INVITE: t("selfInvite"),
        ALREADY_MEMBER: t("alreadyMember"),
      };
      setInviteError(msg[body.error] ?? tc("error"));
      return;
    }
    setInviteEmail("");
    setShowInvite(false);
    refresh();
  }

  async function changeRole(memberId: string, role: "VIEWER" | "EDITOR") {
    await fetch(`/api/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    refresh();
  }

  async function removeMember(memberId: string) {
    if (!confirm(t("removeConfirm"))) return;
    await fetch(`/api/members/${memberId}`, { method: "DELETE" });
    refresh();
  }

  async function revokeInvite(id: string) {
    if (!confirm(t("revokeConfirm"))) return;
    await fetch(`/api/invites/${id}`, { method: "DELETE" });
    refresh();
  }

  async function resendInvite(id: string) {
    await fetch(`/api/invites/${id}/resend`, { method: "POST" });
    alert(t("inviteResent"));
  }

  const usedSlots = members.length + invites.length;
  const atLimit = usedSlots >= maxMembers;

  if (loading) return <div className="text-gray-600">{tc("loading")}</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("title")}</h1>
      <p className="text-gray-500 mb-8">{t("subtitle", { account: accountName })}</p>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{t("membersHeading")}</h2>
        <button
          onClick={() => setShowInvite(true)}
          disabled={atLimit}
          className="bg-black text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
        >
          {atLimit
            ? t("atLimit", { used: usedSlots, max: maxMembers })
            : t("inviteButton")}
        </button>
      </div>

      {showInvite && (
        <div className="border border-gray-200 rounded-md p-4 mb-6 bg-gray-50">
          <h3 className="font-medium mb-3">{t("inviteHeading")}</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "VIEWER" | "EDITOR")}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="EDITOR">{t("roleEditor")}</option>
              <option value="VIEWER">{t("roleViewer")}</option>
            </select>
          </div>
          {inviteError && <p className="text-red-600 text-sm mb-2">{inviteError}</p>}
          <div className="flex gap-2">
            <button
              onClick={sendInvite}
              disabled={inviting || !inviteEmail}
              className="bg-black text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
            >
              {inviting ? t("sending") : t("send")}
            </button>
            <button
              onClick={() => { setShowInvite(false); setInviteError(""); }}
              className="text-sm text-gray-700 px-4 py-2"
            >
              {tc("cancel")}
            </button>
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <p className="text-gray-500 mb-8 text-sm">{t("noMembers")}</p>
      ) : (
        <table className="w-full mb-8">
          <thead className="text-left text-xs text-gray-500 uppercase">
            <tr>
              <th className="py-2">{t("colUser")}</th>
              <th className="py-2">{t("colRole")}</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-gray-100">
                <td className="py-3">
                  <div className="font-medium text-sm">{m.user.name ?? m.user.email}</div>
                  <div className="text-xs text-gray-500">{m.user.email}</div>
                </td>
                <td className="py-3">
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value as "VIEWER" | "EDITOR")}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                  >
                    <option value="EDITOR">{t("roleEditor")}</option>
                    <option value="VIEWER">{t("roleViewer")}</option>
                  </select>
                </td>
                <td className="py-3 text-right">
                  <button
                    onClick={() => removeMember(m.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    {t("remove")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {invites.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mb-4">{t("pendingInvitesHeading")}</h2>
          <table className="w-full">
            <thead className="text-left text-xs text-gray-500 uppercase">
              <tr>
                <th className="py-2">{t("colEmail")}</th>
                <th className="py-2">{t("colRole")}</th>
                <th className="py-2">{t("colExpires")}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id} className="border-t border-gray-100">
                  <td className="py-3 text-sm">{i.email}</td>
                  <td className="py-3 text-sm">
                    {i.role === "EDITOR" ? t("roleEditor") : t("roleViewer")}
                  </td>
                  <td className="py-3 text-sm text-gray-500">
                    {new Date(i.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right space-x-3">
                    <button onClick={() => resendInvite(i.id)} className="text-sm text-blue-600 hover:underline">
                      {t("resend")}
                    </button>
                    <button onClick={() => revokeInvite(i.id)} className="text-sm text-red-600 hover:underline">
                      {t("revoke")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
