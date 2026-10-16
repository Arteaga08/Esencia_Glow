import { describe, expect, it } from "vitest";
import { classifyUpstreamStatus } from "./upstream-status";

describe("classifyUpstreamStatus", () => {
  it("2xx -> ok", () => {
    expect(classifyUpstreamStatus(200)).toBe("ok");
    expect(classifyUpstreamStatus(204)).toBe("ok");
  });

  it("401 y 403 -> unauthorized (no hay sesión válida)", () => {
    expect(classifyUpstreamStatus(401)).toBe("unauthorized");
    expect(classifyUpstreamStatus(403)).toBe("unauthorized");
  });

  it("429 -> rate-limited: NO es lo mismo que 'sin sesión'", () => {
    expect(classifyUpstreamStatus(429)).toBe("rate-limited");
  });

  it("5xx y cualquier otro error -> unavailable", () => {
    expect(classifyUpstreamStatus(500)).toBe("unavailable");
    expect(classifyUpstreamStatus(502)).toBe("unavailable");
    expect(classifyUpstreamStatus(404)).toBe("unavailable");
  });
});
