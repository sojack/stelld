import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.AWS_REGION ?? "ca-central-1" });

const fromEmail = process.env.SES_FROM_EMAIL ?? "noreply@yourapp.ca";

export async function sendPasswordResetEmail(toEmail: string, token: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetLink = `${appUrl}/reset-password?token=${token}`;

  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [toEmail] },
        Message: {
          Subject: { Data: "Reset your Stelld password" },
          Body: {
            Html: {
              Data: `
                <p>You requested a password reset for your Stelld account.</p>
                <p><a href="${resetLink}">Click here to reset your password</a></p>
                <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
              `,
            },
            Text: {
              Data: `You requested a password reset for your Stelld account.\n\nReset your password: ${resetLink}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
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
  const dashboardLink = `${appUrl}/dashboard/forms/${formId}`;

  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [toEmail] },
        Message: {
          Subject: { Data: `New response on "${formTitle}"` },
          Body: {
            Html: {
              Data: `
                <p>You received a new submission on your form <strong>${formTitle}</strong>.</p>
                <p><a href="${dashboardLink}">View submissions in your dashboard</a></p>
              `,
            },
            Text: {
              Data: `You received a new submission on your form "${formTitle}". View it at: ${dashboardLink}`,
            },
          },
        },
      })
    );
  } catch (error) {
    // Log but don't fail the submission if email fails
    console.error("Failed to send notification email:", error);
  }
}
