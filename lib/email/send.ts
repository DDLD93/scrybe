import nodemailer from "nodemailer";
import { config } from "@/lib/config";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!config.smtp.host) {
    throw new Error("SMTP is not configured (set SMTP_HOST and related env vars)");
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth:
        config.smtp.user && config.smtp.pass
          ? { user: config.smtp.user, pass: config.smtp.pass }
          : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const transport = getTransporter();
  await transport.sendMail({
    from: config.smtp.from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

export function isSmtpConfigured(): boolean {
  return Boolean(config.smtp.host);
}
