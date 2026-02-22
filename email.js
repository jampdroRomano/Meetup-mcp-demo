import nodemailer from "nodemailer";

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    throw new Error("EMAIL_USER e EMAIL_PASS devem estar definidos no .env");
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

export async function sendEmail(to, message) {
  const from = process.env.EMAIL_USER;
  if (!from) {
    throw new Error("EMAIL_USER não definido no .env");
  }
  const transporter = getTransporter();
  await transporter.sendMail({
    from,
    to,
    subject: "Meetup",
    text: message,
  });
}
