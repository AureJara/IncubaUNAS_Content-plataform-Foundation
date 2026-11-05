import type {
  MalwareScanner,
  ObjectStorage,
  ReleaseManifestFetcher,
} from '../application/ports.js';

/**
 * Almacenamiento en memoria para pruebas y desarrollo. El proveedor real (S3 compatible, GCS…) es
 * una decisión de despliegue pendiente; el caso de uso solo conoce el puerto.
 */
export class InMemoryObjectStorage implements ObjectStorage {
  private readonly objects = new Map<string, number>();

  async presignUpload(input: { key: string; expiresAt: Date }) {
    return {
      method: 'PUT' as const,
      url: `https://storage.invalid/${input.key}?expires=${input.expiresAt.getTime()}`,
      headers: {},
    };
  }

  async head(key: string) {
    const size = this.objects.get(key);
    return size === undefined ? null : { sizeBytes: size };
  }

  /** Simula la subida directa del navegador. */
  simulateUpload(key: string, sizeBytes: number): void {
    this.objects.set(key, sizeBytes);
  }
}

/** Escáner de pruebas: el veredicto lo decide el hash declarado. */
export class FakeMalwareScanner implements MalwareScanner {
  readonly infected = new Set<string>();

  async scan(input: { sha256: string }) {
    return this.infected.has(input.sha256) ? ('infected' as const) : ('clean' as const);
  }
}

/**
 * Escáner por omisión: no hay motor real configurado, así que NUNCA da un archivo por limpio. Los
 * medios quedan en `scanning` (y no se pueden publicar) hasta que se configure un escáner de verdad.
 */
export class UnconfiguredMalwareScanner implements MalwareScanner {
  async scan(): Promise<'clean' | 'infected'> {
    throw new Error('No hay un escáner de malware configurado.');
  }
}

/** Manifiestos servidos desde un mapa en memoria (pruebas). */
export class InMemoryManifestFetcher implements ReleaseManifestFetcher {
  readonly manifests = new Map<string, unknown>();

  async fetch(manifestRef: string): Promise<unknown> {
    if (!this.manifests.has(manifestRef))
      throw new Error(`Manifiesto no disponible: ${manifestRef}`);
    return this.manifests.get(manifestRef);
  }
}

/** Descarga el manifiesto por HTTPS desde el servicio de Configuration, con tiempo máximo. */
export class HttpManifestFetcher implements ReleaseManifestFetcher {
  constructor(
    private readonly baseUrl: string,
    private readonly bearer: () => Promise<string>,
  ) {}

  async fetch(manifestRef: string): Promise<unknown> {
    const url = new URL(manifestRef, this.baseUrl);
    if (url.origin !== new URL(this.baseUrl).origin)
      throw new Error('El manifiesto debe provenir del servicio de Configuration.');
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${await this.bearer()}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Manifiesto: HTTP ${response.status}`);
    return response.json();
  }
}
