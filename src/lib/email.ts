import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

const fromEmail = process.env.EMAIL_FROM ?? "noreply@stelld.ca";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendPasswordResetEmail(toEmail: string, token: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetLinkEn = `${appUrl}/en/reset-password?token=${token}`;
  const resetLinkFr = `${appUrl}/fr/reset-password?token=${token}`;

  try {
    await getResend().emails.send({
      from: fromEmail,
      to: toEmail,
      subject: "Reset your Stelld password / Réinitialisez votre mot de passe Stelld",
      html: `
        <p>You requested a password reset for your Stelld account.</p>
        <p><a href="${resetLinkEn}">Click here to reset your password</a></p>
        <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p>Vous avez demandé une réinitialisation de mot de passe pour votre compte Stelld.</p>
        <p><a href="${resetLinkFr}">Cliquez ici pour réinitialiser votre mot de passe</a></p>
        <p>Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, vous pouvez ignorer ce courriel.</p>
      `,
      text: `You requested a password reset for your Stelld account.\n\nReset your password: ${resetLinkEn}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.\n\n---\n\nVous avez demandé une réinitialisation de mot de passe pour votre compte Stelld.\n\nRéinitialisez votre mot de passe : ${resetLinkFr}\n\nCe lien expire dans 1 heure. Si vous n'avez pas fait cette demande, vous pouvez ignorer ce courriel.`,
    });
  } catch (error) {
    console.error("Failed to send password reset email:", error);
  }
}

export async function sendInviteEmail(opts: {
  toEmail: string;
  accountName: string;
  inviterName: string;
  role: "VIEWER" | "EDITOR";
  token: string;
}) {
  const { toEmail, accountName, inviterName, role, token } = opts;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const inviteLinkEn = `${appUrl}/en/invite/${token}`;
  const inviteLinkFr = `${appUrl}/fr/invite/${token}`;
  const safeAccount = escapeHtml(accountName);
  const safeInviter = escapeHtml(inviterName);
  const roleEn = role === "EDITOR" ? "Editor" : "Viewer";
  const roleFr = role === "EDITOR" ? "Éditeur" : "Lecteur";

  try {
    await getResend().emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `${inviterName} invited you to ${accountName} on Stelld / ${inviterName} vous a invité sur Stelld`,
      html: `
        <p><strong>${safeInviter}</strong> has invited you to join <strong>${safeAccount}</strong> on Stelld as a <strong>${roleEn}</strong>.</p>
        <p><a href="${inviteLinkEn}">Accept invitation</a></p>
        <p style="color:#666;font-size:12px;">This invite expires in 7 days. If you weren't expecting this, you can ignore this email.</p>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p><strong>${safeInviter}</strong> vous a invité à rejoindre <strong>${safeAccount}</strong> sur Stelld en tant que <strong>${roleFr}</strong>.</p>
        <p><a href="${inviteLinkFr}">Accepter l'invitation</a></p>
        <p style="color:#666;font-size:12px;">Cette invitation expire dans 7 jours. Si vous n'attendiez pas cette invitation, vous pouvez ignorer ce courriel.</p>
      `,
      text: `${inviterName} invited you to join ${accountName} on Stelld as a ${roleEn}.\n\nAccept: ${inviteLinkEn}\n\nThis invite expires in 7 days.\n\n---\n\n${inviterName} vous a invité à rejoindre ${accountName} sur Stelld en tant que ${roleFr}.\n\nAccepter : ${inviteLinkFr}\n\nCette invitation expire dans 7 jours.`,
    });
  } catch (error) {
    console.error("Failed to send invite email:", error);
  }
}

export async function sendSubmissionNotification(
  toEmail: string,
  formTitle: string,
  formId: string,
  submissionId: string
) {
  void submissionId;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const dashboardLinkEn = `${appUrl}/en/dashboard/forms/${formId}`;
  const dashboardLinkFr = `${appUrl}/fr/dashboard/forms/${formId}`;
  const safeTitle = escapeHtml(formTitle);

  try {
    await getResend().emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `New response on "${formTitle}" / Nouvelle réponse sur « ${formTitle} »`,
      html: `
        <p>You received a new submission on your form <strong>${safeTitle}</strong>.</p>
        <p><a href="${dashboardLinkEn}">View submissions in your dashboard</a></p>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p>Vous avez reçu une nouvelle soumission sur votre formulaire <strong>${safeTitle}</strong>.</p>
        <p><a href="${dashboardLinkFr}">Voir les soumissions dans votre tableau de bord</a></p>
      `,
      text: `You received a new submission on your form "${formTitle}". View it at: ${dashboardLinkEn}\n\n---\n\nVous avez reçu une nouvelle soumission sur votre formulaire « ${formTitle} ». Consultez-la ici : ${dashboardLinkFr}`,
    });
  } catch (error) {
    console.error("Failed to send notification email:", error);
  }
}
