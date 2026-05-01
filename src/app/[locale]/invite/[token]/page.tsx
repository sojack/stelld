"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Link, useRouter } from "@/i18n/routing";

interface InviteInfo {
  email: string;
  role: "VIEWER" | "EDITOR";
  accountName: string;
  inviterName: string;
}

type State =
  | { status: "loading" }
  | { status: "ok"; invite: InviteInfo }
  | { status: "error"; code: "INVALID" | "EXPIRED" | "ALREADY_ACCEPTED" | "EMAIL_MISMATCH" | "NETWORK"; inviteEmail?: string };

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const t = useTranslations("members");
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/accept/${token}`)
      .then(async (r) => {
        if (r.ok) {
          const invite = (await r.json()) as InviteInfo;
          setState({ status: "ok", invite });
        } else {
          const body = await r.json().catch(() => ({}));
          setState({ status: "error", code: body.error ?? "INVALID" });
        }
      })
      .catch(() => setState({ status: "error", code: "NETWORK" }));
  }, [token]);

  async function accept() {
    setAccepting(true);
    const r = await fetch(`/api/invites/accept/${token}`, { method: "POST" });
    if (r.ok) {
      router.push("/dashboard");
    } else {
      const body = await r.json().catch(() => ({}));
      setState({ status: "error", code: body.error ?? "INVALID", inviteEmail: body.inviteEmail });
      setAccepting(false);
    }
  }

  if (state.status === "loading" || sessionStatus === "loading") {
    return <div className="max-w-md mx-auto py-16 text-center text-gray-600">{t("loadingInvite")}</div>;
  }

  if (state.status === "error") {
    const messages: Record<string, string> = {
      INVALID: t("inviteInvalid"),
      EXPIRED: t("inviteExpired"),
      ALREADY_ACCEPTED: t("inviteAlreadyAccepted"),
      EMAIL_MISMATCH: t("inviteEmailMismatch", { email: state.inviteEmail ?? "" }),
      NETWORK: t("inviteNetworkError"),
    };
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <h1 className="text-2xl font-bold mb-4">{t("inviteUnavailable")}</h1>
        <p className="text-gray-700 mb-6">{messages[state.code] ?? messages.INVALID}</p>
        <Link href="/login" className="text-green-600 hover:underline">{t("goToLogin")}</Link>
      </div>
    );
  }

  const { invite } = state;
  const isLoggedIn = sessionStatus === "authenticated";
  const matchEmail = isLoggedIn && session?.user?.email?.toLowerCase() === invite.email.toLowerCase();

  return (
    <div className="max-w-md mx-auto py-16 px-4">
      <h1 className="text-2xl font-bold mb-2">{t("youveBeenInvited")}</h1>
      <p className="text-gray-700 mb-6">
        {t("inviteMessage", {
          inviter: invite.inviterName,
          account: invite.accountName,
          role: invite.role === "EDITOR" ? t("roleEditor") : t("roleViewer"),
        })}
      </p>

      {isLoggedIn && matchEmail && (
        <button
          onClick={accept}
          disabled={accepting}
          className="w-full bg-black text-white font-medium py-2.5 rounded-md hover:bg-gray-800 disabled:opacity-50"
        >
          {accepting ? t("accepting") : t("accept")}
        </button>
      )}

      {isLoggedIn && !matchEmail && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md text-sm text-yellow-900">
          {t("emailMismatchWarning", { email: invite.email })}
        </div>
      )}

      {!isLoggedIn && (
        <div className="space-y-3">
          <Link
            href={{ pathname: "/login", query: { invite: token } }}
            className="block w-full bg-black text-white font-medium py-2.5 rounded-md text-center hover:bg-gray-800"
          >
            {t("logInToAccept")}
          </Link>
          <Link
            href={{ pathname: "/signup", query: { invite: token, email: invite.email } }}
            className="block w-full border border-gray-300 text-gray-900 font-medium py-2.5 rounded-md text-center hover:bg-gray-50"
          >
            {t("signUpToAccept")}
          </Link>
        </div>
      )}
    </div>
  );
}
