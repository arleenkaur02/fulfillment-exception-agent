import { v4 as uuidv4 } from "uuid";
import { ExceptionRecord, ShipmentEvent } from "./types";
import { decideAction } from "./services/decisionEngine";
import { draftCustomerEmail } from "./services/emailDrafter";

/**
 * Runs the full Fulfillment Exception pipeline for a single event:
 *
 *   Shipment Event ──▶ Decision Engine (LLM + policy heuristics)
 *                              ▼
 *                   Customer Email Draft
 *                              ▼
 *                  SLA Deadline Attached + Recorded
 */
export async function handleShipmentEvent(event: ShipmentEvent): Promise<ExceptionRecord> {
  const decision = await decideAction(event);
  const customerEmailDraft = draftCustomerEmail(event, decision);

  const now = new Date();
  const slaExpiresAt = new Date(now.getTime() + decision.slaDeadlineMinutes * 60000).toISOString();

  return {
    id: uuidv4(),
    event,
    decision,
    customerEmailDraft,
    createdAt: now.toISOString(),
    slaExpiresAt,
  };
}
