import nodemailer from 'nodemailer';
import { getSmtpConfig } from './config';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const smtp = getSmtpConfig();
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
    });
  }
  return transporter;
}

export async function sendEmail(to: string[], subject: string, html: string): Promise<void> {
  const smtp = getSmtpConfig();
  await getTransporter().sendMail({
    from: smtp.from,
    to: to.join(', '),
    subject,
    html,
  });
}
