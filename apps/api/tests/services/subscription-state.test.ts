import { describe, expect, it } from "vitest";
import { SubscriptionStatus } from "@esencia-glow/shared";
import {
  ALL_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_TRANSITIONS,
  ENTITLED_STATUSES,
  canTransition,
  canActorTransition,
  assertTransition,
  seatEffect,
  isEntitled,
} from "../../src/services/subscription-state.js";

const { INCOMPLETE, ACTIVE, PAST_DUE, PAUSED, CANCELED } = SubscriptionStatus;

/**
 * Actores por arista: cualquier transición que depende de que Stripe
 * confirme algo (primer cobro, renovación, dunning agotado) es `system` —
 * mismo criterio "Stripe-first" que `order-state.ts` (pending->paid solo
 * system). Pausar/reanudar/cancelar-desde-pausa son autoservicio directo
 * (customer/admin, 1.7.3), sin esperar a Stripe. Re-alta tras cancelar es un
 * acto de la clienta al re-suscribirse.
 */
const VALID_PAIRS: [SubscriptionStatus, SubscriptionStatus, string[]][] = [
  [INCOMPLETE, ACTIVE, ["system"]],
  [INCOMPLETE, CANCELED, ["system"]],
  [ACTIVE, PAST_DUE, ["system"]],
  [ACTIVE, PAUSED, ["customer", "admin"]],
  [ACTIVE, CANCELED, ["system"]],
  [PAST_DUE, ACTIVE, ["system"]],
  [PAST_DUE, CANCELED, ["system"]],
  [PAUSED, ACTIVE, ["customer", "admin"]],
  [PAUSED, CANCELED, ["customer", "admin"]],
  [CANCELED, INCOMPLETE, ["customer"]],
];

const VALID_KEY = new Set(VALID_PAIRS.map(([from, to]) => `${from}->${to}`));

describe("services/subscription-state", () => {
  it("matriz completa 5x5: solo las transiciones declaradas son válidas", () => {
    for (const from of ALL_SUBSCRIPTION_STATUSES) {
      for (const to of ALL_SUBSCRIPTION_STATUSES) {
        const expected = VALID_KEY.has(`${from}->${to}`);
        expect(canTransition(from, to)).toBe(expected);
      }
    }
  });

  it("canTransition(x, x) es siempre false", () => {
    for (const status of ALL_SUBSCRIPTION_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("ACTIVE -> CANCELED solo la dispara system: la clienta nunca cancela directo, solo marca cancelAtPeriodEnd", () => {
    expect(() => assertTransition(ACTIVE, CANCELED, "system")).not.toThrow();
    expect(() => assertTransition(ACTIVE, CANCELED, "customer")).toThrowError(
      expect.objectContaining({ statusCode: 409 }),
    );
    expect(() => assertTransition(ACTIVE, CANCELED, "admin")).toThrowError(
      expect.objectContaining({ statusCode: 409 }),
    );
  });

  it("CANCELED -> INCOMPLETE está permitido (re-alta reusando el mismo documento)", () => {
    expect(canTransition(CANCELED, INCOMPLETE)).toBe(true);
  });

  it("assertTransition lanza 409 para una transición inexistente en la tabla", () => {
    expect(() => assertTransition(INCOMPLETE, PAUSED, "system")).toThrowError(
      expect.objectContaining({ statusCode: 409 }),
    );
  });

  it("matriz de actores: cada transición válida solo permite a los actores declarados", () => {
    for (const [from, to, allowedActors] of VALID_PAIRS) {
      for (const actor of ["customer", "admin", "system"] as const) {
        if (allowedActors.includes(actor)) {
          expect(() => assertTransition(from, to, actor)).not.toThrow();
        } else {
          expect(() => assertTransition(from, to, actor)).toThrowError(
            expect.objectContaining({ statusCode: 409 }),
          );
        }
      }
    }
  });

  it("SUBSCRIPTION_TRANSITIONS es exhaustivo: tiene una entrada para cada estado", () => {
    for (const status of ALL_SUBSCRIPTION_STATUSES) {
      expect(SUBSCRIPTION_TRANSITIONS[status]).toBeDefined();
    }
  });

  it("seatEffect: solo transicionar desde un estado SIN cupo hacia uno CON cupo reclama cupo (hold)", () => {
    expect(seatEffect(CANCELED, INCOMPLETE)).toBe("hold");
    expect(seatEffect(PAUSED, ACTIVE)).toBe("hold");
  });

  it("seatEffect: moverse entre dos estados que YA ocupaban cupo no reclama uno nuevo (none)", () => {
    expect(seatEffect(INCOMPLETE, ACTIVE)).toBe("none");
    expect(seatEffect(ACTIVE, PAST_DUE)).toBe("none");
    expect(seatEffect(PAST_DUE, ACTIVE)).toBe("none");
  });

  it("seatEffect: pausar libera el cupo (decisión 9 del plan de 1.7.1 — pausar SÍ libera lugar)", () => {
    expect(seatEffect(ACTIVE, PAUSED)).toBe("release");
  });

  it("seatEffect: cancelar desde cualquier estado con cupo libera el cupo", () => {
    expect(seatEffect(ACTIVE, CANCELED)).toBe("release");
    expect(seatEffect(PAST_DUE, CANCELED)).toBe("release");
    expect(seatEffect(INCOMPLETE, CANCELED)).toBe("release");
  });

  it("seatEffect: transiciones entre dos estados que ya tenían cupo (o ninguno) no tienen efecto", () => {
    expect(seatEffect(PAUSED, CANCELED)).toBe("none");
  });

  it("isEntitled: ACTIVE y PAST_DUE tienen derechos de suscriptora, el resto no", () => {
    expect(isEntitled(ACTIVE)).toBe(true);
    expect(isEntitled(PAST_DUE)).toBe(true);
    expect(isEntitled(PAUSED)).toBe(false);
    expect(isEntitled(INCOMPLETE)).toBe(false);
    expect(isEntitled(CANCELED)).toBe(false);
  });

  it("ENTITLED_STATUSES es exactamente [ACTIVE, PAST_DUE]", () => {
    expect([...ENTITLED_STATUSES].sort()).toEqual([ACTIVE, PAST_DUE].sort());
  });

  /**
   * `canActorTransition` (Fase 3 de 1.7.2a): versión que NUNCA lanza de
   * `assertTransition`, para el webhook — que no puede permitirse convertir
   * un 409 esperado (`ACTIVE->PAUSED` no es `system`) en una excepción que el
   * orquestador traduciría a `failed` + 500 + reintentos infinitos de
   * Stripe.
   */
  describe("canActorTransition", () => {
    it("es equivalente a `!throws(assertTransition)` en toda la matriz 5x5x3", () => {
      for (const from of ALL_SUBSCRIPTION_STATUSES) {
        for (const to of ALL_SUBSCRIPTION_STATUSES) {
          for (const actor of ["customer", "admin", "system"] as const) {
            let threw = false;
            try {
              assertTransition(from, to, actor);
            } catch {
              threw = true;
            }
            expect(canActorTransition(from, to, actor)).toBe(!threw);
          }
        }
      }
    });

    it("ACTIVE -> PAUSED: true para customer/admin, false para system", () => {
      expect(canActorTransition(ACTIVE, PAUSED, "customer")).toBe(true);
      expect(canActorTransition(ACTIVE, PAUSED, "admin")).toBe(true);
      expect(canActorTransition(ACTIVE, PAUSED, "system")).toBe(false);
    });

    it("una transición inexistente en la tabla es false para cualquier actor", () => {
      expect(canActorTransition(INCOMPLETE, PAUSED, "system")).toBe(false);
    });

    it("nunca lanza, ni con una arista fuera de la tabla de actores", () => {
      expect(() => canActorTransition(CANCELED, ACTIVE, "system")).not.toThrow();
    });
  });
});
