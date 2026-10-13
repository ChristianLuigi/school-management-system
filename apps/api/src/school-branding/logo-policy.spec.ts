import { validateSchoolLogo } from './logo-policy';

describe('School logo policy', () => {
  it('accepts existing HTTPS and relative logos', () => {
    expect(() =>
      validateSchoolLogo('https://example.com/logo.png'),
    ).not.toThrow();
    expect(() => validateSchoolLogo('/logo.png')).not.toThrow();
  });
  it('rejects executable schemes and SVG data', () => {
    for (const value of [
      'javascript:alert(1)',
      '//example.com/logo',
      'data:image/svg+xml;base64,PHN2Zz4=',
    ]) {
      expect(() => validateSchoolLogo(value)).toThrow();
    }
  });
  it('rejects mismatched image content and oversized images', () => {
    expect(() =>
      validateSchoolLogo('data:image/png;base64,aGVsbG8='),
    ).toThrow();
    expect(() =>
      validateSchoolLogo(
        `data:image/png;base64,${Buffer.alloc(256 * 1024 + 1).toString('base64')}`,
      ),
    ).toThrow();
  });
});
