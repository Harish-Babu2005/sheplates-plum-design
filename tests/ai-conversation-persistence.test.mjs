import test from "node:test";
import assert from "node:assert/strict";
import {
  getOrCreateConversation,
  saveAgentMessage,
  recordAiAction,
  loadConversationHistory,
} from "../lib/ai-conversation-server.ts";

test("AI conversation and action persistence to database tables", async (t) => {
  // In-memory mock database representing agent_conversations, agent_messages, and ai_actions
  const db = {
    agent_conversations: [],
    agent_messages: [],
    ai_actions: [],
  };

  const createMockSupabase = () => ({
    from(tableName) {
      if (tableName === "agent_conversations") {
        return {
          select(fields) {
            return {
              eq(col, val) {
                return {
                  eq(col2, val2) {
                    return {
                      async maybeSingle() {
                        const row = db.agent_conversations.find((r) => r[col] === val && r[col2] === val2);
                        return { data: row || null, error: null };
                      },
                    };
                  },
                  gte(dateCol, dateVal) {
                    return {
                      order() {
                        return {
                          limit() {
                            return {
                              async maybeSingle() {
                                const row = db.agent_conversations.find((r) => r[col] === val && r[dateCol] >= dateVal);
                                return { data: row || null, error: null };
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                  order() {
                    return {
                      limit() {
                        return {
                          async maybeSingle() {
                            const row = db.agent_conversations.find((r) => r[col] === val);
                            return { data: row || null, error: null };
                          },
                        };
                      },
                    };
                  },
                  async maybeSingle() {
                    const row = db.agent_conversations.find((r) => r[col] === val);
                    return { data: row || null, error: null };
                  },
                };
              },
            };
          },
          insert(values) {
            return {
              select() {
                return {
                  async single() {
                    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                    const row = { id, ...values, created_at: new Date().toISOString() };
                    db.agent_conversations.push(row);
                    return { data: row, error: null };
                  },
                };
              },
            };
          },
          update(patch) {
            return {
              eq(col, val) {
                const target = db.agent_conversations.find((r) => r[col] === val);
                if (target) Object.assign(target, patch);
                return Promise.resolve({ data: target, error: null });
              },
            };
          },
        };
      }

      if (tableName === "agent_messages") {
        return {
          insert(values) {
            return {
              select() {
                return {
                  async single() {
                    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                    const row = { id, ...values, created_at: new Date().toISOString() };
                    db.agent_messages.push(row);
                    return { data: row, error: null };
                  },
                };
              },
            };
          },
          select(fields) {
            return {
              eq(col, val) {
                return {
                  order() {
                    return {
                      limit(n) {
                        const rows = db.agent_messages.filter((r) => r[col] === val).slice(0, n);
                        return Promise.resolve({ data: rows, error: null });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (tableName === "ai_actions") {
        return {
          insert(values) {
            return {
              select() {
                return {
                  async single() {
                    const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                    const row = { id, ...values, created_at: new Date().toISOString() };
                    db.ai_actions.push(row);
                    return { data: row, error: null };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${tableName}`);
    },
  });

  const mockClient = createMockSupabase();

  await t.test("1. getOrCreateConversation creates a conversation and reuses it", async () => {
    const actorId = "user-uuid-123";
    const convId1 = await getOrCreateConversation(mockClient, actorId, "customer");
    assert.ok(convId1, "Should create a valid conversation ID");
    assert.equal(db.agent_conversations.length, 1);
    assert.equal(db.agent_conversations[0].actor_id, actorId);
    assert.equal(db.agent_conversations[0].actor_role, "customer");

    // Reusing the same preferred ID
    const convId2 = await getOrCreateConversation(mockClient, actorId, "customer", convId1);
    assert.equal(convId2, convId1, "Should reuse the specified conversation ID");
    assert.equal(db.agent_conversations.length, 1, "Should not create duplicate conversation");
  });

  await t.test("2. saveAgentMessage records user and assistant turns into agent_messages", async () => {
    const convId = db.agent_conversations[0].id;
    const actorId = "user-uuid-123";

    const userMsgId = await saveAgentMessage(mockClient, {
      conversationId: convId,
      actorId,
      messageRole: "user",
      content: "Can you recommend high protein dinners?",
      safeContext: { role: "customer" },
    });
    assert.ok(userMsgId, "Should return an inserted message ID");

    const agentMsgId = await saveAgentMessage(mockClient, {
      conversationId: convId,
      actorId,
      messageRole: "assistant",
      content: "I recommend our grilled paneer platter with 24g protein.",
      safeContext: { productIds: ["PRD-001"] },
    });
    assert.ok(agentMsgId, "Should return an inserted message ID");

    assert.equal(db.agent_messages.length, 2);
    assert.equal(db.agent_messages[0].message_role, "user");
    assert.equal(db.agent_messages[1].message_role, "assistant");
  });

  await t.test("3. recordAiAction logs agent decisions to ai_actions table", async () => {
    const actorId = "user-uuid-123";
    const actionId = await recordAiAction(mockClient, {
      actorId,
      agentType: "she_agent",
      task: "commerce",
      inputContext: { message: "recommend dinners" },
      recommendation: { intent: "recommend", selectedProductIds: ["PRD-001"] },
      consequential: false,
      approvalStatus: "not_required",
    });

    assert.ok(actionId, "Should record an ai_action row");
    assert.equal(db.ai_actions.length, 1);
    assert.equal(db.ai_actions[0].task, "commerce");
    assert.equal(db.ai_actions[0].agent_type, "she_agent");
    assert.equal(db.ai_actions[0].consequential, false);
  });

  await t.test("4. loadConversationHistory returns chronological messages with productIds", async () => {
    const convId = db.agent_conversations[0].id;
    const actorId = "user-uuid-123";

    const history = await loadConversationHistory(mockClient, actorId, convId);
    assert.equal(history.conversationId, convId);
    assert.equal(history.messages.length, 2);
    assert.equal(history.messages[0].role, "user");
    assert.equal(history.messages[0].text, "Can you recommend high protein dinners?");
    assert.equal(history.messages[1].role, "agent");
    assert.deepEqual(history.messages[1].productIds, ["PRD-001"]);
  });
});
