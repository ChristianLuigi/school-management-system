import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

@Injectable()
export class EmailService {
  async sendAccountInvitation(input: {
    to: string;
    activationUrl: string;
    schoolName: string;
    roleCode: string;
    locale: 'fr' | 'en';
    idempotencyKey: string;
  }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.AUTH_EMAIL_FROM;
    if (!apiKey || !from) throw new Error('Invitation email is not configured.');

    const french = input.locale === 'fr';
    const heading = french ? 'Activez votre compte' : 'Activate your account';
    const description = french
      ? `Vous avez été invité(e) à rejoindre ${input.schoolName}.`
      : `You have been invited to join ${input.schoolName}.`;
    const expiry = french
      ? 'Ce lien est personnel, utilisable une seule fois et expire dans 48 heures.'
      : 'This link is personal, can only be used once, and expires in 48 hours.';
    const button = french ? 'Activer mon compte' : 'Activate my account';
    const safeUrl = escapeHtml(input.activationUrl);

    const { data, error } = await new Resend(apiKey).emails.send({
      from,
      to: [input.to],
      subject: french ? `Invitation à rejoindre ${input.schoolName}` : `Invitation to join ${input.schoolName}`,
      html: `<!doctype html><html lang="${input.locale}"><body style="font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:600px;margin:40px auto;padding:32px;border:1px solid #e2e8f0;border-radius:16px"><h1>${heading}</h1><p>${escapeHtml(description)}</p><p><strong>Role:</strong> ${escapeHtml(input.roleCode)}</p><p><a href="${safeUrl}">${button}</a></p><p>${expiry}</p><p style="word-break:break-all">${safeUrl}</p></div></body></html>`,
      text: [heading, '', description, `Role: ${input.roleCode}`, '', input.activationUrl, '', expiry].join('\n'),
    }, { idempotencyKey: input.idempotencyKey });

    if (error) {
      throw new InternalServerErrorException('The invitation was saved but the email could not be sent.');
    }
    return { providerMessageId: data?.id ?? null };
  }
  async sendPasswordReset(input: {
    to: string;
    resetUrl: string;
    firstName: string | null;
    locale: 'fr' | 'en';
    idempotencyKey: string;
  }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.AUTH_EMAIL_FROM;
    if (!apiKey || !from) throw new Error('Password reset email is not configured.');

    const french = input.locale === 'fr';
    const greeting = input.firstName
      ? french ? `Bonjour ${input.firstName},` : `Hello ${input.firstName},`
      : french ? 'Bonjour,' : 'Hello,';
    const subject = french ? 'Réinitialisation de votre mot de passe' : 'Reset your password';
    const heading = french ? 'Réinitialisez votre mot de passe' : 'Reset your password';
    const description = french
      ? 'Une demande de réinitialisation a été reçue pour votre compte ALMAC School Management.'
      : 'A password-reset request was received for your ALMAC School Management account.';
    const action = french ? 'Réinitialiser mon mot de passe' : 'Reset my password';
    const warning = french
      ? 'Ce lien est personnel, utilisable une seule fois et expire dans 30 minutes. Si vous n’avez pas demandé cette opération, ignorez ce message.'
      : 'This link is personal, can only be used once, and expires in 30 minutes. If you did not request this, ignore this message.';
    const safeUrl = escapeHtml(input.resetUrl);

    const { data, error } = await new Resend(apiKey).emails.send({
      from,
      to: [input.to],
      subject,
      html: `<!doctype html><html lang="${input.locale}"><body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:600px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px"><p>${escapeHtml(greeting)}</p><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(description)}</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px">${escapeHtml(action)}</a></p><p style="font-size:13px;color:#64748b">${escapeHtml(warning)}</p><p style="font-size:12px;color:#64748b;word-break:break-all">${safeUrl}</p></div></body></html>`,
      text: [greeting, '', heading, '', description, '', input.resetUrl, '', warning].join('\n'),
    }, { idempotencyKey: input.idempotencyKey });

    if (error) throw new Error('Password reset email delivery failed.');
    return { providerMessageId: data?.id ?? null };
  }

  async sendPasswordChangedNotification(input: {
    to: string;
    firstName: string | null;
    locale: 'fr' | 'en';
    idempotencyKey: string;
  }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.AUTH_EMAIL_FROM;
    if (!apiKey || !from) throw new Error('Password change notification is not configured.');

    const french = input.locale === 'fr';
    const subject = french ? 'Votre mot de passe a été modifié' : 'Your password was changed';
    const greeting = input.firstName
      ? french ? `Bonjour ${input.firstName},` : `Hello ${input.firstName},`
      : french ? 'Bonjour,' : 'Hello,';
    const message = french
      ? 'Le mot de passe de votre compte ALMAC School Management vient d’être modifié. Toutes vos anciennes sessions ont été fermées. Si vous n’êtes pas à l’origine de cette opération, contactez immédiatement l’administrateur de votre école.'
      : 'The password for your ALMAC School Management account was changed. All previous sessions were closed. If you did not perform this action, contact your school administrator immediately.';

    const { data, error } = await new Resend(apiKey).emails.send({
      from,
      to: [input.to],
      subject,
      html: `<!doctype html><html lang="${input.locale}"><body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:600px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px"><p>${escapeHtml(greeting)}</p><h1>${escapeHtml(subject)}</h1><p>${escapeHtml(message)}</p></div></body></html>`,
      text: [greeting, '', message].join('\n'),
    }, { idempotencyKey: input.idempotencyKey });

    if (error) throw new Error('Password change notification failed.');
    return { providerMessageId: data?.id ?? null };
  }
}
