import { Decision, ShipmentEvent } from "../types";

export function draftCustomerEmail(event: ShipmentEvent, decision: Decision): string {
  const greeting = `Hi ${event.customerName.split(" ")[0]},`;

  const bodyByAction: Record<Decision["action"], string> = {
    reroute: `We caught an issue with the delivery address on order ${event.orderId} and have corrected it — your package is being rerouted automatically and your new estimated delivery date will be sent shortly.`,
    refund: `We're sorry — order ${event.orderId} ran into a fulfillment issue (${event.type.replace("_", " ")}) that we weren't able to resolve in transit. We've issued a refund of $${decision.estimatedCost.toFixed(2)} to your original payment method; no action is needed on your end.`,
    escalate: `We've identified an issue with order ${event.orderId} (${event.type.replace("_", " ")}) that our team is personally reviewing to make sure we get this right for you. A member of our support team will follow up within ${decision.slaDeadlineMinutes} minutes with next steps.`,
    monitor: `We noticed a short delay with order ${event.orderId} and are keeping a close eye on it. No action is needed yet — we'll reach out proactively if the delivery timeline changes.`,
  };

  return `${greeting}\n\n${bodyByAction[decision.action]}\n\nThank you for your patience,\nCustomer Care Team`;
}
