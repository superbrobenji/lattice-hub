import { describe, it, expect } from "vitest";
import { formatUptime, eventDetail } from "./events";
import type { SSEEvent } from "../types/nodes";

describe("formatUptime", () => {
  it("renders sub-minute uptimes in seconds", () => {
    expect(formatUptime(0)).toBe("0s");
    expect(formatUptime(45)).toBe("45s");
  });

  it("renders minutes and seconds under an hour", () => {
    expect(formatUptime(65)).toBe("1m 5s");
  });

  it("renders hours and minutes under a day", () => {
    expect(formatUptime(2 * 3600 + 13 * 60 + 9)).toBe("2h 13m");
  });

  it("renders days and hours from a day up", () => {
    expect(formatUptime(3 * 86400 + 4 * 3600 + 59 * 60)).toBe("3d 4h");
  });

  it("falls back to a dash for non-finite input", () => {
    expect(formatUptime(Number.NaN)).toBe("—");
  });
});

describe("eventDetail", () => {
  it("motion shows the zone", () => {
    const e: SSEEvent = {
      type: "motion", nodeId: 3, name: "Entrance", zone: "Hallway", timestamp: "2026-09-01T10:00:00Z",
    };
    expect(eventDetail(e)).toBe("zone Hallway");
  });

  it("motion shows a placeholder when the zone is unset", () => {
    const e: SSEEvent = {
      type: "motion", nodeId: 3, name: "Entrance", zone: "", timestamp: "2026-09-01T10:00:00Z",
    };
    expect(eventDetail(e)).toBe("zone —");
  });

  it("health shows online state and human-readable uptime", () => {
    const e: SSEEvent = { type: "health", nodeId: 3, name: "Entrance", online: true, uptime: 7389 };
    expect(eventDetail(e)).toBe("online · up 2h 3m");
  });

  it("health shows offline state", () => {
    const e: SSEEvent = { type: "health", nodeId: 3, name: "Entrance", online: false, uptime: 12 };
    expect(eventDetail(e)).toBe("offline · up 12s");
  });

  it("node_online has no detail beyond the name the row already shows", () => {
    const e: SSEEvent = { type: "node_online", nodeId: 3, name: "Entrance" };
    expect(eventDetail(e)).toBe("");
  });

  it("node_offline has no detail beyond the name the row already shows", () => {
    const e: SSEEvent = { type: "node_offline", nodeId: 3, name: "Entrance" };
    expect(eventDetail(e)).toBe("");
  });

  it("enrolled shows the adapter type", () => {
    const e: SSEEvent = { type: "enrolled", nodeId: 3, name: "Entrance", adapterType: "pir" };
    expect(eventDetail(e)).toBe("type pir");
  });

  it("command_ack shows node, status and command id", () => {
    const e: SSEEvent = {
      type: "command_ack", commandId: "3f2a9c1e-0000-4000-8000-000000000000", nodeId: 3, status: "ok",
    };
    expect(eventDetail(e)).toBe("node 3 · ok · cmd 3f2a9c1e-0000-4000-8000-000000000000");
  });

  it("route_update shows node and parent", () => {
    const e: SSEEvent = { type: "route_update", nodeId: 3, parentId: 1 };
    expect(eventDetail(e)).toBe("node 3 → parent 1");
  });

  it("route_update shows master when the parent is null (root)", () => {
    const e: SSEEvent = { type: "route_update", nodeId: 3, parentId: null };
    expect(eventDetail(e)).toBe("node 3 → master");
  });
});
