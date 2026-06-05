import { branding } from "@/lib/branding";
import { config } from "@/lib/config";

export function buildWelcomeUserEmail(params: {
  name: string;
  email: string;
  password: string;
  isReset?: boolean;
}) {
  const loginUrl = `${config.appUrl}/login`;
  const appName = branding.name;
  const subject = params.isReset
    ? `Your ${appName} password was reset`
    : `Your ${appName} account`;
  const intro = params.isReset
    ? `An administrator reset your ${appName} password.`
    : `An administrator created a ${appName} account for you.`;

  const text = `${intro}

Name: ${params.name}
Email: ${params.email}
Temporary password: ${params.password}

Sign in: ${loginUrl}

You will be asked to change your password on first login.

If you did not expect this email, contact your administrator.`;

  const html = `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.5; color: #111;">
  <p>${intro}</p>
  <table style="border-collapse: collapse;">
    <tr><td style="padding: 4px 12px 4px 0;"><strong>Name</strong></td><td>${escapeHtml(params.name)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0;"><strong>Email</strong></td><td>${escapeHtml(params.email)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0;"><strong>Temporary password</strong></td><td><code>${escapeHtml(params.password)}</code></td></tr>
  </table>
  <p><a href="${loginUrl}">Sign in to ${escapeHtml(appName)}</a></p>
  <p style="color: #666; font-size: 14px;">You will be asked to change your password on first login.</p>
</body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
