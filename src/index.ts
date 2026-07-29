import "dotenv/config";
import path from "path";
import express from "express";
import { ShipmentEvent } from "./types";
import { handleShipmentEvent } from "./orchestrator";
import { addException, getAllExceptions, getExceptionById } from "./exceptionStore";
import { answerQuestion, ChatMessage } from "./services/chatAgent";
import warehouses from "./data/warehouses.json";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const port = process.env.PORT ?? 4000;

app.post("/webhooks/shipment-event", async (req, res) => {
  const event = req.body as ShipmentEvent;

  if (!event?.orderId || !event?.type || !event?.severity) {
    return res.status(400).json({ error: "Malformed shipment event payload" });
  }

  try {
    const record = await handleShipmentEvent(event);
    addException(record);
    return res.status(200).json(record);
  } catch (err) {
    console.error("Failed to process shipment event:", err);
    return res.status(500).json({ error: "Internal error processing event" });
  }
});

app.get("/exceptions", (_req, res) => {
  res.json(getAllExceptions());
});

app.get("/exceptions/:id", (req, res) => {
  const record = getExceptionById(req.params.id);
  if (!record) return res.status(404).json({ error: "Not found" });
  res.json(record);
});

app.get("/warehouses", (_req, res) => {
  res.json(warehouses);
});

app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body as { message: string; history?: ChatMessage[] };

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Missing 'message' field" });
  }

  try {
    const reply = await answerQuestion(message, history ?? [], getAllExceptions());
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Chat agent failed:", err);
    return res.status(500).json({ error: "Chat agent failed to respond" });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(port, () => {
  console.log(`Fulfillment Exception Agent listening on port ${port}`);
  console.log(`POST an event to http://localhost:${port}/webhooks/shipment-event`);
});
