import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Integration Guides — Lattice Artist Portal" },
];

const GUIDES = [
  {
    title: "Getting Started",
    description:
      "Connect your first node, enroll it into the mesh, and verify it appears in the Live Tracker.",
    tags: ["quickstart"],
  },
  {
    title: "Controlling LED Nodes",
    description:
      "Send led_solid and led_off commands via the REST API. Includes colour format reference and rate limits.",
    tags: ["led", "commands"],
  },
  {
    title: "Relay Switching",
    description:
      "Toggle relay nodes on and off. Covers relay_on, relay_off actions and command acknowledgement flow.",
    tags: ["relay", "commands"],
  },
  {
    title: "Reading Motion Events",
    description:
      "Subscribe to the SSE event stream to receive real-time motion events from PIR sensors.",
    tags: ["pir", "sse"],
  },
  {
    title: "Node Health & Topology",
    description:
      "Understand hop counts, health timeouts, and how the mesh routes messages back to the master.",
    tags: ["mesh", "health"],
  },
  {
    title: "Enrollment Flow",
    description:
      "Walk through how new nodes announce themselves and how to approve or reject enrollments.",
    tags: ["enrollment"],
  },
];

export default function GuidesPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Integration Guides</h1>
      <p className="text-sm text-muted mb-8">
        Everything you need to build on the Lattice mesh network.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {GUIDES.map((g) => (
          <div
            key={g.title}
            className="bg-surface border border-border rounded-lg p-5"
          >
            <h2 className="text-sm font-semibold text-white mb-2">{g.title}</h2>
            <p className="text-xs text-muted leading-relaxed mb-4">{g.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 text-[10px] rounded bg-elevated text-muted border border-border"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
