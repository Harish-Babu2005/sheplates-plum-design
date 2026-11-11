// Stand-in mock server for URUV AI service (/v1/chat/completions, /v1/images/generations, /v1/images/edits, /v1/moderations)
// For testing She Agent, Catalogue Import, Food Attributes, Product Images, and Image Enhancement without spending credits.
// Run: node scripts/mock-ai-server.mjs
// Or import { createMockAiServer } from "./scripts/mock-ai-server.mjs" in tests.

import http from "node:http";
import { pathToFileURL } from "node:url";

const defaultDelay = Number(process.env.MOCK_DELAY_MS || 10);
const rejectFast = process.env.MOCK_REJECT_FAST === "1";
export const log = [];

export const finalCommerce = (reply) => ({
  reply,
  intent: "answer",
  budget: -1,
  selectedProductIds: [],
  basketProductIds: [],
  removeProductIds: [],
  navigateTo: "",
  clarifyingQuestion: "",
  requiresPhoto: false,
  targetOrderId: "",
  createTicket: false,
  ticketSubject: "",
  ticketCategory: "Other",
  ticketPriority: "Normal",
  memoryUpdates: [],
});

export const simpleImageB64 = () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString("base64");

export const chatMessage = (content, model = "uruv-chat") => ({
  id: "chatcmpl_" + Math.random().toString(36).slice(2),
  object: "chat.completion",
  created: Math.floor(Date.now() / 1000),
  model,
  choices: [
    {
      index: 0,
      finish_reason: "stop",
      message: { role: "assistant", content: typeof content === "string" ? content : JSON.stringify(content) },
    },
  ],
  usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
});

export const toolMessage = (model = "uruv-chat") => ({
  id: "chatcmpl_" + Math.random().toString(36).slice(2),
  object: "chat.completion",
  created: Math.floor(Date.now() / 1000),
  model,
  choices: [
    {
      index: 0,
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "get_current_cart", arguments: "{}" },
          },
        ],
      },
    },
  ],
  usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
});

export const getLatestUserText = (body) => {
  if (!Array.isArray(body?.messages)) return "";
  const last = [...body.messages].filter((msg) => msg && msg.role === "user").at(-1);
  if (typeof last?.content === "string") return last.content;
  if (Array.isArray(last?.content)) {
    return last.content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join(" ");
  }
  return "";
};

export async function handleMockAiRequest(urlStr, init = {}) {
  const url = new URL(urlStr, "http://localhost");
  const headers = new Headers(init.headers || {});
  const method = (init.method || "GET").toUpperCase();

  const mockStatus = headers.get("x-mock-status") || url.searchParams.get("mock_status");
  if (mockStatus) {
    const status = Number(mockStatus);
    if (status === 429) {
      return new Response(JSON.stringify({ error: { code: "rate_limit_exceeded", message: "Rate limit reached. Please wait 1s." } }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "1" },
      });
    }
    if (status === 402) {
      return new Response(JSON.stringify({ error: { code: "insufficient_quota", message: "URUV AI credit balance exhausted." } }), {
        status: 402,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (status === 502 || status === 503) {
      return new Response(JSON.stringify({ error: { code: "bad_gateway", message: "Provider bad gateway." } }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (status === 413) {
      return new Response(JSON.stringify({ error: { code: "file_too_large", message: "Image exceeds 10 MB limit." } }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: { code: "simulated_error", message: `Simulated error ${status}` } }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (method === "POST" && url.pathname === "/v1/chat/completions") {
    let body = {};
    if (typeof init.body === "string") {
      try { body = JSON.parse(init.body); } catch {}
    }
    const text = getLatestUserText(body);
    const allText = JSON.stringify(body.messages || []);
    const model = body.model || "uruv-chat";
    const hasToolResults = body.messages?.some((msg) => msg && msg.role === "tool");
    log.push({ at: Date.now(), first: !hasToolResults, model, path: url.pathname });

    if (body.stream) {
      const useTool = !hasToolResults && /protein|basket|cart/i.test(text);
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const send = (evt) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
          if (useTool) {
            const tm = toolMessage(model);
            send({
              id: tm.id,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{ index: 0, delta: { role: "assistant", content: null, tool_calls: tm.choices[0].message.tool_calls }, finish_reason: null }],
            });
            send({
              id: tm.id,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
            });
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }
          const responseObj = finalCommerce(body.messages?.length ? "Your basket is empty. Want me to suggest something?" : "Hi! How can I help with your food shopping today?");
          const full = JSON.stringify(responseObj);
          for (let i = 0; i < full.length; i += 8) {
            const chunk = full.slice(i, i + 8);
            send({
              id: "chatcmpl_chunk",
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{ index: 0, delta: { role: "assistant", content: chunk }, finish_reason: null }],
            });
          }
          send({
            id: "chatcmpl_" + Math.random().toString(36).slice(2),
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
    }

    // Non-streaming
    if (/catalogue draft rows|catalogue_import|Convert a vendor product/i.test(allText)) {
      return new Response(JSON.stringify(chatMessage({
        items: [
          { name: "Dosa batter", category: "Breakfast", pack: "1 kg", price: 60, stock: 10 },
          { name: "Idli podi", category: "Pantry", pack: "200 g", price: 80, stock: 15 },
        ],
      }, model)), { headers: { "Content-Type": "application/json" } });
    }

    if (/weighted taste dimensions|food_attribute_classification|Classify each food product/i.test(allText)) {
      return new Response(JSON.stringify(chatMessage({
        items: [
          {
            productId: "p1",
            attributes: { sweet: 0.2, savory: 0.8, spicy: 0.3, sour: 0.1, bitter: 0, umami: 0.4, crispy: 0.5, soft: 0.5, creamy: 0.1, rich: 0.4 },
          },
        ],
      }, model)), { headers: { "Content-Type": "application/json" } });
    }

    const useTool = !hasToolResults && /protein|basket|cart/i.test(text);
    if (useTool) {
      return new Response(JSON.stringify(toolMessage(model)), { headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(chatMessage(finalCommerce(body.messages?.length ? "Your basket is empty. Want me to suggest something?" : "Hi! How can I help with your food shopping today?"), model)), { headers: { "Content-Type": "application/json" } });
  }

  if (method === "POST" && url.pathname === "/v1/images/generations") {
    return new Response(JSON.stringify({ created: Math.floor(Date.now() / 1000), data: [{ b64_json: simpleImageB64() }] }), { headers: { "Content-Type": "application/json" } });
  }

  if (method === "POST" && url.pathname === "/v1/images/edits") {
    return new Response(JSON.stringify({ created: Math.floor(Date.now() / 1000), data: [{ b64_json: simpleImageB64() }] }), { headers: { "Content-Type": "application/json" } });
  }

  if (method === "POST" && url.pathname === "/v1/moderations") {
    return new Response(JSON.stringify({
      id: "modr_" + Math.random().toString(36).slice(2),
      model: "uruv-moderate",
      results: [{ flagged: false, categories: { violence: false, hate: false }, category_scores: { violence: 0, hate: 0 } }],
    }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: { message: "Endpoint not found on mock AI server", code: "not_found" } }), { status: 404, headers: { "Content-Type": "application/json" } });
}

export function createMockAiServer(port = 9911, delay = defaultDelay) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    // Allow CORS for local dev/testing
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }

    // Inspect request log
    if (req.method === "GET" && url.pathname === "/log") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(log));
    }

    // Support simulated status codes via header or query
    const mockStatusHeader = req.headers["x-mock-status"];
    const mockStatusParam = url.searchParams.get("mock_status") || mockStatusHeader;
    if (mockStatusParam) {
      const statusCode = Number(mockStatusParam);
      res.statusCode = statusCode;
      res.setHeader("Content-Type", "application/json");
      if (statusCode === 429) {
        res.setHeader("Retry-After", "1");
        return res.end(JSON.stringify({ error: { code: "rate_limit_exceeded", message: "Rate limit reached. Please wait 1s." } }));
      }
      if (statusCode === 402) {
        return res.end(JSON.stringify({ error: { code: "insufficient_quota", message: "URUV AI credit balance exhausted." } }));
      }
      if (statusCode === 502 || statusCode === 503) {
        return res.end(JSON.stringify({ error: { code: "bad_gateway", message: "Provider bad gateway." } }));
      }
      if (statusCode === 413) {
        return res.end(JSON.stringify({ error: { code: "file_too_large", message: "Image exceeds 10 MB limit." } }));
      }
      return res.end(JSON.stringify({ error: { code: "simulated_error", message: `Simulated error ${statusCode}` } }));
    }

    // /v1/chat/completions
    if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        let body = {};
        try { body = JSON.parse(raw || "{}"); } catch { /* ignore */ }
        const text = getLatestUserText(body);
        const allText = JSON.stringify(body.messages || []);
        const model = body.model || "uruv-chat";
        const hasToolResults = body.messages?.some((msg) => msg && msg.role === "tool");
        log.push({ at: Date.now(), first: !hasToolResults, model, path: url.pathname });

        if (rejectFast && model && /low/i.test(model)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify({ error: { message: "This model does not accept the requested settings.", code: "unsupported_parameter" } }));
        }

        // 1. Streaming mode
        if (body.stream) {
          res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");

          const send = (evt) => res.write(`data: ${JSON.stringify(evt)}\n\n`);
          const useTool = !hasToolResults && /protein|basket|cart/i.test(text);

          setTimeout(() => {
            if (useTool) {
              const tm = toolMessage(model);
              send({
                id: tm.id,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [
                  {
                    index: 0,
                    delta: { role: "assistant", content: null, tool_calls: tm.choices[0].message.tool_calls },
                    finish_reason: null,
                  },
                ],
              });
              send({
                id: tm.id,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
              });
              res.write("data: [DONE]\n\n");
              return res.end();
            }

            const responseObj = finalCommerce(body.messages?.length ? "Your basket is empty. Want me to suggest something?" : "Hi! How can I help with your food shopping today?");
            const full = JSON.stringify(responseObj);
            let i = 0;
            const tick = () => {
              if (i >= full.length) {
                send({
                  id: "chatcmpl_" + Math.random().toString(36).slice(2),
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model,
                  choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
                });
                res.write("data: [DONE]\n\n");
                return res.end();
              }
              const chunk = full.slice(i, i + 8);
              send({
                id: "chatcmpl_chunk",
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{ index: 0, delta: { role: "assistant", content: chunk }, finish_reason: null }],
              });
              i += 8;
              setTimeout(tick, 20);
            };
            tick();
          }, delay);
          return;
        }

        // 2. Non-streaming JSON mode
        setTimeout(() => {
          res.setHeader("Content-Type", "application/json");

          // Check if catalogue import
          if (/catalogue draft rows|catalogue_import|Convert a vendor product/i.test(allText)) {
            return res.end(JSON.stringify(chatMessage({
              items: [
                { name: "Dosa batter", category: "Breakfast", pack: "1 kg", price: 60, stock: 10 },
                { name: "Idli podi", category: "Pantry", pack: "200 g", price: 80, stock: 15 },
              ],
            }, model)));
          }

          // Check if taste dimension / food attribute classification
          if (/weighted taste dimensions|food_attribute_classification|Classify each food product/i.test(allText)) {
            return res.end(JSON.stringify(chatMessage({
              items: [
                {
                  productId: "p1",
                  attributes: { sweet: 0.2, savory: 0.8, spicy: 0.3, sour: 0.1, bitter: 0, umami: 0.4, crispy: 0.5, soft: 0.5, creamy: 0.1, rich: 0.4 },
                },
              ],
            }, model)));
          }

          // Check if tool call requested
          const useTool = !hasToolResults && /protein|basket|cart/i.test(text);
          if (useTool) {
            return res.end(JSON.stringify(toolMessage(model)));
          }

          // Default commerce answer
          return res.end(JSON.stringify(chatMessage(finalCommerce(body.messages?.length ? "Your basket is empty. Want me to suggest something?" : "Hi! How can I help with your food shopping today?"), model)));
        }, delay);
      });
      return;
    }

    // /v1/images/generations
    if (req.method === "POST" && url.pathname === "/v1/images/generations") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ created: Math.floor(Date.now() / 1000), data: [{ b64_json: simpleImageB64() }] }));
    }

    // /v1/images/edits
    if (req.method === "POST" && url.pathname === "/v1/images/edits") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ created: Math.floor(Date.now() / 1000), data: [{ b64_json: simpleImageB64() }] }));
    }

    // /v1/moderations
    if (req.method === "POST" && url.pathname === "/v1/moderations") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({
        id: "modr_" + Math.random().toString(36).slice(2),
        model: "uruv-moderate",
        results: [{ flagged: false, categories: { violence: false, hate: false }, category_scores: { violence: 0, hate: 0 } }],
      }));
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: { message: "Endpoint not found on mock AI server", code: "not_found" } }));
  });

  return server;
}

const currentFileUrl = pathToFileURL(process.argv[1] || "").href;
if (import.meta.url === currentFileUrl) {
  const port = Number(process.env.MOCK_PORT || 9911);
  const server = createMockAiServer(port);
  server.listen(port, () => console.log(`mock AI service on :${port}, delay ${defaultDelay} ms`));
}
