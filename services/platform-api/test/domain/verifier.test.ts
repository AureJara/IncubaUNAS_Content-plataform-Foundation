import { describe, expect, it } from 'vitest';
import { isPublicAddress } from '../../src/infrastructure/domain-verifier.js';

describe('isPublicAddress (defensa contra SSRF)', () => {
  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '200.37.0.1',
    '172.15.255.255',
    '172.32.0.1',
    '2606:4700:4700::1111',
    '::ffff:8.8.8.8',
  ])('acepta la dirección pública %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    '127.0.0.1',
    '127.1.2.3',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // metadatos de la nube
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    'no-es-una-ip',
    '',
  ])('rechaza %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});
