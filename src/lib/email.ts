import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.AWS_REGION ?? "ca-central-1" });

const fromEmail = process.env.SES_FROM_EMAIL ?? "noreply@yourapp.ca";

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
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [toEmail] },
        Message: {
          Subject: { Data: "Reset your Stelld password / Réinitialisez votre mot de passe Stelld" },
          Body: {
            Html: {
              Data: `
                <p>You requested a password reset for your Stelld account.</p>
                <p><a href="${resetLinkEn}">Click here to reset your password</a></p>
                <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
                <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
                <p>Vous avez demandé une réinitialisation de mot de passe pour votre compte Stelld.</p>
                <p><a href="${resetLinkFr}">Cliquez ici pour réinitialiser votre mot de passe</a></p>
                <p>Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, vous pouvez ignorer ce courriel.</p>
              `,
            },
            Text: {
              Data: `You requested a password reset for your Stelld account.\n\nReset your password: ${resetLinkEn}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.\n\n---\n\nVous avez demandé une réinitialisation de mot de passe pour votre compte Stelld.\n\nRéinitialisez votre mot de passe : ${resetLinkFr}\n\nCe lien expire dans 1 heure. Si vous n'avez pas fait cette demande, vous pouvez ignorer ce courriel.`,
            },
          },
        },
      })
    );
  } catch (error) {
    console.error("Failed to send password reset email:", error);
  }
}

export async function sendSubmissionNotification(
  toEmail: string,
  formTitle: string,
  formId: string,
  submissionId: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const dashboardLinkEn = `${appUrl}/en/dashboard/forms/${formId}`;
  const dashboardLinkFr = `${appUrl}/fr/dashboard/forms/${formId}`;
  const safeTitle = escapeHtml(formTitle);

  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [toEmail] },
        Message: {
          Subject: { Data: `New response on "${formTitle}" / Nouvelle réponse sur « ${formTitle} »` },
          Body: {
            Html: {
              Data: `
                <p>You received a new submission on your form <strong>${safeTitle}</strong>.</p>
                <p><a href="${dashboardLinkEn}">View submissions in your dashboard</a></p>
                <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
                <p>Vous avez reçu une nouvelle soumission sur votre formulaire <strong>${safeTitle}</strong>.</p>
                <p><a href="${dashboardLinkFr}">Voir les soumissions dans votre tableau de bord</a></p>
              `,
            },
            Text: {
              Data: `You received a new submission on your form "${formTitle}". View it at: ${dashboardLinkEn}\n\n---\n\nVous avez reçu une nouvelle soumission sur votre formulaire « ${formTitle} ». Consultez-la ici : ${dashboardLinkFr}`,
            },
          },
        },
      })
    );
  } catch (error) {
    console.error("Failed to send notification email:", error);
  }
}
