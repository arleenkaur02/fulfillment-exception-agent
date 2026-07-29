import Anthropic from "@anthropic-ai/sdk";
import warehouses from "../data/warehouses.json";
import { ExceptionRecord } from "../types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are the assistant layer of the Fulfillment
Exception Agent, a logistics operations system. You have access to the live
exception log this session (shipment events, the decisions made about them,
and estimated costs), plus the warehouse network map. Answer questions about
exceptions, decisions, costs, and warehouse status concisely and factually,
citing specific order IDs or warehouse names where relevant. If asked
something outside this scope, redirect politely to what you can help with.
Keep answers to 2-5 sentences unless the question genuinely requires more.`;

export async function answerQuestion(
  message: string,
  history: ChatMessage[],
  liveExceptions: ExceptionRecord[]
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return heuristicFallback(message, liveExceptions);
  }

  const contextBlock = buildContextBlock(liveExceptions);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: `${SYSTEM_PROMPT}\n\n${contextBlock}`,
      messages: [
        ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: message },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return (textBlock as any)?.text?.trim() ?? "I wasn't able to generate a response.";
  } catch (err) {
    console.error("Chat agent LLM call failed:", err);
    return heuristicFallback(message, liveExceptions);
  }
}

function buildContextBlock(liveExceptions: ExceptionRecord[]): string {
  const summary = liveExceptions.length
    ? liveExceptions
        .map(
          (r) =>
            `- [${r.event.orderId}] ${r.event.type} (${r.event.severity}), $${r.event.orderValue} order → decision: ${r.decision.action} (${r.decision.confidence} confidence, est. cost $${r.decision.estimatedCost})`
        )
        .join("\n")
    : "No exceptions have been processed yet in this session.";

  return `LIVE EXCEPTION LOG (this session):\n${summary}\n\nWAREHOUSE NETWORK:\n${JSON.stringify(
    warehouses,
    null,
    2
  )}`;
}

function heuristicFallback(message: string, liveExceptions: ExceptionRecord[]): string {
  const lower = message.toLowerCase();

  if (liveExceptions.length === 0) {
    return "No exceptions have been processed yet — fire an event from the Live Demo tab first, then ask me about it.";
  }

  if (lower.includes("how many") || lower.includes("count")) {
    return `${liveExceptions.length} exception(s) have been processed in this session so far.`;
  }

  if (lower.includes("cost") || lower.includes("refund")) {
    const totalCost = liveExceptions.reduce((sum, r) => sum + r.decision.estimatedCost, 0);
    return `Total estimated cost across all processed exceptions is $${totalCost.toFixed(2)}.`;
  }

  const matched = liveExceptions.find((r) => lower.includes(r.event.orderId.toLowerCase()));
  if (matched) {
    return `Order ${matched.event.orderId} (${matched.event.type}, ${matched.event.severity}) was decided as "${matched.decision.action}" with ${matched.decision.confidence} confidence. Reasoning: ${matched.decision.reasoning}`;
  }

  const latest = liveExceptions[liveExceptions.length - 1];
  return `Here's the most recent exception I have: order ${latest.event.orderId} (${latest.event.type}) → ${latest.decision.action}. (Note: connect an ANTHROPIC_API_KEY for full conversational reasoning over all exceptions.)`;
}
