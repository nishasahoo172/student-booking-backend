// backend/src/services/mailer.js
import nodemailer from "nodemailer";

function getEnv(name) {
  return (process.env[name] || "").trim();
}

function isSmtpConfigured() {
  return !!(getEnv("SMTP_HOST") && getEnv("SMTP_PORT") && getEnv("SMTP_USER") && getEnv("SMTP_PASS"));
}

let transporter = null;

function getTransporter() {
  if (!isSmtpConfigured()) return null;
  if (transporter) return transporter;

  const port = Number(getEnv("SMTP_PORT"));
  transporter = nodemailer.createTransport({
    host: getEnv("SMTP_HOST"),
    port,   
    secure: port === 465, // 465 true, 587 false
    auth: {
      user: getEnv("SMTP_USER"),
      pass: getEnv("SMTP_PASS"),
    },
  });
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    console.log("⚠️ SMTP not configured. Skipping email send.");
    return;
  }
  if (!to) throw new Error("sendMail: 'to' is required");
  if (!subject) throw new Error("sendMail: 'subject' is required");
  const from = getEnv("MAIL_FROM") || getEnv("SMTP_USER");
  try {
    const info = await t.sendMail({ from, to, subject, text: text || "", html });
    console.log("✅ Email sent:", info.messageId, "to:", to);
    return info;
  } catch (err) {
    console.error("❌ Email send failed:", err?.message || err);
    throw err;
  }
}
