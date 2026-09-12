import { describe, expect, it } from "vitest";
import { StockStatus } from "@esencia-glow/shared";
import {
  resolveEffectiveThreshold,
  resolveStockStatus,
  worstStatus,
} from "../../src/services/inventory-status.js";

describe("services/inventory-status", () => {
  describe("resolveEffectiveThreshold", () => {
    it("usa el override del SKU cuando existe", () => {
      expect(resolveEffectiveThreshold(10, 5)).toBe(10);
    });

    it("usa el default global cuando el override es undefined", () => {
      expect(resolveEffectiveThreshold(undefined, 5)).toBe(5);
    });

    it("un override en 0 sigue siendo el override (no es 'ausente')", () => {
      expect(resolveEffectiveThreshold(0, 5)).toBe(0);
    });
  });

  describe("resolveStockStatus", () => {
    it("out cuando available es 0", () => {
      expect(resolveStockStatus(0, 5)).toBe(StockStatus.OUT);
    });

    it("out cuando available es negativo", () => {
      expect(resolveStockStatus(-2, 5)).toBe(StockStatus.OUT);
    });

    it("low cuando available está en o por debajo del umbral, pero es positivo", () => {
      expect(resolveStockStatus(5, 5)).toBe(StockStatus.LOW);
      expect(resolveStockStatus(1, 5)).toBe(StockStatus.LOW);
    });

    it("ok cuando available supera el umbral", () => {
      expect(resolveStockStatus(6, 5)).toBe(StockStatus.OK);
    });
  });

  describe("worstStatus", () => {
    it("out es peor que low, low peor que ok", () => {
      expect(worstStatus([StockStatus.OK, StockStatus.LOW])).toBe(StockStatus.LOW);
      expect(worstStatus([StockStatus.OK, StockStatus.OUT])).toBe(StockStatus.OUT);
      expect(worstStatus([StockStatus.LOW, StockStatus.OUT])).toBe(StockStatus.OUT);
    });

    it("untracked se trata como el estado por defecto cuando no hay ninguna fila", () => {
      expect(worstStatus([])).toBe(StockStatus.UNTRACKED);
    });

    it("un solo status se devuelve tal cual", () => {
      expect(worstStatus([StockStatus.OK])).toBe(StockStatus.OK);
    });
  });
});
