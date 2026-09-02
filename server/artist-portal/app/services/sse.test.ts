import { describe, it, expect } from "vitest";
import { parseSSEEvent } from "./sse";

describe("parseSSEEvent", () => {
  it("uses the SSE event name as the discriminant and passes payload fields through", () => {
    const e = parseSSEEvent(
      "motion",
      JSON.stringify({ nodeId: 3, name: "Entrance", zone: "Hallway", hopCount: 1, timestamp: "2026-09-01T10:00:00Z" }),
    );
    expect(e).toMatchObject({ type: "motion", nodeId: 3, name: "Entrance", zone: "Hallway" });
  });

  it("maps the enrolled payload's wire `type` to adapterType without clobbering the discriminant", () => {
    const e = parseSSEEvent("enrolled", JSON.stringify({ nodeId: 3, name: "Entrance", type: "pir" }));
    expect(e).toEqual({ type: "enrolled", nodeId: 3, name: "Entrance", adapterType: "pir" });
  });

  it("defaults adapterType to unknown when the enrolled payload carries no type", () => {
    const e = parseSSEEvent("enrolled", JSON.stringify({ nodeId: 3, name: "Entrance" }));
    expect(e).toMatchObject({ type: "enrolled", adapterType: "unknown" });
  });
});
