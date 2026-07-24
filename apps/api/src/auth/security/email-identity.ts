import { BadRequestException } from '@nestjs/common';
import { domainToASCII } from 'node:url';

export type CanonicalEmail = { original: string; normalized: string };

export function canonicalizeEmail(input: string): CanonicalEmail {
  const original = input.trim().normalize('NFC');
  const atIndex = original.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === original.length - 1) {
    throw new BadRequestException('Invalid email address.');
  }
  const localPart = original.slice(0, atIndex);
  const asciiDomain = domainToASCII(original.slice(atIndex + 1));
  if (!asciiDomain) throw new BadRequestException('Invalid email domain.');
  return {
    original,
    normalized: `${localPart.toLowerCase()}@${asciiDomain.toLowerCase()}`,
  };
}
