import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@incubaunas/db';
import { buildEnvelope } from '@incubaunas/events';
import { contentHash } from '@incubaunas/shared-kernel';
import { createHarness, dbConfigured, unique, type Harness } from '../support/harness.js';

const hero = (heading = 'Bienvenidos a IncubaUNAS') => ({ type: 'hero', props: { heading } });

describe.skipIf(!dbConfigured)(
  'Content API — CMS, publicación y lectura pública sobre PostgreSQL real',
  () => {
    let h: Harness;

    beforeAll(async () => {
      h = await createHarness();
    });
    afterAll(() => h.close());

    // ------------------------------------------------------------ utilidades
    async function tenant(roles: ('site_editor' | 'report_viewer')[] = ['site_editor']) {
      const organizationId = randomUUID();
      return { organizationId, token: await h.bearer({ organizationId, roles }) };
    }

    async function createSite(token: string, overrides: Record<string, unknown> = {}) {
      const body = {
        slug: `sitio-${unique()}`,
        name: 'Sitio de prueba',
        kind: 'client',
        locale: 'es-PE',
        ...overrides,
      };
      const response = await h.call('createSite', { bearer: token, body });
      return { response, body, site: response.body };
    }

    async function createPage(
      token: string,
      siteId: string,
      path = '/',
      blocks: unknown[] = [hero()],
    ) {
      const response = await h.call('createPage', {
        bearer: token,
        params: { site_id: siteId },
        body: { path, title: 'Inicio', blocks },
      });
      return { response, page: response.body };
    }

    async function publish(token: string, page: { id: string; revision: number }) {
      return h.call('publishPage', {
        bearer: token,
        params: { page_id: page.id },
        body: { expected_revision: page.revision },
      });
    }

    /** Un sitio con su página de inicio ya publicada (el sitio es público desde su primera publicación). */
    async function publishedSite() {
      const t = await tenant();
      const { site } = await createSite(t.token);
      const { page } = await createPage(t.token, site.id);
      const published = await publish(t.token, page);
      expect(published.status).toBe(201);
      return { ...t, site, page };
    }

    // ------------------------------------------------------------ PF-030: sitios
    describe('sitios', () => {
      it('crea un sitio con ETag y slug global único', async () => {
        const t = await tenant();
        const { response, body } = await createSite(t.token);
        expect(response.status).toBe(201);
        expect(response.headers.etag).toBe('"1"');
        expect(response.body).toMatchObject({
          slug: body.slug,
          organization_id: t.organizationId,
          theme: {},
          navigation: [],
        });

        const other = await tenant();
        const duplicate = await h.call('createSite', { bearer: other.token, body });
        expect(duplicate.status).toBe(409);
        expect(duplicate.body.code).toBe('already_exists');

        const reserved = await h.call('createSite', {
          bearer: t.token,
          body: { ...body, slug: 'admin' },
        });
        expect(reserved.status).toBe(422);
      });

      it('es idempotente por Idempotency-Key', async () => {
        const t = await tenant();
        const key = randomUUID();
        const body = { slug: `idem-${unique()}`, name: 'Sitio', kind: 'demo', locale: 'es-PE' };
        const first = await h.call('createSite', {
          bearer: t.token,
          body,
          headers: { 'idempotency-key': key },
        });
        const replay = await h.call('createSite', {
          bearer: t.token,
          body,
          headers: { 'idempotency-key': key },
        });
        expect(replay.body.id).toBe(first.body.id);
        const reused = await h.call('createSite', {
          bearer: t.token,
          body: { ...body, name: 'Otro' },
          headers: { 'idempotency-key': key },
        });
        expect(reused.body.code).toBe('idempotency_key_reused');
      });

      it('valida el contraste del tema y los enlaces de la navegación', async () => {
        const t = await tenant();
        const { site } = await createSite(t.token);
        const patch = (body: unknown) =>
          h.call('updateSite', {
            bearer: t.token,
            params: { site_id: site.id },
            headers: { 'if-match': '"1"' },
            body,
          });

        const lowContrast = await patch({
          theme: { color_background: '#ffffff', color_text: '#cccccc' },
        });
        expect(lowContrast.status).toBe(422);
        expect(lowContrast.body.errors[0].pointer).toBe('/theme/color_text');

        const protocolRelative = await patch({
          navigation: [{ label: 'Trampa', href: '//evil.example' }],
        });
        expect(protocolRelative.status).toBe(422);
        const scripted = await patch({
          navigation: [{ label: 'Trampa', href: 'javascript:alert(1)' }],
        });
        expect(scripted.status).toBe(400); // el esquema ya lo rechaza

        const ok = await patch({
          theme: { color_background: '#ffffff', color_text: '#111111', color_primary: '#0b5fff' },
          navigation: [{ label: 'Eventos', href: '/eventos' }],
        });
        expect(ok.status).toBe(200);
        expect(ok.body.revision).toBe(2);

        const stale = await patch({ name: 'Otro' });
        expect(stale.status).toBe(412);
      });

      it('lista con paginación por cursor y respeta los permisos y el tenant', async () => {
        const t = await tenant();
        for (let i = 0; i < 3; i++) await createSite(t.token);
        const first = await h.call('listSites', { bearer: t.token, query: { limit: 2 } });
        expect(first.body.items).toHaveLength(2);
        const second = await h.call('listSites', {
          bearer: t.token,
          query: { limit: 2, cursor: first.body.next_cursor },
        });
        expect(second.body.items).toHaveLength(1);
        expect(second.body.next_cursor).toBeNull();

        const viewer = await tenant(['report_viewer']);
        expect((await h.call('listSites', { bearer: viewer.token })).status).toBe(403);
        expect((await h.call('listSites', {})).status).toBe(401);

        const other = await tenant();
        expect((await h.call('listSites', { bearer: other.token })).body.items).toHaveLength(0);
      });
    });

    // ------------------------------------------------------------ PF-031: páginas y bloques
    describe('páginas y bloques', () => {
      it('valida cada bloque contra su esquema y señala el campo exacto', async () => {
        const t = await tenant();
        const { site } = await createSite(t.token);
        const bad = await h.call('createPage', {
          bearer: t.token,
          params: { site_id: site.id },
          body: {
            path: '/malo',
            title: 'Malo',
            blocks: [
              { type: 'hero', props: { subheading: 'sin título' } },
              { type: 'cta', props: { label: 'Ir', href: 'http://inseguro.example' } },
            ],
          },
        });
        expect(bad.status).toBe(422);
        const pointers = bad.body.errors.map((e: any) => e.pointer);
        expect(pointers).toEqual(
          expect.arrayContaining(['/blocks/0/props/heading', '/blocks/1/props/href']),
        );
      });

      it('rechaza HTML crudo en el Markdown y exige alt en las imágenes', async () => {
        const t = await tenant();
        const { site } = await createSite(t.token);
        const html = await h.call('createPage', {
          bearer: t.token,
          params: { site_id: site.id },
          body: {
            path: '/html',
            title: 'HTML',
            blocks: [{ type: 'rich_text', props: { markdown: 'Hola <script>alert(1)</script>' } }],
          },
        });
        expect(html.status).toBe(422);
        expect(html.body.errors[0]).toMatchObject({
          pointer: '/blocks/0/props/markdown',
          code: 'html_not_allowed',
        });

        const noAlt = await h.call('createPage', {
          bearer: t.token,
          params: { site_id: site.id },
          body: {
            path: '/img',
            title: 'Img',
            blocks: [{ type: 'image', props: { media_id: randomUUID() } }],
          },
        });
        expect(noAlt.status).toBe(422);
        expect(noAlt.body.errors[0].pointer).toBe('/blocks/0/props/alt');
      });

      it('no repite rutas en un sitio y edita con If-Match', async () => {
        const t = await tenant();
        const { site } = await createSite(t.token);
        const { page } = await createPage(t.token, site.id, '/acerca');
        expect((await createPage(t.token, site.id, '/acerca')).response.status).toBe(409);

        const edited = await h.call('updatePage', {
          bearer: t.token,
          params: { page_id: page.id },
          headers: { 'if-match': '"1"' },
          body: { title: 'Acerca de' },
        });
        expect(edited.body).toMatchObject({ title: 'Acerca de', revision: 2 });
        expect(
          (
            await h.call('updatePage', {
              bearer: t.token,
              params: { page_id: page.id },
              headers: { 'if-match': '"1"' },
              body: { title: 'X' },
            })
          ).status,
        ).toBe(412);

        const list = await h.call('listPages', { bearer: t.token, params: { site_id: site.id } });
        expect(list.body.items).toHaveLength(1);
      });

      it('una organización no ve ni toca los sitios y páginas de otra', async () => {
        const a = await tenant();
        const b = await tenant();
        const { site } = await createSite(a.token);
        const { page } = await createPage(a.token, site.id);

        expect(
          (await h.call('getSite', { bearer: b.token, params: { site_id: site.id } })).status,
        ).toBe(404);
        expect(
          (await h.call('getPage', { bearer: b.token, params: { page_id: page.id } })).status,
        ).toBe(404);
        expect(
          (
            await h.call('createPage', {
              bearer: b.token,
              params: { site_id: site.id },
              body: { path: '/x', title: 'X' },
            })
          ).status,
        ).toBe(404);
        expect(
          (
            await h.call('publishPage', {
              bearer: b.token,
              params: { page_id: page.id },
              body: { expected_revision: 1 },
            })
          ).status,
        ).toBe(404);
      });
    });

    // ------------------------------------------------------------ PF-034, PF-035, PF-046: publicación
    describe('publicación inmutable', () => {
      it('publica un snapshot con hash, lo expone con caché pública y emite el evento', async () => {
        const { site, page, organizationId } = await publishedSite();

        const publicPage = await h.call('getPublicPage', {
          params: { site_slug: site.slug, page_path: '/' },
        });
        expect(publicPage.status).toBe(200);
        expect(publicPage.body).toMatchObject({
          site_slug: site.slug,
          path: '/',
          version: 1,
          title: 'Inicio',
        });
        expect(publicPage.body.content_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect(String(publicPage.headers['cache-control'])).toContain('s-maxage=300');
        expect(String(publicPage.headers['surrogate-key'])).toContain(`page:${site.slug}:/`);
        expect(String(publicPage.headers['set-cookie'] ?? '')).toBe(''); // sin cookies privadas

        const cached = await h.call('getPublicPage', {
          params: { site_slug: site.slug, page_path: '/' },
          headers: { 'if-none-match': String(publicPage.headers.etag) },
        });
        expect(cached.status).toBe(304);

        const { rows } = await h.pool.query(
          `select topic, aggregate_version from outbox where organization_id = $1 and aggregate_id = $2`,
          [organizationId, page.id],
        );
        expect(rows).toEqual([{ topic: 'content.page.published.v1', aggregate_version: 1 }]);
      });

      it('el sitio público lista sus páginas y refleja el tema al editarlo', async () => {
        const { site, token } = await publishedSite();
        await h.call('updateSite', {
          bearer: token,
          params: { site_id: site.id },
          headers: { 'if-match': '"1"' },
          body: { navigation: [{ label: 'Inicio', href: '/' }] },
        });
        const publicSite = await h.call('getPublicSite', { params: { site_slug: site.slug } });
        expect(publicSite.body).toMatchObject({
          slug: site.slug,
          pages: [{ path: '/', title: 'Inicio' }],
          navigation: [{ label: 'Inicio', href: '/' }],
        });
        expect(
          (await h.call('getPublicSite', { params: { site_slug: 'no-existe-nunca' } })).status,
        ).toBe(404);
      });

      it('un borrador nunca es público: solo lo publicado, y lo publicado no cambia al editar', async () => {
        const { site, page, token } = await publishedSite();
        await h.call('updatePage', {
          bearer: token,
          params: { page_id: page.id },
          headers: { 'if-match': '"1"' },
          body: { title: 'Borrador nuevo' },
        });
        const stillPublished = await h.call('getPublicPage', {
          params: { site_slug: site.slug, page_path: '/' },
        });
        expect(stillPublished.body.title).toBe('Inicio');

        const draftOnly = await createPage(token, site.id, '/solo-borrador');
        expect(draftOnly.response.status).toBe(201);
        expect(
          (
            await h.call('getPublicPage', {
              params: { site_slug: site.slug, page_path: '/solo-borrador' },
            })
          ).status,
        ).toBe(404);
      });

      it('publicar exige la revisión vigente y el scope sites:publish, y es idempotente', async () => {
        const t = await tenant();
        const { site } = await createSite(t.token);
        const { page } = await createPage(t.token, site.id);

        const stale = await h.call('publishPage', {
          bearer: t.token,
          params: { page_id: page.id },
          body: { expected_revision: 99 },
        });
        expect(stale.status).toBe(412);

        const writerOnly = await h.bearer({
          organizationId: t.organizationId,
          roles: [],
          scopes: ['sites:write'],
        });
        expect(
          (
            await h.call('publishPage', {
              bearer: writerOnly,
              params: { page_id: page.id },
              body: { expected_revision: 1 },
            })
          ).status,
        ).toBe(403);

        const key = randomUUID();
        const first = await h.call('publishPage', {
          bearer: t.token,
          params: { page_id: page.id },
          body: { expected_revision: 1 },
          headers: { 'idempotency-key': key },
        });
        const replay = await h.call('publishPage', {
          bearer: t.token,
          params: { page_id: page.id },
          body: { expected_revision: 1 },
          headers: { 'idempotency-key': key },
        });
        expect(replay.body.id).toBe(first.body.id);
        const { rows } = await withTenant(h.pool, { organizationId: t.organizationId }, (c) =>
          c.query(`select count(*)::int as n from page_publications where page_id = $1`, [page.id]),
        );
        expect(rows[0].n).toBe(1);
      });

      it('restaurar crea una publicación nueva y no modifica la anterior', async () => {
        const { site, page, token } = await publishedSite();
        const v1 = await h.call('getPublicPage', {
          params: { site_slug: site.slug, page_path: '/' },
        });

        await h.call('updatePage', {
          bearer: token,
          params: { page_id: page.id },
          headers: { 'if-match': '"1"' },
          body: { title: 'Segunda versión', blocks: [hero('Otro encabezado')] },
        });
        const edited = await h.call('getPage', { bearer: token, params: { page_id: page.id } });
        const v2 = await publish(token, edited.body);
        expect(v2.body.version).toBe(2);

        const restored = await h.call('restorePage', {
          bearer: token,
          params: { page_id: page.id },
          body: { source_version: 1 },
        });
        expect(restored.status).toBe(201);
        expect(restored.body).toMatchObject({ version: 3, restored_from_version: 1 });
        expect(restored.body.content_hash).toBe(v1.body.content_hash); // mismo contenido, mismo hash

        const live = await h.call('getPublicPage', {
          params: { site_slug: site.slug, page_path: '/' },
        });
        expect(live.body).toMatchObject({ version: 3, title: 'Inicio' });

        // Las publicaciones son inmutables también a nivel de base de datos.
        await expect(
          withTenant(h.pool, { organizationId: edited.body.organization_id }, (c) =>
            c.query(`update page_publications set content_hash = 'x' where page_id = $1`, [
              page.id,
            ]),
          ),
        ).rejects.toMatchObject({ code: '42501' });
        expect(
          (
            await h.call('restorePage', {
              bearer: token,
              params: { page_id: page.id },
              body: { source_version: 99 },
            })
          ).status,
        ).toBe(404);
      });
    });

    // ------------------------------------------------------------ PF-033: vista previa
    describe('vista previa', () => {
      it('el enlace es de un solo uso, no cacheable y no indexable', async () => {
        const t = await tenant();
        const { site } = await createSite(t.token);
        const { page } = await createPage(t.token, site.id, '/secreto');

        const created = await h.call('createPreviewToken', {
          bearer: t.token,
          params: { page_id: page.id },
          body: { ttl_seconds: 300 },
        });
        expect(created.status).toBe(201);
        expect(created.headers['cache-control']).toBe('no-store');
        const token = decodeURIComponent(created.body.preview_url.split('/preview/')[1]);

        const opened = await h.call('getPreview', { params: { token } });
        expect(opened.status).toBe(200);
        expect(opened.body.path).toBe('/secreto');
        expect(opened.headers['cache-control']).toBe('no-store');
        expect(opened.headers['x-robots-tag']).toBe('noindex');

        expect((await h.call('getPreview', { params: { token } })).status).toBe(404); // ya se usó
        // El borrador nunca se coló en la lectura pública.
        expect(
          (
            await h.call('getPublicPage', {
              params: { site_slug: site.slug, page_path: '/secreto' },
            })
          ).status,
        ).toBe(404);
      });

      it('vence con el tiempo y no se puede apuntar a otra organización', async () => {
        const t = await tenant();
        const { site } = await createSite(t.token);
        const { page } = await createPage(t.token, site.id);

        const short = await h.call('createPreviewToken', {
          bearer: t.token,
          params: { page_id: page.id },
          body: { ttl_seconds: 30 },
        });
        const token = decodeURIComponent(short.body.preview_url.split('/preview/')[1]);
        h.clock.advanceSeconds(60);
        expect((await h.call('getPreview', { params: { token } })).status).toBe(404);

        const fresh = await h.call('createPreviewToken', {
          bearer: t.token,
          params: { page_id: page.id },
          body: { ttl_seconds: 300 },
        });
        const secret = decodeURIComponent(fresh.body.preview_url.split('/preview/')[1]).split(
          '.',
        )[1];
        expect(
          (await h.call('getPreview', { params: { token: `${randomUUID()}.${secret}` } })).status,
        ).toBe(404);
        expect(
          (
            await h.call('createPreviewToken', {
              bearer: t.token,
              params: { page_id: page.id },
              body: { ttl_seconds: 5 },
            })
          ).status,
        ).toBe(400);
      });
    });

    // ------------------------------------------------------------ PF-032: medios
    describe('medios', () => {
      const base = (overrides: Record<string, unknown> = {}) => ({
        file_name: 'portada.png',
        mime_type: 'image/png',
        size_bytes: 2048,
        sha256: unique().padEnd(64, '0'),
        alt_text: 'Auditorio lleno durante el congreso',
        ...overrides,
      });

      async function uploadedAsset(
        t: Awaited<ReturnType<typeof tenant>>,
        overrides: Record<string, unknown> = {},
      ) {
        const body = base(overrides);
        const requested = await h.call('requestMediaUpload', { bearer: t.token, body });
        expect(requested.status).toBe(201);
        const { rows } = await withTenant(h.pool, { organizationId: t.organizationId }, (c) =>
          c.query('select storage_key from media_assets where id = $1', [requested.body.asset.id]),
        );
        return {
          body,
          asset: requested.body.asset,
          key: rows[0].storage_key as string,
          upload: requested.body.upload,
        };
      }

      it('valida tipo, tamaño y texto alternativo, y no usa el nombre del usuario como ruta', async () => {
        const t = await tenant();
        expect(
          (
            await h.call('requestMediaUpload', {
              bearer: t.token,
              body: base({ alt_text: undefined }),
            })
          ).status,
        ).toBe(422);
        expect(
          (
            await h.call('requestMediaUpload', {
              bearer: t.token,
              body: base({ mime_type: 'application/x-msdownload' }),
            })
          ).status,
        ).toBe(400);
        expect(
          (
            await h.call('requestMediaUpload', {
              bearer: t.token,
              body: base({ size_bytes: 11 * 1024 * 1024 }),
            })
          ).status,
        ).toBe(400);

        const { asset, key, upload } = await uploadedAsset(t, { file_name: '../../etc/passwd' });
        expect(asset).toMatchObject({ state: 'pending', file_name: '.._.._etc_passwd' });
        expect(key).toBe(`org/${t.organizationId}/media/${asset.id}`);
        expect(upload).toMatchObject({ method: 'PUT' });
      });

      it('recorre pending → scanning → ready y solo entonces se puede publicar', async () => {
        const t = await tenant();
        const { site } = await createSite(t.token);
        const { asset, key, body } = await uploadedAsset(t);

        // Antes de subir el archivo no se puede confirmar.
        expect(
          (
            await h.call('completeMediaUpload', {
              bearer: t.token,
              params: { media_id: asset.id },
              body: { size_bytes: body.size_bytes },
            })
          ).status,
        ).toBe(409);

        h.storage.simulateUpload(key, 9999);
        expect(
          (
            await h.call('completeMediaUpload', {
              bearer: t.token,
              params: { media_id: asset.id },
              body: { size_bytes: 9999 },
            })
          ).status,
        ).toBe(422); // tamaño distinto

        h.storage.simulateUpload(key, body.size_bytes);
        const completed = await h.call('completeMediaUpload', {
          bearer: t.token,
          params: { media_id: asset.id },
          body: { size_bytes: body.size_bytes },
        });
        expect(completed.body.state).toBe('scanning');

        const withImage = [
          hero(),
          { type: 'image', props: { media_id: asset.id, alt: 'Auditorio lleno' } },
        ];
        const { page } = await createPage(t.token, site.id, '/galeria', withImage);
        const early = await publish(t.token, page);
        expect(early.status).toBe(409);
        expect(early.body.code).toBe('media_not_ready');

        expect(await h.media.runScanBatch(t.organizationId)).toEqual({ ready: 1, quarantined: 0 });
        expect((await publish(t.token, page)).status).toBe(201);
      });

      it('un archivo infectado queda en cuarentena y bloquea la publicación', async () => {
        const t = await tenant();
        const { site } = await createSite(t.token);
        const { asset, key, body } = await uploadedAsset(t);
        h.scanner.infected.add(body.sha256);
        h.storage.simulateUpload(key, body.size_bytes);
        await h.call('completeMediaUpload', {
          bearer: t.token,
          params: { media_id: asset.id },
          body: { size_bytes: body.size_bytes },
        });

        expect(await h.media.runScanBatch(t.organizationId)).toEqual({ ready: 0, quarantined: 1 });
        const { page } = await createPage(t.token, site.id, '/mala', [
          { type: 'image', props: { media_id: asset.id, alt: 'x' } },
        ]);
        const response = await publish(t.token, page);
        expect(response.status).toBe(409);
        expect(response.body.code).toBe('media_quarantined');
      });
    });

    // ------------------------------------------------------------ PF-037, PF-042: proyección de eventos
    describe('proyección pública de eventos', () => {
      const iso = (s: string) => new Date(s).toISOString();

      function manifest(
        siteId: string,
        eventId: string,
        slug: string,
        overrides: Record<string, unknown> = {},
      ) {
        return {
          event: {
            id: eventId,
            site_id: siteId,
            slug,
            title: 'Congreso de Innovación',
            kind: 'congreso',
            description: 'Tres días de ponencias.',
            starts_at: iso('2026-12-01T14:00:00Z'),
            ends_at: iso('2026-12-03T22:00:00Z'),
            timezone: 'America/Lima',
            status: 'published',
            ...overrides,
          },
          programs: [{ slug: 'ia', name: 'Inteligencia Artificial', color: '#0b5fff' }],
          sessions: [
            {
              id: randomUUID(),
              program_slug: 'ia',
              title: 'Apertura',
              starts_at: iso('2026-12-01T15:00:00Z'),
              ends_at: iso('2026-12-01T16:00:00Z'),
              venue_name: 'Auditorio',
              speakers: ['Ana Torres'],
            },
          ],
        };
      }

      function release(
        organizationId: string,
        eventId: string,
        m: unknown,
        options: { version: number; hash?: string; publicationId?: string },
      ) {
        const publicationId = options.publicationId ?? randomUUID();
        const ref = `releases/${publicationId}/manifest.json`;
        h.fetcher.manifests.set(ref, m);
        return buildEnvelope(
          {
            topic: 'configuration.event.release_published.v1',
            producer: 'configuration',
            organizationId,
            businessEventId: eventId,
            aggregate: { type: 'event', id: eventId, version: options.version },
            actor: { type: 'user', id: 'user-config' },
            occurredAt: h.clock.now(),
            data: {
              event_id: eventId,
              publication_id: publicationId,
              release_version: options.version,
              manifest_ref: ref,
              manifest_hash: options.hash ?? contentHash(m),
              effective_at: h.clock.now().toISOString(),
            },
          },
          { clock: h.clock },
        );
      }

      const availability = (
        organizationId: string,
        eventId: string,
        state: string,
        band: string | null,
        asOf: string,
        version = 1,
      ) =>
        buildEnvelope(
          {
            topic: 'participation.availability.changed.v1',
            producer: 'participation',
            organizationId,
            businessEventId: eventId,
            aggregate: { type: 'capacity_counter', id: eventId, version },
            actor: { type: 'system', id: 'system:capacity' },
            occurredAt: h.clock.now(),
            data: { event_id: eventId, public_state: state, remaining_band: band, as_of: asOf },
          },
          { clock: h.clock },
        );

      it('activa una release completa y la sirve sin tocar Configuration ni Participation', async () => {
        const { site, organizationId } = await publishedSite();
        const eventId = randomUUID();
        const m = manifest(site.id, eventId, 'congreso-2026');

        await h.bus.publish(release(organizationId, eventId, m, { version: 1 }));

        const event = await h.call('getPublicEvent', {
          params: { site_slug: site.slug, event_slug: 'congreso-2026' },
        });
        expect(event.status).toBe(200);
        expect(event.body).toMatchObject({
          title: 'Congreso de Innovación',
          release_version: 1,
          status: 'published',
        });
        expect(event.body.programs).toHaveLength(1);
        expect(event.body.sessions[0].title).toBe('Apertura');
        expect(String(event.headers['cache-control'])).toContain('s-maxage=300');

        const list = await h.call('listPublicEvents', { params: { site_slug: site.slug } });
        expect(list.body.items.map((e: any) => e.slug)).toEqual(['congreso-2026']);
      });

      it('una reentrega no tiene efecto y un mensaje viejo no pisa a uno más nuevo', async () => {
        const { site, organizationId } = await publishedSite();
        const eventId = randomUUID();
        const v2 = release(
          organizationId,
          eventId,
          manifest(site.id, eventId, 'evento-orden', { title: 'Versión 2' }),
          { version: 2 },
        );
        const v1 = release(
          organizationId,
          eventId,
          manifest(site.id, eventId, 'evento-orden', { title: 'Versión 1' }),
          { version: 1 },
        );

        await h.bus.publish(v2);
        await h.bus.publish(v2); // duplicado
        await h.bus.publish(v1); // llega tarde

        const event = await h.call('getPublicEvent', {
          params: { site_slug: site.slug, event_slug: 'evento-orden' },
        });
        expect(event.body).toMatchObject({ title: 'Versión 2', release_version: 2 });

        const { rows } = await withTenant(h.pool, { organizationId }, (c) =>
          c.query(
            `select status from event_releases where event_id = $1 order by release_version`,
            [eventId],
          ),
        );
        expect(rows).toEqual([{ status: 'active' }]); // la v1 vieja ni se registró
      });

      it('al activar una release nueva la anterior queda superseded (siempre una sola activa)', async () => {
        const { site, organizationId } = await publishedSite();
        const eventId = randomUUID();
        await h.bus.publish(
          release(
            organizationId,
            eventId,
            manifest(site.id, eventId, 'evento-versiones', { title: 'A' }),
            { version: 1 },
          ),
        );
        await h.bus.publish(
          release(
            organizationId,
            eventId,
            manifest(site.id, eventId, 'evento-versiones', { title: 'B' }),
            { version: 2 },
          ),
        );

        const { rows } = await withTenant(h.pool, { organizationId }, (c) =>
          c.query(
            `select release_version, status from event_releases where event_id = $1 order by release_version`,
            [eventId],
          ),
        );
        expect(rows).toEqual([
          { release_version: 1, status: 'superseded' },
          { release_version: 2, status: 'active' },
        ]);
      });

      it('una release con manifiesto inválido, hash distinto o sitio ajeno no se hace visible', async () => {
        const { site, organizationId } = await publishedSite();
        const other = await publishedSite();

        const tampered = randomUUID();
        await h.bus.publish(
          release(organizationId, tampered, manifest(site.id, tampered, 'evento-hash'), {
            version: 1,
            hash: `sha256:${'0'.repeat(64)}`,
          }),
        );
        const broken = randomUUID();
        await h.bus.publish(
          release(organizationId, broken, { event: { id: broken } } as never, { version: 1 }),
        );
        const foreign = randomUUID();
        await h.bus.publish(
          release(organizationId, foreign, manifest(other.site.id, foreign, 'evento-ajeno'), {
            version: 1,
          }),
        );

        for (const slug of ['evento-hash', 'evento-ajeno']) {
          expect(
            (await h.call('getPublicEvent', { params: { site_slug: site.slug, event_slug: slug } }))
              .status,
          ).toBe(404);
        }
        const { rows } = await withTenant(h.pool, { organizationId }, (c) =>
          c.query(
            `select error from event_releases where event_id = any($1::uuid[]) order by error`,
            [[tampered, broken, foreign]],
          ),
        );
        expect(rows.map((r) => r.error)).toEqual([
          'manifest_hash_mismatch',
          'manifest_invalid',
          'site_not_found',
        ]);
      });

      it('refleja la disponibilidad (solo si es más reciente) y la cancelación', async () => {
        const { site, organizationId } = await publishedSite();
        const eventId = randomUUID();
        await h.bus.publish(
          release(organizationId, eventId, manifest(site.id, eventId, 'evento-cupos'), {
            version: 1,
          }),
        );

        await h.bus.publish(
          availability(organizationId, eventId, 'open', 'few', '2026-11-04T16:45:00Z'),
        );
        await h.bus.publish(
          availability(organizationId, eventId, 'open', 'plenty', '2026-11-04T10:00:00Z'),
        ); // más vieja
        const open = await h.call('getPublicEvent', {
          params: { site_slug: site.slug, event_slug: 'evento-cupos' },
        });
        expect(open.body.registration).toMatchObject({ state: 'open', remaining_band: 'few' });

        await h.bus.publish(
          buildEnvelope(
            {
              topic: 'configuration.event.cancelled.v1',
              producer: 'configuration',
              organizationId,
              businessEventId: eventId,
              aggregate: { type: 'event', id: eventId, version: 9 },
              actor: { type: 'user', id: 'user-config' },
              occurredAt: h.clock.now(),
              data: {
                event_id: eventId,
                publication_id: randomUUID(),
                reason_code: 'organizer_decision',
                effective_at: h.clock.now().toISOString(),
              },
            },
            { clock: h.clock },
          ),
        );
        const cancelled = await h.call('getPublicEvent', {
          params: { site_slug: site.slug, event_slug: 'evento-cupos' },
        });
        expect(cancelled.body.status).toBe('cancelled');
      });
    });

    // ------------------------------------------------------------ eventos de salida
    it('los eventos de salida cumplen el contrato y no llevan datos personales', async () => {
      const { organizationId } = await publishedSite();
      const { rows } = await h.pool.query(`select payload from outbox where organization_id = $1`, [
        organizationId,
      ]);
      expect(rows).toHaveLength(1);
      expect(rows[0].payload).toMatchObject({
        topic: 'content.page.published.v1',
        producer: 'content',
      });
      expect(JSON.stringify(rows[0].payload)).not.toMatch(/email|@/);
    });
  },
);
