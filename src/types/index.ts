export type ExceptionType = "delay" | "damage" | "address_mismatch" | "lost";
export type ExceptionSeverity = "critical" | "high" | "medium" | "low";
export type DecisionAction = "reroute" | "refund" | "escalate" | "monitor";

export interface Warehouse {
  id: string;
  name: string;
  region: string;
  x: number;
  y: number;
  z: number;
  capacityUtilization: number;
}

export interface ShipmentEvent {
  id: string;
  orderId: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  originWarehouse: string;
  destination: string;
  customerName: string;
  orderValue: number;
  daysInTransit: number;
  details: string;
  timestamp: string;
}

export interface Decision {
  action: DecisionAction;
  confidence: "low" | "medium" | "high";
  reasoning: string;
  estimatedCost: number;
  slaDeadlineMinutes: number;
}

export interface ExceptionRecord {
  id: string;
  event: ShipmentEvent;
  decision: Decision;
  customerEmailDraft: string;
  createdAt: string;
  slaExpiresAt: string;
}
