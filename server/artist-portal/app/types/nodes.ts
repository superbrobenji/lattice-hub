export interface Node {
  id: number;
  name: string;
  zone: string;
  type: "pir" | "led" | "relay" | "serial" | "unknown";
  online: boolean;
  hopCount: number;
  uptime: number;
  lastSeen: string;
}

export interface SystemStatus {
  serial: { primary: string; secondary: string };
  nodes: { total: number; online: number; offline: number };
  mesh: { masterOnline: boolean };
}

export type SSEEvent =
  | { type: "motion"; nodeId: number; name: string; zone: string; timestamp: string }
  | { type: "health"; nodeId: number; name: string; online: boolean; uptime: number }
  | { type: "node_online"; nodeId: number; name: string }
  | { type: "node_offline"; nodeId: number; name: string }
  | { type: "enrolled"; nodeId: number; name: string; adapterType: string }
  | { type: "command_ack"; commandId: string; nodeId: number; status: string };
