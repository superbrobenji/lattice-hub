export interface INode {
  id: number;
  name: string;
  zone: string;
  online: boolean;
  adapterType: string; // "pir" | "led" | "relay" | "unknown" | "serial"
  uptime: number;
  hopCount: number;
  lastSeen: string; // ISO 8601
}

export interface IZone {
  id: string;
  name: string;
}

export interface IEnrollment {
  mac: string;
  publicKey: string;
  status: 0 | 1 | 2; // 0=pending, 1=approved, 2=rejected
  receivedAt: number; // Unix timestamp
  approvedAt: number;
}

export interface ServerStatus {
  serial: { primary: string; secondary: string };
  nodes: { total: number; online: number; offline: number };
  mesh: { masterOnline: boolean };
}
