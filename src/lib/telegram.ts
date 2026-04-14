const TELEGRAM_API = "https://api.telegram.org";

export interface TelegramResult {
  ok: boolean;
  description?: string;
}

export async function validateToken(token: string): Promise<{ ok: boolean; botName?: string; error?: string }> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok) {
      return { ok: true, botName: data.result?.username };
    }
    return { ok: false, error: data.description || "Invalid token" };
  } catch {
    return { ok: false, error: "Could not reach Telegram API" };
  }
}

export async function sendMessage(token: string, chatId: string, text: string): Promise<TelegramResult> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
    const data = await res.json();
    return { ok: data.ok, description: data.description };
  } catch {
    return { ok: false, description: "Failed to send message" };
  }
}

export function formatTaskPush(task: {
  id: string;
  title: string;
  goal?: string | null;
  current_state?: string | null;
  next_action?: string | null;
  blockers?: string[];
  outcome_definition?: string | null;
  priority?: string;
  assignee?: string | null;
}, agentName?: string): string {
  const lines: string[] = [];

  lines.push("📋 *TASK DISPATCH — Unmonitored Push*");
  lines.push("");
  lines.push(`*${escMd(task.title)}*`);
  if (task.priority) lines.push(`Priority: ${task.priority}`);
  lines.push("");

  if (task.goal) {
    lines.push(`*Goal:* ${escMd(task.goal)}`);
  }
  if (task.next_action) {
    lines.push(`*Next Action:* ${escMd(task.next_action)}`);
  }
  if (task.current_state) {
    lines.push(`*Current State:* ${escMd(task.current_state)}`);
  }
  if (task.outcome_definition) {
    lines.push(`*Done When:* ${escMd(task.outcome_definition)}`);
  }
  if (task.blockers && task.blockers.length > 0) {
    lines.push(`*Blockers:* ${task.blockers.map(b => escMd(b)).join(", ")}`);
  }

  lines.push("");
  lines.push("⚠️ *This is a one-way dispatch.* No response is expected on this channel.");
  lines.push("");
  lines.push("• Update progress via Threadron (MCP or API)");
  lines.push("• Use `threadron_update_state` for status changes");
  lines.push("• Use `threadron_add_context` for decisions and observations");
  lines.push("• Direct questions to the user via their primary channel");
  lines.push("");
  lines.push(`Task ID: \`${task.id}\``);
  if (agentName) lines.push(`Dispatched to: ${escMd(agentName)}`);
  lines.push("MCP: threadron.com/mcp");

  return lines.join("\n");
}

function escMd(text: string): string {
  return text.replace(/([_*`\[])/g, "\\$1");
}
