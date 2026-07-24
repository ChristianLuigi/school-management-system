import { validateEnvironment } from './environment';

describe('production environment validation', () => {
  const validProduction = {
    NODE_ENV: 'production',
    DATABASE_URL:
      'postgresql://almac_app:Long-Database-Password-42@db:5432/almac',
    APP_PUBLIC_URL: 'https://school.example.com',
    RESEND_API_KEY: 're_test_key_that_is_long_enough',
    AUTH_EMAIL_FROM: 'ALMAC <accounts@school.example.com>',
  };

  it('accepts a complete secure production configuration', () => {
    expect(validateEnvironment(validProduction)).toMatchObject({
      NODE_ENV: 'production',
      APP_PUBLIC_URL: 'https://school.example.com',
      CORS_ALLOWED_ORIGINS: 'https://school.example.com',
      PORT: 4000,
    });
  });

  it('rejects default database credentials in production', () => {
    expect(() =>
      validateEnvironment({
        ...validProduction,
        DATABASE_URL:
          'postgresql://school_admin:school_password@db:5432/almac',
      }),
    ).toThrow('default or empty password');
  });

  it('rejects placeholder secrets in production', () => {
    expect(() =>
      validateEnvironment({
        ...validProduction,
        DATABASE_URL:
          'postgresql://almac_app:replace-with-a-real-password@db:5432/almac',
      }),
    ).toThrow('default or empty password');

    expect(() =>
      validateEnvironment({
        ...validProduction,
        RESEND_API_KEY: 'replace-with-resend-api-key',
      }),
    ).toThrow('appears to be invalid');
  });
  it('requires HTTPS and email delivery configuration in production', () => {
    expect(() =>
      validateEnvironment({
        ...validProduction,
        APP_PUBLIC_URL: 'http://school.example.com',
      }),
    ).toThrow('must use HTTPS');

    expect(() =>
      validateEnvironment({
        ...validProduction,
        RESEND_API_KEY: '',
      }),
    ).toThrow('RESEND_API_KEY is required');
  });

  it('rejects CORS entries containing a path', () => {
    expect(() =>
      validateEnvironment({
        ...validProduction,
        CORS_ALLOWED_ORIGINS:
          'https://school.example.com/not-an-origin',
      }),
    ).toThrow('exact origins');
  });
});
