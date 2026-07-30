import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { extractBearerToken } from '../auth-request';
import { canonicalizeEmail } from './email-identity';
import {
  DEFAULT_FINANCE_PERMISSIONS,
  validateFinancePermissions,
} from './finance-permission-policy';
import { assertCanGrantRole } from './role-grant-policy';

describe('authentication security policies', () => {
  describe('canonicalizeEmail', () => {
    it('trims and normalizes an email for identity lookup', () => {
      expect(canonicalizeEmail('  Admin.User@Example.COM  ')).toEqual({
        original: 'Admin.User@Example.COM',
        normalized: 'admin.user@example.com',
      });
    });

    it('rejects malformed email input', () => {
      expect(() => canonicalizeEmail('missing-domain@')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('extractBearerToken', () => {
    it('extracts a case-insensitive bearer token', () => {
      expect(extractBearerToken('bEaReR session-token')).toBe('session-token');
    });

    it('rejects missing or unsupported authorization schemes', () => {
      expect(extractBearerToken()).toBe('');
      expect(extractBearerToken('Basic credentials')).toBe('');
    });
  });

  describe('validateFinancePermissions', () => {
    it('uses safe defaults without payroll access', () => {
      const permissions = validateFinancePermissions(undefined);

      expect(permissions).toEqual(DEFAULT_FINANCE_PERMISSIONS);
      expect(permissions).not.toContain('PAYROLL_VIEW');
      expect(permissions).not.toContain('PAYROLL_MANAGE');
      expect(permissions).not.toContain('FINANCE_INVOICES_VOID');
      expect(permissions).not.toContain('FINANCE_BILLING_MANAGE');
      expect(permissions).not.toContain('FINANCE_PAYMENTS_REVERSE');
      expect(permissions).not.toContain('FINANCE_REPORTS_EXPORT');
      expect(permissions).not.toContain('FINANCE_SETTINGS_MANAGE');
      expect(permissions).not.toContain('FINANCE_CASHIER_SESSIONS_SUPERVISE');
      expect(permissions).not.toContain('FINANCE_CREDIT_NOTES_CREATE');
      expect(permissions).not.toContain('FINANCE_CORRECTIONS_APPROVE');
      expect(permissions).not.toContain('FINANCE_RECONCILIATION_MANAGE');
      expect(permissions).not.toContain('FINANCE_PERIOD_CLOSE');
      expect(permissions).not.toBe(DEFAULT_FINANCE_PERMISSIONS);
    });

    it('allows an explicit empty permission set', () => {
      expect(validateFinancePermissions([])).toEqual([]);
    });
    it('deduplicates supported permissions', () => {
      expect(
        validateFinancePermissions([
          'FINANCE_INVOICES_VIEW',
          'FINANCE_INVOICES_VIEW',
        ]),
      ).toEqual(['FINANCE_INVOICES_VIEW']);
    });

    it('accepts explicit high-risk finance permissions', () => {
      expect(
        validateFinancePermissions([
          'FINANCE_INVOICES_VOID',
          'FINANCE_BILLING_MANAGE',
          'FINANCE_PAYMENTS_REVERSE',
          'FINANCE_REPORTS_EXPORT',
          'FINANCE_SETTINGS_MANAGE',
          'FINANCE_CASHIER_SESSIONS_SUPERVISE',
          'FINANCE_CREDIT_NOTES_CREATE',
          'FINANCE_CORRECTIONS_APPROVE',
          'FINANCE_RECONCILIATION_MANAGE',
          'FINANCE_PERIOD_CLOSE',
        ]),
      ).toEqual([
        'FINANCE_INVOICES_VOID',
        'FINANCE_BILLING_MANAGE',
        'FINANCE_PAYMENTS_REVERSE',
        'FINANCE_REPORTS_EXPORT',
        'FINANCE_SETTINGS_MANAGE',
        'FINANCE_CASHIER_SESSIONS_SUPERVISE',
        'FINANCE_CREDIT_NOTES_CREATE',
        'FINANCE_CORRECTIONS_APPROVE',
        'FINANCE_RECONCILIATION_MANAGE',
        'FINANCE_PERIOD_CLOSE',
      ]);
    });

    it('rejects unsupported permissions', () => {
      expect(() => validateFinancePermissions(['SYSTEM_ADMIN'])).toThrow(
        BadRequestException,
      );
    });
  });
  describe('assertCanGrantRole', () => {
    it('allows a school administrator to grant operational roles', () => {
      expect(() => assertCanGrantRole(['SCHOOL_ADMIN'], 'TEACHER')).not.toThrow();
    });

    it('prevents a school administrator from granting school admin access', () => {
      expect(() =>
        assertCanGrantRole(['SCHOOL_ADMIN'], 'SCHOOL_ADMIN'),
      ).toThrow(ForbiddenException);
    });
  });
});
