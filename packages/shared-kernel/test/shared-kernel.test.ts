import { describe, expect, it } from 'vitest';
import { createUuidV7, defineStateMachine, fixedClock, InvalidStateTransitionError, isUuidV7 } from '../src/index.ts';

describe('createUuidV7', () => {
  it('genera UUIDv7 con el tiempo del reloj en los primeros 48 bits', () => {
    const uuid = createUuidV7(fixedClock('2026-11-08T15:00:00.000Z'))();
    expect(isUuidV7(uuid)).toBe(true);
    const ms = Number.parseInt(uuid.replace(/-/g, '').slice(0, 12), 16);
    expect(new Date(ms).toISOString()).toBe('2026-11-08T15:00:00.000Z');
  });

  it('no repite valores', () => {
    const next = createUuidV7(fixedClock('2026-11-08T15:00:00.000Z'));
    const values = new Set(Array.from({ length: 1000 }, () => next()));
    expect(values.size).toBe(1000);
  });
});

describe('defineStateMachine', () => {
  const organization = defineStateMachine('organization', {
    provisioning: ['active'],
    active: ['suspended', 'archived'],
    suspended: ['active', 'archived'],
    archived: [],
  });

  it('permite solo las transiciones listadas', () => {
    expect(organization.canTransition('active', 'suspended')).toBe(true);
    expect(() => organization.assertTransition('archived', 'active')).toThrow(InvalidStateTransitionError);
  });

  it('el error lleva el código del catálogo', () => {
    expect(() => organization.assertTransition('provisioning', 'suspended')).toThrow(
      expect.objectContaining({ code: 'invalid_state_transition' }),
    );
  });
});
