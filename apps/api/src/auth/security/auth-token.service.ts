import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

@Injectable()
export class AuthTokenService {
  generate() {
    const rawToken = randomBytes(32).toString('base64url');
    return { rawToken, tokenHash: this.hash(rawToken) };
  }
  hash(rawToken: string) {
    return createHash('sha256').update(rawToken, 'utf8').digest('hex');
  }
}
