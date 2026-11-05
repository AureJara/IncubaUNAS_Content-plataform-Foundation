import { describe, expect, it } from 'vitest';
import { DEFAULT_NAVIGATION, isActivePath, resolveNavigation } from '../src/lib/nav.js';

describe('resolveNavigation', () => {
  it('sin menú en el CMS (o sin sitio) usa el menú del diseño', () => {
    expect(resolveNavigation(null)).toEqual([...DEFAULT_NAVIGATION]);
    expect(resolveNavigation({ navigation: [] })).toEqual([...DEFAULT_NAVIGATION]);
  });

  it('el menú del CMS manda, y cada enlace se revalida', () => {
    const items = resolveNavigation({
      navigation: [
        { label: 'Eventos', href: '/eventos' },
        { label: 'Malo', href: 'javascript:alert(1)' },
        { label: 'Externo', href: 'https://example.org' },
        { label: 'Protocolo relativo', href: '//evil.example' },
      ],
    });
    expect(items).toEqual([
      { label: 'Eventos', href: '/eventos' },
      { label: 'Malo', href: '#' },
      { label: 'Externo', href: 'https://example.org' },
      { label: 'Protocolo relativo', href: '#' },
    ]);
  });

  it('devuelve una copia: modificar el resultado no altera el menú del diseño', () => {
    resolveNavigation(null).pop();
    expect(DEFAULT_NAVIGATION).toHaveLength(5);
  });
});

describe('isActivePath', () => {
  it('el inicio solo está activo en la raíz', () => {
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/', '/eventos')).toBe(false);
  });

  it('una sección está activa en su ruta y en las que cuelgan de ella', () => {
    expect(isActivePath('/eventos', '/eventos')).toBe(true);
    expect(isActivePath('/eventos', '/eventos/')).toBe(true);
    expect(isActivePath('/eventos', '/eventos/demo-day')).toBe(true);
  });

  it('no confunde rutas con el mismo prefijo', () => {
    expect(isActivePath('/eventos', '/eventos-pasados')).toBe(false);
    expect(isActivePath('/convocar', '/convocar/crear')).toBe(true);
  });

  it('un enlace inválido nunca queda activo', () => {
    expect(isActivePath('#', '/')).toBe(false);
  });
});
