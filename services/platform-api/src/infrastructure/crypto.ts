import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { randomToken } from '@incubaunas/shared-kernel';
import type { PiiProtector, TokenGenerator } from '../application/ports.js';

const VERSION = 'v1';

/**
 * Cifrado de datos personales en reposo con AES-256-GCM. Las claves de cifrado y de índice ciego se
 * derivan de una sola clave maestra con HKDF, y cada valor usa un IV aleatorio propio.
 */
export class AesGcmPiiProtector implements PiiProtector {
  private readonly encryptionKey: Buffer;
  private readonly indexKey: Buffer;

  constructor(masterKey: Buffer) {
    if (masterKey.length !== 32)
      throw new Error('PII_ENCRYPTION_KEY debe tener 32 bytes (base64).');
    this.encryptionKey = Buffer.from(
      hkdfSync('sha256', masterKey, Buffer.alloc(0), 'pii-encryption-v1', 32),
    );
    this.indexKey = Buffer.from(
      hkdfSync('sha256', masterKey, Buffer.alloc(0), 'pii-blind-index-v1', 32),
    );
  }

  static fromBase64(value: string): AesGcmPiiProtector {
    return new AesGcmPiiProtector(Buffer.from(value, 'base64'));
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [VERSION, iv, data, cipher.getAuthTag()]
      .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
      .join('.');
  }

  decrypt(ciphertext: string): string {
    const [version, iv, data, tag] = ciphertext.split('.');
    if (version !== VERSION || !iv || !data || !tag)
      throw new Error('Formato de dato cifrado no soportado.');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  blindIndex(normalized: string): string {
    return createHmac('sha256', this.indexKey).update(normalized).digest('hex');
  }
}

export class RandomTokenGenerator implements TokenGenerator {
  generate(): string {
    return randomToken(32);
  }
}
