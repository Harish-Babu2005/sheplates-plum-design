import type { SupabaseClient } from "@supabase/supabase-js";

export type MessageRole = "user" | "assistant" | "tool";

export type StoredAgentMessage = {
  id: string;
  conversation_id: string;
  actor_id: string;
  message_role: MessageRole;
  content: string;
  safe_context: Record<string, unknown>;
  created_at: string;
};

export type UiChatMessage = {
  role: "user" | "agent";
  text: string;
  productIds?: string[];
  streaming?: boolean;
  intent?: string;
  basketTotal?: number;
};

export async function getOrCreateConversation(
  client: SupabaseClient,
  actorId: string,
  actorRole: string,
  preferredConversationId?: string | null
): Promise<string | null> {
  try {
    if (preferredConversationId) {
      const { data: existing } = await client
        .from("agent_conversations")
        .select("id")
        .eq("id", preferredConversationId)
        .eq("actor_id", actorId)
        .maybeSingle();

      if (existing?.id) return existing.id;
    }

    // Look for an existing conversation from the last 24 hours for this actor
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await client
      .from("agent_conversations")
      .select("id")
      .eq("actor_id", actorId)
      .gte("updated_at", oneDayAgo)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.id) return recent.id;

    // Create a new conversation
    const { data: created, error } = await client
      .from("agent_conversations")
      .insert({
        actor_id: actorId,
        actor_role: actorRole,
        title: "She Agent conversation",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[ai-conversation] Error creating agent_conversation:", error.message);
      return null;
    }
    return created?.id || null;
  } catch (err) {
    console.warn("[ai-conversation] Exception in getOrCreateConversation:", err);
    return null;
  }
}

export async function saveAgentMessage(
  client: SupabaseClient,
  params: {
    conversationId: string;
    actorId: string;
    messageRole: MessageRole;
    content: string;
    safeContext?: Record<string, unknown>;
  }
): Promise<string | null> {
  try {
    const { conversationId, actorId, messageRole, content, safeContext = {} } = params;
    if (!conversationId || !actorId || !content) return null;

    const { data, error } = await client
      .from("agent_messages")
      .insert({
        conversation_id: conversationId,
        actor_id: actorId,
        message_role: messageRole,
        content: content.trim(),
        safe_context: safeContext,
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[ai-conversation] Error inserting into agent_messages:", error.message);
      return null;
    }

    // Touch the conversation updated_at
    await client
      .from("agent_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return data?.id || null;
  } catch (err) {
    console.warn("[ai-conversation] Exception in saveAgentMessage:", err);
    return null;
  }
}

export async function recordAiAction(
  client: SupabaseClient,
  params: {
    actorId?: string | null;
    agentType?: string;
    task: string;
    inputContext?: Record<string, unknown>;
    recommendation?: Record<string, unknown>;
    consequential?: boolean;
    approvalStatus?: string;
  }
): Promise<string | null> {
  try {
    const {
      actorId,
      agentType = "she_agent",
      task,
      inputContext = {},
      recommendation = {},
      consequential = false,
      approvalStatus = "not_required",
    } = params;

    const { data, error } = await client
      .from("ai_actions")
      .insert({
        ...(actorId ? { actor_id: actorId } : {}),
        agent_type: agentType,
        task,
        input_context: inputContext,
        recommendation,
        consequential,
        approval_status: approvalStatus,
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[ai-conversation] Error inserting into ai_actions:", error.message);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.warn("[ai-conversation] Exception in recordAiAction:", err);
    return null;
  }
}

export async function loadConversationHistory(
  client: SupabaseClient,
  actorId: string,
  preferredConversationId?: string | null
): Promise<{ conversationId: string | null; messages: UiChatMessage[] }> {
  try {
    let convId = preferredConversationId || null;

    if (!convId) {
      const { data: recent } = await client
        .from("agent_conversations")
        .select("id")
        .eq("actor_id", actorId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      convId = recent?.id || null;
    }

    if (!convId) return { conversationId: null, messages: [] };

    const { data: rows, error } = await client
      .from("agent_messages")
      .select("id, message_role, content, safe_context, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error || !rows) {
      return { conversationId: convId, messages: [] };
    }

    const messages: UiChatMessage[] = rows.map((row) => {
      const ctx = (row.safe_context || {}) as { productIds?: string[]; selectedProductIds?: string[]; intent?: string; basketTotal?: number };
      const productIds = ctx.productIds || ctx.selectedProductIds;
      return {
        role: row.message_role === "assistant" ? "agent" : "user",
        text: row.content,
        ...(Array.isArray(productIds) && productIds.length ? { productIds } : {}),
        ...(ctx.intent ? { intent: ctx.intent } : {}),
        ...(ctx.basketTotal !== undefined ? { basketTotal: ctx.basketTotal } : {}),
      };
    });

    return { conversationId: convId, messages };
  } catch (err) {
    console.warn("[ai-conversation] Exception in loadConversationHistory:", err);
    return { conversationId: null, messages: [] };
  }
}
