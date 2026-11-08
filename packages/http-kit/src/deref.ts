type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function decodeSegment(segment: string): string {
  return decodeURIComponent(segment).replaceAll('~1', '/').replaceAll('~0', '~');
}

function resolvePointer(root: Json, ref: string): Json {
  if (!ref.startsWith('#/')) throw new Error(`Solo se admiten referencias internas: ${ref}`);
  let current: Json = root;
  for (const segment of ref.slice(2).split('/').map(decodeSegment)) {
    if (current === null || typeof current !== 'object' || !(segment in current)) {
      throw new Error(`Referencia sin destino: ${ref}`);
    }
    current = (current as Record<string, Json>)[segment] as Json;
  }
  return current;
}

/**
 * Reemplaza cada `$ref` interno por su destino (el contrato empaquetado por Redocly solo tiene referencias internas).
 * Los hermanos de `$ref` (por ejemplo `description`) se conservan. Un ciclo es un error del contrato.
 */
export function dereference<T>(document: T): T {
  const root = document as Json;
  const resolved = new Map<string, Json>();
  const inProgress = new Set<string>();

  const walk = (node: Json): Json => {
    if (Array.isArray(node)) return node.map(walk);
    if (node === null || typeof node !== 'object') return node;
    const { $ref: ref, ...siblings } = node;
    if (typeof ref === 'string') {
      const target = resolveRef(ref);
      if (Object.keys(siblings).length === 0) return target;
      return { ...(target as Record<string, Json>), ...(walk(siblings) as Record<string, Json>) };
    }
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, walk(value)]));
  };

  const resolveRef = (ref: string): Json => {
    const cached = resolved.get(ref);
    if (cached !== undefined) return cached;
    if (inProgress.has(ref)) throw new Error(`Referencia circular en el contrato: ${ref}`);
    inProgress.add(ref);
    const value = walk(resolvePointer(root, ref));
    inProgress.delete(ref);
    resolved.set(ref, value);
    return value;
  };

  return walk(root) as T;
}
