import "dotenv/config";
import mockEvents from "./data/mockEvents.json";
import { ShipmentEvent } from "./types";
import { handleShipmentEvent } from "./orchestrator";

async function main() {
  console.log("Fulfillment Exception Agent — simulation run\n" + "=".repeat(60));

  for (const event of mockEvents as ShipmentEvent[]) {
    console.log(`\n▶ Processing ${event.orderId} (${event.type}, ${event.severity})`);
    const record = await handleShipmentEvent(event);

    console.log(`  Decision: ${record.decision.action} (${record.decision.confidence} confidence)`);
    console.log(`  Reasoning: ${record.decision.reasoning}`);
    console.log(`  Estimated cost: $${record.decision.estimatedCost}`);
    console.log(`  SLA deadline: ${record.decision.slaDeadlineMinutes} minutes`);
    console.log("-".repeat(60));
  }

  console.log("\nSimulation complete.");
}

main().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
