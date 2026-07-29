# Fulfillment Exception Agent

**An AI agent that handles the moment a shipment goes wrong.** It watches a warehouse/shipping event stream for delays, damage, address mismatches, and lost packages, classifies each exception, decides whether to reroute, refund, escalate, or monitor, drafts the customer email, and attaches an SLA countdown — all live, with a 3D view of the warehouse network it's operating across.

Modeled on the exception-handling problem large-scale e-commerce logistics operations (Amazon fulfillment, regional carriers) deal with constantly: a package doesn't arrive as expected, and someone — or something — has to decide what happens next, fast, and at scale.

## Why this exists

The interesting part of fulfillment isn't the happy path — it's the judgment calls. A $600 order stuck for 6 days and a $58 order with a fixable address typo shouldn't get the same treatment. This project is built to show that judgment: a decision engine that weighs order value, severity, and exception type together, explains its reasoning, and knows when to hand off to a human (`escalate`) instead of guessing.

## Architecture

```
Shipment Event ──▶ Decision Engine (Claude + policy heuristics)
                          │
                          ├──▶ Customer Email Draft
                          └──▶ SLA Deadline Attached
```

**Pipeline stages:**

1. **Event ingestion** — `POST /webhooks/shipment-event` accepts a normalized exception event (order ID, type, severity, order value, days in transit).
2. **Decision engine** — a Claude-powered agent weighs the event's specifics (is this a $600 order or a $58 one? Day 1 of a delay or day 9?) and decides `reroute`, `refund`, `escalate`, or `monitor`, with an explicit confidence level and reasoning. Falls back to a deterministic rule set if no API key is configured, so the demo always runs.
3. **Email drafter** — turns the decision into a customer-facing email, worded appropriately for the action taken.
4. **SLA tracking** — attaches a response deadline scaled to severity (critical: 30 min, high: 2 hr, medium: 4 hr, low: 8 hr).

The dashboard adds a fifth piece: a **live 3D visualization** of the warehouse network (built with Three.js) that pulses the origin warehouse in real time when an exception fires, plus an **analytics** view computed from the session's actual data, and a **chatbot** that answers questions about processed exceptions using Claude with live context.

## Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript / Node.js |
| Reasoning | Anthropic Claude API (`@anthropic-ai/sdk`) |
| Server | Express |
| 3D visualization | Three.js (warehouse network graph, live pulse animations) |
| Frontend | Vanilla HTML/CSS/JS — dark theme, tabbed dashboard |

## Getting started

```bash
git clone https://github.com/arleenkaur02/fulfillment-exception-agent.git
cd fulfillment-exception-agent
npm install
cp .env.example .env   # optional — the demo runs without any keys
```

**Run the simulation** (no server, no API keys needed):

```bash
npm run simulate
```

**Run the live server:**

```bash
npm run dev
```

Then open `http://localhost:4000` for the full dashboard, or POST directly:

```bash
curl -X POST http://localhost:4000/webhooks/shipment-event \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-88213",
    "type": "damage",
    "severity": "high",
    "originWarehouse": "wh-nj",
    "destination": "Boston, MA",
    "customerName": "R. Alvarez",
    "orderValue": 214.99,
    "daysInTransit": 2,
    "details": "Carrier scan shows damaged in transit.",
    "timestamp": "2026-07-25T09:12:00Z"
  }'
```

To get real LLM-generated reasoning instead of the heuristic fallback, add your key to `.env`:

```
ANTHROPIC_API_KEY=your_key_here
```

## Dashboard tabs

- **Live Demo** — fire sample exceptions, filter the log by decision type, expand any card to see the full customer email draft.
- **Network Map** — a live, rotatable 3D graph of the warehouse network; nodes color-coded by capacity utilization, pulsing pink when an exception fires at that warehouse.
- **Analytics** — total exceptions, estimated cost, escalation rate, and confidence breakdown, computed live from the session.
- **Ask the Agent** — a chatbot backed by Claude with the live exception log and warehouse data as context.

## What I'd add with more time

- Persist exceptions to a real database instead of in-memory (currently resets on server restart).
- Real carrier API integration (currently mocked) for actual tracking data.
- A feedback loop where human overrides of `escalate` decisions get logged and used to recalibrate the decision engine's confidence.
- Multi-warehouse rerouting logic that actually optimizes for the nearest warehouse with capacity, rather than a fixed origin.

## Project structure

```
src/
  index.ts                    Express server (webhook, exceptions, warehouses, chat endpoints)
  simulate.ts                 Standalone runner — no server/keys required
  orchestrator.ts              Wires the full pipeline together
  exceptionStore.ts            Shared in-memory exception history
  services/
    decisionEngine.ts          Claude-powered decision agent + heuristic fallback
    emailDrafter.ts             Drafts the customer-facing email
    chatAgent.ts                Powers the "Ask the Agent" tab
  data/                         Mock events, warehouse network (with 3D coordinates)
  types/                        Shared TypeScript interfaces
public/
  index.html                    Dark multi-tab dashboard with 3D network visualization
```

---

Built by [Arleen Kaur Teerthy](https://github.com/arleenkaur02) as part of a series of production-style AI agent projects.
