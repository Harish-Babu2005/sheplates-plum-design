// A stand-in for the AI model service, for testing She Agent's plumbing without spending credits.
// Run:  node scripts/mock-ai-server.mjs   then start the app with  AI_API_BASE=http://localhost:9911/v1 URUV_API_KEY=test
// MOCK_DELAY_MS sets the simulated model time per call (default 700). MOCK_REJECT_FAST=1 makes it refuse the
// latency settings with a 400, like a model that does not support them.
import http from "node:http";
const delay = Number(process.env.MOCK_DELAY_MS || 700), reject = process.env.MOCK_REJECT_FAST === "1";
const log = [];
const final = (reply) => ({ reply, intent: "answer", budget: -1, selectedProductIds: [], basketProductIds: [], removeProductIds: [], navigateTo: "", clarifyingQuestion: "", requiresPhoto: false, targetOrderId: "", createTicket: false, ticketSubject: "", ticketCategory: "Other", ticketPriority: "Normal", memoryUpdates: [] });
const chatMessage = (obj) => ({ id: "chatcmpl_" + Math.random().toString(36).slice(2), choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(obj) } }] });
const toolMessage = () => ({ id: "chatcmpl_" + Math.random().toString(36).slice(2), choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: "call_1", type: "function", function: { name: "get_current_cart", arguments: "{}" } }] } }] });
const getLatestUserText = (body) => {
  if (!Array.isArray(body.messages)) return "";
  const last = [...body.messages].filter((msg) => msg && msg.role === "user").at(-1);
  return typeof last?.content === "string" ? last.content : Array.isArray(last?.content) ? last.content.map((part) => typeof part?.text === "string" ? part.text : "").join(" ") : "";
};
const simpleImageB64 = () => Buffer.from("fake-image-data").toString("base64");
http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname === "/log") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(log)); }
  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    let raw = ""; req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}");
      const text = getLatestUserText(body);
      log.push({ at: Date.now(), first: !body.messages?.some((msg) => msg && msg.role === "tool"), model: body.model });
      if (reject && body.model && /low/i.test(body.model)) { res.statusCode = 400; res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ error: { message: "This model does not accept the requested settings.", code: "unsupported_parameter" } })); }
      if (body.stream) {
        res.setHeader("content-type", "text/event-stream");
        const useTool = !body.messages?.some((msg) => msg && msg.role === "tool") && /protein|basket|cart/i.test(text);
        const finished = useTool ? toolMessage() : chatMessage(final(body.messages?.length ? "Your basket is empty. Want me to suggest something?" : "Hi! How can I help with your food shopping today?"));
        const send = (evt) => res.write(`data: ${JSON.stringify(evt)}\n\n`);
        const first = Number(process.env.MOCK_FIRST_TOKEN_MS || 300);
        setTimeout(() => {
          if (useTool) {
            send({ id: finished.id, choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", tool_calls: finished.choices[0].message.tool_calls } }] });
            return res.end();
          }
          const full = finished.choices[0].message.content; let i = 0;
          const tick = () => { if (i >= full.length) { send({ id: finished.id, choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "" } }] }); return res.end(); } send({ id: finished.id, choices: [{ index: 0, delta: { role: "assistant", content: full.slice(i, i + 6) } }] }); i += 6; setTimeout(tick, 25); };
          tick();
        }, first);
        return;
      }
      setTimeout(() => {
        res.setHeader("content-type", "application/json");
        const useTool = !body.messages?.some((msg) => msg && msg.role === "tool") && /protein|basket|cart/i.test(text);
        if (useTool) return res.end(JSON.stringify(toolMessage()));
        res.end(JSON.stringify(chatMessage(final(body.messages?.length ? "Your basket is empty. Want me to suggest something?" : "Hi! How can I help with your food shopping today?"))));
      }, delay);
    });
    return;
  }
  if (req.method === "POST" && url.pathname === "/v1/images/generations") {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ data: [{ b64_json: simpleImageB64() }] }));
  }
  if (req.method === "POST" && url.pathname === "/v1/images/edits") {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ data: [{ b64_json: simpleImageB64() }] }));
  }
  if (req.method === "POST" && url.pathname === "/v1/moderations") {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ results: [{ flagged: false }] }));
  }
  res.statusCode = 404; res.end(JSON.stringify({ error: { message: "Not found", code: "not_found" } }));
}).listen(9911, () => console.log("mock AI service on :9911, delay", delay, "ms"));
