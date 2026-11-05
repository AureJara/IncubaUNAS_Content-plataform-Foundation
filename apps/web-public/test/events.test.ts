import { describe, expect, it } from 'vitest';
import {
  isCancelled,
  kindIcon,
  kindLabel,
  registrationBadge,
  registrationSentence,
} from '../src/lib/events.js';

describe('estado de inscripción', () => {
  it('muestra una insignia corta y una frase completa con la banda de cupos', () => {
    const open = { state: 'open', remaining_band: 'few' } as never;
    expect(registrationBadge(open)).toBe('Inscripciones abiertas');
    expect(registrationSentence(open)).toBe('Inscripciones abiertas. Quedan pocos cupos.');
  });

  it('sin banda de cupos no inventa una', () => {
    expect(registrationSentence({ state: 'closed' } as never)).toBe(
      'Las inscripciones están cerradas.',
    );
  });

  it('sin información de inscripción (o con un estado desconocido) no muestra nada', () => {
    expect(registrationBadge(undefined)).toBeNull();
    expect(registrationSentence(undefined)).toBeNull();
    expect(registrationSentence({ state: 'raro' } as never)).toBeNull();
  });
});

describe('tipo de evento', () => {
  it('humaniza el identificador del catálogo', () => {
    expect(kindLabel('demo_day')).toBe('Demo day');
    expect(kindLabel('workshop')).toBe('Workshop');
    expect(kindLabel('open-call')).toBe('Open call');
  });

  it('elige un icono y cae en uno genérico si no reconoce el tipo', () => {
    expect(kindIcon('workshop')).toBe('build');
    expect(kindIcon('Demo_Day')).toBe('rocket_launch');
    expect(kindIcon('algo-nuevo')).toBe('event');
  });

  it('un evento cancelado se reconoce por su estado', () => {
    expect(isCancelled({ status: 'cancelled' })).toBe(true);
    expect(isCancelled({ status: 'published' })).toBe(false);
  });
});
