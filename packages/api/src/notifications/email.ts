import nodemailer from 'nodemailer';

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  to: string;
}

/**
 * Send a notification email via SMTP.
 */
export async function sendEmail(message: string, config: EmailConfig): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  await transporter.sendMail({
    from: config.smtpUser,
    to: config.to,
    subject: 'recon-web: Changes Detected',
    text: message,
  });
}
