export interface KafkaStatus {
  reachable: boolean;
  broker?: string;
  partitions?: number;
  error?: string;
}

export interface KafkaEvent {
  offset: number;
  timestamp: number; // Unix
  value: string;
}

export interface KafkaEventsResponse {
  topic: string;
  events: KafkaEvent[];
  count: number;
}
