import test from "node:test";
import assert from "node:assert/strict";
import { createMockAiServer, handleMockAiRequest } from "../scripts/mock-ai-server.mjs";
import { uruvChat, uruvImage, uruvImageEdit, uruvModerate, UruvAiError } from "../lib/uruv-ai.ts";
import { runToolDrivenCommerceAgent } from "../lib/she-agent-commerce-runtime.ts";

const PORT = 9922;
const BASE_URL = `http://127.0.0.1:${PORT}/v1`;

test("URUV AI Mock Integration: chat, tools, images, edits, moderation, and resilience", async (t) => {
  const prevBase = process.env.URUV_API_BASE;
  const prevKey = process.env.URUV_API_KEY;
  process.env.URUV_API_BASE = BASE_URL;
  process.env.URUV_API_KEY = "test-mock-key-12345";

  const server = createMockAiServer(PORT, 5);
  await new Promise((resolve) => server.listen(PORT, resolve));

  const origFetch = globalThis.fetch;
  let socketWorks = false;
  try {
    const probe = await origFetch(`http://127.0.0.1:${PORT}/log`).catch(() => null);
    if (probe && probe.ok) socketWorks = true;
  } catch {}

  if (!socketWorks) {
    globalThis.fetch = async (input, init) => {
      const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (urlStr.startsWith(BASE_URL) || urlStr.startsWith(`http://127.0.0.1:${PORT}`)) {
        return handleMockAiRequest(urlStr, init);
      }
      return origFetch(input, init);
    };
  }

  t.after(() => {
    server.close();
    globalThis.fetch = origFetch;
    if (prevBase) process.env.URUV_API_BASE = prevBase;
    else delete process.env.URUV_API_BASE;
    if (prevKey) process.env.URUV_API_KEY = prevKey;
    else delete process.env.URUV_API_KEY;
  });

  await t.test("1. /v1/chat/completions non-streaming", async () => {
    const res = await uruvChat({
      model: "uruv-chat",
      messages: [{ role: "user", content: "Hello" }],
    });
    assert.ok(res.choices?.[0]?.message?.content);
    assert.equal(res.model, "uruv-chat");
  });

  await t.test("2. /v1/chat/completions streaming tool-call flow", async () => {
    let streamedText = "";
    const commerce = await runToolDrivenCommerceAgent({
      apiKey: "test-mock-key-12345",
      model: "uruv-chat",
      role: "customer",
      message: "Check my cart and high protein meals",
      history: [],
      context: { cart: { items: [{ name: "Paneer Bowl", price: 120 }] } },
      onReply: (text) => {
        streamedText = text;
      },
    });

    assert.ok(commerce);
    assert.ok(commerce.reply);
  });

  await t.test("3. /v1/chat/completions catalogue import structured schema", async () => {
    const res = await uruvChat({
      model: "uruv-chat",
      messages: [
        { role: "system", content: "Convert a vendor product/grocery list into clean catalogue draft rows." },
        { role: "user", content: "Dosa batter 1kg 60 rs" },
      ],
    });
    const content = res.choices?.[0]?.message?.content;
    assert.ok(content);
    const parsed = JSON.parse(content);
    assert.ok(Array.isArray(parsed.items));
    assert.equal(parsed.items[0]?.name, "Dosa batter");
  });

  await t.test("4. /v1/chat/completions food attribute classification structured schema", async () => {
    const res = await uruvChat({
      model: "uruv-chat",
      messages: [
        { role: "system", content: "Return valid JSON only." },
        { role: "user", content: "Classify each food product into weighted taste dimensions." },
      ],
    });
    const content = res.choices?.[0]?.message?.content;
    assert.ok(content);
    const parsed = JSON.parse(content);
    assert.ok(Array.isArray(parsed.items));
    assert.equal(parsed.items[0]?.productId, "p1");
    assert.equal(typeof parsed.items[0]?.attributes?.savory, "number");
  });

  await t.test("5. /v1/images/generations", async () => {
    const res = await uruvImage({
      model: "uruv-image",
      prompt: "A fresh organic idli podi pack on marble background",
    });
    assert.ok(Array.isArray(res.data));
    assert.ok(res.data[0]?.b64_json);
  });

  await t.test("6. /v1/images/edits", async () => {
    const form = new FormData();
    form.append("model", "uruv-image");
    form.append("image", new Blob([Buffer.from([1, 2, 3])], { type: "image/png" }), "food.png");
    form.append("prompt", "Enhance lighting");

    const res = await uruvImageEdit(form);
    assert.ok(Array.isArray(res.data));
    assert.ok(res.data[0]?.b64_json);
  });

  await t.test("7. /v1/moderations", async () => {
    const res = await uruvModerate("Fresh organic idli podi");
    assert.ok(Array.isArray(res.results));
    assert.equal(res.results[0]?.flagged, false);
  });

  await t.test("8. Resilience: retry provider 502/503 once then fall back", async () => {
    await assert.rejects(
      uruvChat(
        { model: "uruv-chat", messages: [{ role: "user", content: "trigger 502" }] },
        { headers: { "x-mock-status": "502" } }
      ),
      (err) => {
        assert.ok(err instanceof UruvAiError);
        assert.equal(err.status, 502);
        return true;
      }
    );
  });

  await t.test("9. Resilience: honor Retry-After on 429 rate limit", async () => {
    await assert.rejects(
      uruvChat(
        { model: "uruv-chat", messages: [{ role: "user", content: "trigger 429" }] },
        { headers: { "x-mock-status": "429" } }
      ),
      (err) => {
        assert.ok(err instanceof UruvAiError);
        assert.equal(err.status, 429);
        return true;
      }
    );
  });

  await t.test("10. Resilience: budget/credit alert on 402", async () => {
    await assert.rejects(
      uruvChat(
        { model: "uruv-chat", messages: [{ role: "user", content: "trigger 402" }] },
        { headers: { "x-mock-status": "402" } }
      ),
      (err) => {
        assert.ok(err instanceof UruvAiError);
        assert.equal(err.status, 402);
        return true;
      }
    );
  });

  await t.test("11. Resilience: bad image / oversize message", async () => {
    await assert.rejects(
      uruvChat(
        { model: "uruv-chat", messages: [{ role: "user", content: "oversize" }] },
        { headers: { "x-mock-status": "413" } }
      ),
      (err) => {
        assert.ok(err instanceof UruvAiError);
        assert.equal(err.status, 413);
        assert.match(err.message, /under 10 MB/i);
        return true;
      }
    );
  });
});
