export interface ContainerInfo {
  id: string;
  names: string[];
  image: string;
  status: string;
  state: string;
}

export interface ContainerStats {
  cpuPercent: number;
  memUsedBytes: number;
  memLimitBytes: number;
}

export interface PortBinding {
  hostIP: string;
  hostPort: string;
}

export interface MountPoint {
  source: string;
  destination: string;
  mode: string;
  rw: boolean;
}

export interface EnvVar {
  key: string;
  value: string;
}

export interface ContainerInspect {
  id: string;
  name: string;
  image: string;
  created: string;
  dockerState: string;
  dockerHealth: string;
  restartPolicy: string;
  ports: Record<string, PortBinding[]>;
  mounts: MountPoint[];
  envVars: EnvVar[];
}
