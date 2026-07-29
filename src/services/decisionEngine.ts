import Anthropic from "@anthropic-ai/sdk";
import { Decision, ShipmentEvent } from "../types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a fulfillment exception decision agent for an
e-commerce logistics operation. You are given a shipment exception event
(delay, damage, address mismatch, or lost package) and must decide the
correct action:

- "reroute": the package/order can be salvaged by rerouting or reshipping
- "refund": issue a refund/replacement is the right call (e.g. lost, severely damaged, or high-value delay past SLA)
- "escalate": requires human judgment (ambiguous, high value, policy edge case)
- "monitor": not yet actionable, keep watching (e.g. early-stage delay within tolerance)

Consider order value, severity, days in transit, and exception type together
— e.g. a low-value minor delay should be monitored, not escalated; a
high-value lost package should be refunded/escalated, not just monitored.

Respond ONLY as JSON, no prose outside the JSON:
{
  "action": "reroute" | "refund" | "escalate" | "monitor",
  "confidence": "low" | "medium" | "high",
  "reasoning": string (2-3 sentences, reference the specific event details)
}`;

interface LLMDecision {
  action: Decision["action"];
  confidence: Decision["confidence"];
  reasoning: string;
}

export async function decideAction(event: ShipmentEvent): Promise<Decision> {
  const slaDeadlineMinutes = computeSlaMinutes(event);
  const estimatedCost = estimateCost(event);

  if (!process.env.ANTHROPIC_API_KEY) {
    const fallback = heuristicDecision(event);
    return { ...fallback, estimatedCost, slaDeadlineMinutes };
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(event, null, 2) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const parsed: LLMDecision = JSON.parse((textBlock as any)?.text?.trim() ?? "{}");

    return {
      action: parsed.action,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      estimatedCost,
      slaDeadlineMinutes,
    };
  } catch (err) {
    console.error("Decision engine LLM call failed, using fallback:", err);
    const fallback = heuristicDecision(event);
    return { ...fallback, estimatedCost, slaDeadlineMinutes };
  }
}

function computeSlaMinutes(event: ShipmentEvent): number {
  const bySeverity: Record<ShipmentEvent["severity"], number> = {
    critical: 30,
    high: 120,
    medium: 240,
    low: 480,
  };
  return bySeverity[event.severity];
}

function estimateCost(event: ShipmentEvent): number {
  if (event.type === "lost" || event.type === "damage") return event.orderValue;
  if (event.type === "delay") return Math.round(event.orderValue * 0.1);
  return 0; // address mismatch — no direct cost if caught pre-shipment
}

function heuristicDecision(event: ShipmentEvent): Omit<Decision, "estimatedCost" | "slaDeadlineMinutes"> {
  if (event.type === "lost") {
    return {
      action: event.orderValue > 300 ? "escalate" : "refund",
      confidence: "high",
      reasoning: `Package has had no scan events for ${event.daysInTransit} days with no exception code — this pattern strongly indicates a lost shipment. ${event.orderValue > 300 ? "Given the high order value, this is routed for human escalation rather than an automatic refund." : "Given the order value, an automatic refund is issued."}`,
    };
  }

  if (event.type === "damage") {
    return {
      action: "refund",
      confidence: "high",
      reasoning: `Carrier-confirmed damage in transit is a clear-cut case for refund/replacement rather than reroute, since the original item is compromised.`,
    };
  }

  if (event.type === "address_mismatch") {
    return {
      action: event.daysInTransit === 0 ? "reroute" : "escalate",
      confidence: "medium",
      reasoning: `Address mismatch caught before the package has left the origin facility can typically be corrected and rerouted automatically. ${event.daysInTransit > 0 ? "Since the package is already in transit, this is escalated for manual carrier coordination." : ""}`,
    };
  }

  // delay
  if (event.severity === "critical" || event.daysInTransit > 5) {
    return {
      action: event.orderValue > 400 ? "escalate" : "refund",
      confidence: "high",
      reasoning: `A ${event.daysInTransit}-day delay with ${event.severity} severity has exceeded reasonable customer tolerance. ${event.orderValue > 400 ? "Given the high order value, this is escalated to a human agent rather than auto-refunded." : "An automatic partial refund is issued to retain customer trust."}`,
    };
  }

  return {
    action: "monitor",
    confidence: "medium",
    reasoning: `The delay is still within an acceptable window (${event.daysInTransit} day(s), ${event.severity} severity) — continuing to monitor before taking customer-facing action.`,
  };
}
