import { BadRequestException } from '@nestjs/common';
export function validateSchoolLogo(value: string | undefined) {
  if (!value) return;
  if (!value.startsWith('data:')) {
    if (
      value.startsWith('/') &&
      !value.startsWith('//') &&
      !value.includes('\\')
    )
      return;
    try {
      if (new URL(value).protocol === 'https:') return;
    } catch {
      /* invalid URL */
    }
    throw new BadRequestException('Use an uploaded image or HTTPS logo URL.');
  }
  const match =
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match)
    throw new BadRequestException('Only PNG, JPG and WEBP logos are allowed.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 256 * 1024)
    throw new BadRequestException('Logo must be at most 256 KB.');
  const valid =
    match[1] === 'png'
      ? bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : match[1] === 'jpeg'
        ? bytes.length >= 3 &&
          bytes[0] === 255 &&
          bytes[1] === 216 &&
          bytes[2] === 255
        : bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
          bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!valid)
    throw new BadRequestException(
      'Logo content does not match its image type.',
    );
}
