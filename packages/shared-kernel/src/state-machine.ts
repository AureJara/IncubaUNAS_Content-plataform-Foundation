import { InvalidStateTransitionError } from './errors.ts';

export interface StateMachine<S extends string> {
  readonly aggregate: string;
  canTransition(from: S, to: S): boolean;
  /** Lanza `InvalidStateTransitionError` si la transición no está listada (RN-21). */
  assertTransition(from: S, to: S): void;
}

/** Máquina de estados declarativa (spec 10.2): solo lo listado está permitido. */
export function defineStateMachine<S extends string>(
  aggregate: string,
  // `NoInfer`: los estados salen de las claves; un destino que no es clave es un error de tipos.
  transitions: Readonly<Record<S, readonly NoInfer<S>[]>>,
): StateMachine<S> {
  const canTransition = (from: S, to: S): boolean => transitions[from].includes(to);
  return {
    aggregate,
    canTransition,
    assertTransition(from, to) {
      if (!canTransition(from, to)) throw new InvalidStateTransitionError(aggregate, from, to);
    },
  };
}
