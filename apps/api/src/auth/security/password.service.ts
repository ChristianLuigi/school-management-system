import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { HashOptions } from 'argon2';
import { verifyPassword as verifyLegacyPassword } from '../../internal-auth/password.util';

const COMMON_PASSWORDS = new Set([
  'password', 'password123', '123456789', '1234567890',
  'qwerty123', 'administrator', 'admin123456', 'letmein',
]);

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';
  private readonly minimumLength = Number(process.env.AUTH_PASSWORD_MIN_LENGTH ?? 15);
  private readonly maximumLength = Number(process.env.AUTH_PASSWORD_MAX_LENGTH ?? 128);
  private readonly options: HashOptions = {
    type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1,
  };

  async onModuleInit() {
    this.dummyHash = await argon2.hash('ALMAC dummy password verification value', this.options);
  }

  validate(input: string, contextWords: string[] = []) {
    const password = input.normalize('NFC');
    const length = Array.from(password).length;
    if (length < this.minimumLength) throw new BadRequestException(`Password must contain at least ${this.minimumLength} characters.`);
    if (length > this.maximumLength) throw new BadRequestException(`Password must not exceed ${this.maximumLength} characters.`);
    const candidate = password.trim().toLowerCase();
    if (COMMON_PASSWORDS.has(candidate)) throw new BadRequestException('This password is too common. Choose another password.');
    for (const word of contextWords) {
      const context = word.trim().toLowerCase();
      if (context.length >= 4 && candidate.includes(context)) {
        throw new BadRequestException('The password must not contain your name, email or organization name.');
      }
    }
    return password;
  }

  async verifyOrDummy(storedHash: string | null | undefined, input: string) {
    const normalized = input.normalize('NFC');
    if (storedHash?.startsWith('scrypt:')) {
      await argon2.verify(this.dummyHash, normalized).catch(() => false);
      return verifyLegacyPassword(normalized, storedHash);
    }
    const selected = storedHash || this.dummyHash;
    try {
      const valid = await argon2.verify(selected, normalized);
      return Boolean(storedHash) && valid;
    } catch { return false; }
  }

  hash(password: string) { return argon2.hash(password, this.options); }
  async verify(hash: string, input: string) {
    const normalized = input.normalize('NFC');
    if (hash.startsWith('scrypt:')) return verifyLegacyPassword(normalized, hash);
    try { return await argon2.verify(hash, normalized); } catch { return false; }
  }
  needsRehash(hash: string) {
    return hash.startsWith('scrypt:') || argon2.needsRehash(hash, this.options);
  }
}
