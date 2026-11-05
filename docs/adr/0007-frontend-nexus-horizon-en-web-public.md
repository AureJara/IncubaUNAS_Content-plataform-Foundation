# ADR 0007 — El front del equipo de frontend vive en `apps/web-public`

**Estado:** aceptada (2026-11-04) · **Decide:** el equipo

## Contexto

El equipo de frontend subió a `main` un sitio Astro 5 + Tailwind 3 en la **raíz** del repositorio: siete páginas
maquetadas con el sistema de diseño "Nexus Horizon" (exportado de Stitch), con datos escritos a mano, un formulario
de acceso con contraseña que no autentica y fotos hospedadas en `lh3.googleusercontent.com`. En paralelo, este
repositorio ya tenía `apps/web-public`: un sitio Astro sin estilos propios que lee la Content API (páginas del CMS,
catálogo y agenda de eventos, vista previa), con CSP estricta y caché por `Surrogate-Key`.

Dos sitios públicos serían dos fuentes de verdad. Había que quedarse con **su diseño** y con **nuestro back**.

## Decisión

1. **Un solo sitio público: `apps/web-public`.** Su diseño pasa a ser la capa visual: `Layout`, `Header`, `Footer`,
   `tailwind.config.mjs` y las páginas institucionales (`/nosotros`, `/programas`, `/portafolio`, `/convocar`,
   `/convocar/crear`) se movieron tal cual, sin cambiar su aspecto. El diseño original de Stitch se conserva en
   `docs/diseno/` como referencia (Prettier lo ignora).
2. **Las páginas con datos salen de la Content API**, con su estética:
   - `/` mantiene su portada institucional y muestra los próximos eventos reales.
   - `/eventos` y `/eventos/[slug]` son el catálogo y el detalle (agenda, estado de inscripción, ranura de
     inscripción del Equipo 3). El buscador y los filtros son mejora progresiva (sin JavaScript se ve el listado).
   - `/[...slug]` (páginas del CMS) y `/preview/[token]` renderizan los bloques con los componentes del diseño.
   - El menú lo define el CMS (`navigation`); si no hay uno (o la API cae) se usa el del diseño (`src/lib/nav.ts`).
   - `/` es la plantilla del diseño: **la página `/` del CMS queda tapada** por `index.astro`. Las demás rutas del
     CMS siguen funcionando (en el demo, `/guia`).
3. **Tailwind 3, igual que su build.** Se probó primero con Tailwind 4 (Astro 7 no admite `@astrojs/tailwind`), pero cambia
   el resultado de su diseño: `p-4.5` y `shadow-xs`, que en Tailwind 3 no hacen nada, pasan a aplicar; `leading-*` gana a
   `text-*`; la escala de sombras se renombra. Se pidió **paridad exacta**, así que `apps/web-public` usa Tailwind 3 por
   PostCSS (`postcss.config.mjs`, con `autoprefixer`), con el mismo `tailwind.config.mjs` y el mismo orden de CSS. Cambios
   mínimos en su configuración: `primary` y `primary-container` leen el color del sitio (variables `--brand-*-rgb`, con su
   valor original de respaldo; el formato `rgb(... / <alpha-value>)` mantiene `bg-primary/10`), el radio sale de
   `--brand-radius` y las fuentes apuntan a las variables autoalojadas (Inter con su eje de tamaño óptico, como la de Google).
   Los iconos siguen midiendo 24 px sea cual sea su `text-*` (su regla va sin capa tras las utilidades): lo que se
   ve es lo que ellos ven. Los componentes nuevos que necesitan otro tamaño usan `!text-base`.
4. **Cero recursos de terceros.** La CSP no admite orígenes externos: las fuentes (Inter, Plus Jakarta Sans,
   Material Symbols) se sirven desde el sitio con `@fontsource`; los logos y la imagen de aliados están en
   `public/brand/`; las fotos de ejemplo de Stitch se retiraron (las tarjetas usan un degradado con el icono del
   tipo de evento hasta que el CMS exponga portadas). Vite no inlina nada (`assetsInlineLimit: 0`): un script o una
   fuente `data:` en línea los bloquearía la CSP.
5. **Acceder no pide contraseña aquí.** La página lleva al panel (`ADMIN_URL`), que inicia OIDC (Authorization Code +
   PKCE) contra Keycloak; la plataforma nunca ve la contraseña. El selector de rol y el botón de Google se quitaron:
   el rol sale de la membresía, no de un clic, y los proveedores federados se ofrecen en Keycloak.
6. **No se prometen envíos que no existen.** `/convocar/crear` conserva su formulario, pero el botón avisa que el
   módulo de convocatorias aún no está disponible (antes decía "enviada con éxito"). Sus chips insertaban lo que
   escribe el usuario con `innerHTML`; ahora usan `textContent`.

## Qué respeta el tema del CMS

Solo `color_primary` y `radius`. El diseño fija el resto de la paleta (no solo el fondo: las superficies, el texto y
sus contrastes forman un conjunto) y las tipografías. `color_background`, `color_text` y `font_family` siguen
existiendo en el contrato pero este sitio no los usa; si el equipo de frontend quiere temas completos, hay que
diseñar una segunda paleta, no pintar encima de la actual.

## Paridad verificada con su build

Se compiló su sitio original (commit `2c5e69b`) y se comparó con el integrado, en un navegador a 1280 px de ancho, página
por página (`/nosotros`, `/programas`, `/portafolio`, `/convocar`, `/convocar/crear`): **mismo número de elementos, misma
altura de página y misma posición vertical y alto de cada elemento (0 px de diferencia)**. Quedan diferencias mínimas de texto: algunos anchos varían hasta 5 px y, en un párrafo, un salto de línea cae una palabra antes o después (sin cambiar la altura): el motor de fuentes no es idéntico al de Google Fonts. El pie lleva ahora el nombre del sitio. `/`, `/eventos` y `/acceder` no son comparables: usan datos reales.

## Guardas

- `test/no-third-party.test.ts`: ningún `.astro`/`.css`/`.ts` carga imágenes, estilos o fuentes de terceros ni usa
  manejadores `on*` en línea.
- `test/smoke/render.smoke.ts` (`pnpm test:smoke`, también en CI): levanta el sitio compilado contra una Content API
  simulada y comprueba CSP, ausencia de scripts en línea y fuentes `data:`, datos, menú del CMS, degradación con la
  API caída y el enlace de acceso.

## Pendiente con el equipo de frontend

- Textos de ejemplo del diseño que no son de IncubaUNAS: el pie dice `contacto@eventospro.com`, `+1 (555) 234-5678` y
  una dirección ficticia; los enlaces legales y las redes sociales apuntan a `#`.
- `/nosotros`, `/programas` y `/portafolio` son contenido fijo en el código. Si deben ser editables, se modelan como
  páginas del CMS con bloques nuevos en el contrato.
- Fotos reales de eventos: requieren un campo de portada en el evento publicado (Equipo 2/3) y un origen en `MEDIA_BASE_URL`.
- Modo oscuro: la configuración tiene `darkMode: 'class'` y el diseño trae clases `dark:`, pero nada lo activa.
