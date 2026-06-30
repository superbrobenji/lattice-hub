export interface INode {
  id: number;
  name: string;
  zone: string;
  online: boolean;
  adapterType: string;    // "pir" | "led" | "relay" | "unknown" | "serial"
  uptime: number;
  hopCount: number;
  lastSeen: string;       // ISO 8601
}

export type INodes = INode[];

export interface INodeCardProps {
  nodeData: INode;
}

export interface IZone {
  id: string;
  name: string;
}

export interface IEnrollment {
  mac: string;            // "aa:bb:cc:dd:ee:ff"
  publicKey: string;      // hex string
  status: number;         // 0=pending, 1=approved, 2=rejected
  receivedAt: number;     // Unix timestamp
  approvedAt: number;     // Unix timestamp
}
