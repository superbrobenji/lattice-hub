import { SIM_URL } from './urls';

export interface SimNode {
  mac: string;
  name: string;
  type: 'pir' | 'led' | 'relay' | 'serial' | 'unknown';
  enrolled: boolean;
  rejected: boolean;
  offline: boolean;
  silent: boolean;
  nodeId: number;
  ackCount: number;
}

export class SimClient {
  private async post(path: string, body?: unknown): Promise<void> {
    const res = await fetch(`${SIM_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`);
  }

  spawnNode(mac: string, type: 'pir' | 'led' | 'relay'): Promise<void> {
    return this.post('/sim/nodes', { mac, type });
  }
  motion(mac: string): Promise<void> {
    return this.post(`/sim/nodes/${mac}/motion`);
  }
  setOffline(mac: string): Promise<void> {
    return this.post(`/sim/nodes/${mac}/offline`);
  }
  setOnline(mac: string): Promise<void> {
    return this.post(`/sim/nodes/${mac}/online`);
  }
  reset(): Promise<void> {
    return this.post('/sim/reset');
  }
  async state(): Promise<{ nodes: SimNode[] }> {
    const res = await fetch(`${SIM_URL}/sim/state`);
    if (!res.ok) throw new Error(`GET /sim/state → ${res.status}`);
    return res.json();
  }
  async node(mac: string): Promise<SimNode | undefined> {
    return (await this.state()).nodes.find((n) => n.mac === mac);
  }
}
