import { lookup, resolveTxt } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { DomainRecord, DomainVerifier } from '../application/ports.js';

const HTTP_TIMEOUT_MS = 5_000;

/**
 * `true` solo para direcciones públicas. Evita que un hostname elegido por el usuario apunte la
 * verificación HTTP del servidor a su red interna, a loopback o a los metadatos de la nube (SSRF).
 */
export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b, c] = address.split('.').map(Number) as [number, number, number];
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // enlace local y metadatos de la nube
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast y reservadas
    );
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPublicAddress(mapped[1]!);
    return !(
      lower === '::' ||
      lower === '::1' ||
      /^f[cd]/.test(lower) || // fc00::/7 (únicas locales)
      /^fe[89ab]/.test(lower) || // fe80::/10 (enlace local)
      lower.startsWith('ff') || // multicast
      lower.startsWith('2001:db8') // documentación
    );
  }
  return false;
}

/**
 * Verifica el desafío del dominio: registro TXT en `_incubaunas-challenge.<host>` o un archivo bajo
 * `/.well-known/`. El HTTP no sigue redirecciones y solo se hace si el hostname resuelve a
 * direcciones públicas.
 */
export class NetworkDomainVerifier implements DomainVerifier {
  async verify(domain: Pick<DomainRecord, 'hostname' | 'challenge'>): Promise<boolean> {
    if (domain.challenge.method === 'dns_txt') {
      const records = await resolveTxt(domain.challenge.name);
      return records.some((chunks) => chunks.join('') === domain.challenge.value);
    }

    const addresses = await lookup(domain.hostname, { all: true });
    if (addresses.length === 0 || addresses.some((a) => !isPublicAddress(a.address))) return false;

    const response = await fetch(`https://${domain.hostname}${domain.challenge.name}`, {
      redirect: 'error',
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    return response.ok && (await response.text()).trim() === domain.challenge.value;
  }
}

/** Verificador para pruebas: decide por un conjunto de hostnames "controlados". */
export class FakeDomainVerifier implements DomainVerifier {
  constructor(readonly controlled = new Set<string>()) {}

  async verify(domain: Pick<DomainRecord, 'hostname'>): Promise<boolean> {
    return this.controlled.has(domain.hostname);
  }
}
