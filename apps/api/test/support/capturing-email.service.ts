import { EmailService } from '../../src/email/email.service';

type InvitationEmail = {
  to: string;
  activationUrl: string;
  schoolName: string;
  roleCode: string;
  locale: 'fr' | 'en';
  idempotencyKey: string;
};

type PasswordResetEmail = {
  to: string;
  resetUrl: string;
  firstName: string | null;
  locale: 'fr' | 'en';
  idempotencyKey: string;
};

type PasswordChangedEmail = {
  to: string;
  firstName: string | null;
  locale: 'fr' | 'en';
  idempotencyKey: string;
};

export class CapturingEmailService extends EmailService {
  readonly invitations: InvitationEmail[] = [];
  readonly passwordResets: PasswordResetEmail[] = [];
  readonly passwordChanges: PasswordChangedEmail[] = [];

  sendAccountInvitation(input: InvitationEmail) {
    this.invitations.push(input);
    return Promise.resolve({
      providerMessageId: `test-invitation-${this.invitations.length}`,
    });
  }

  sendPasswordReset(input: PasswordResetEmail) {
    this.passwordResets.push(input);
    return Promise.resolve({
      providerMessageId: `test-reset-${this.passwordResets.length}`,
    });
  }

  sendPasswordChangedNotification(input: PasswordChangedEmail) {
    this.passwordChanges.push(input);
    return Promise.resolve({
      providerMessageId: `test-password-change-${this.passwordChanges.length}`,
    });
  }

  reset() {
    this.invitations.length = 0;
    this.passwordResets.length = 0;
    this.passwordChanges.length = 0;
  }
}
