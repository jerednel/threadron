#!/usr/bin/env node
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const API_URL = process.env.THREADRON_API_URL || "https://threadron.com";
const MCP_URL = process.env.THREADRON_MCP_URL || `${API_URL}/mcp`;
const RUN_ID = process.env.THREADRON_EVAL_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
const RUN_LIVE_AGENTS = process.argv.includes("--live-agents") || process.env.THREADRON_EVAL_LIVE_AGENTS === "1";
const KEEP_ARTIFACTS = process.argv.includes("--keep-artifacts") || process.env.THREADRON_EVAL_KEEP_ARTIFACTS === "1";
const AGENT_FILTER = readArg("--agent") || process.env.THREADRON_EVAL_AGENT || "";

const REQUIRED_TOOLS = [
  "threadron_checkin",
  "threadron_list_threads",
  "threadron_get_thread",
  "threadron_resume",
  "threadron_create_thread",
  "threadron_update_thread",
  "threadron_create_task",
  "threadron_update_state",
  "threadron_capture_inbox",
  "threadron_list_inbox",
];

const AGENTS = [
  {
    id: "hermes",
    label: "Hermes",
    key: readHermesKey(),
    configPath: path.join(os.homedir(), ".hermes/config.yaml"),
    live: runHermesPrompt,
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    key: readOpenClawKey(),
    configPath: path.join(os.homedir(), ".openclaw/openclaw.json"),
    live: runOpenClawPrompt,
  },
];

const results = [];
const cleanupThreads = [];
const cleanupInbox = [];

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  if (!KEEP_ARTIFACTS) {
    await cleanupStaleEvalInbox();
  }

  for (const agent of selectedAgents()) {
    await runCase(agent, "config", () => assertConfig(agent));
    await runCase(agent, "transport.tools_list", () => assertTools(agent));
    await runCase(agent, "session.checkin_reads_state", () => checkinReadsSharedState(agent));
    await runCase(agent, "explicit.thread_roundtrip", () => explicitThreadRoundTrip(agent));
    await runCase(agent, "implicit.capture_inbox", () => implicitInboxCapture(agent));

    if (RUN_LIVE_AGENTS) {
      await runCase(agent, "live.explicit_prompt", () => liveExplicitPrompt(agent));
      await runCase(agent, "live.implicit_prompt", () => liveImplicitPrompt(agent));
    } else {
      results.push({
        agent: agent.id,
        case: "live.prompts",
        status: "skipped",
        detail: "Pass --live-agents to run model-dependent Hermes/OpenClaw prompt evals.",
      });
    }

    if (!KEEP_ARTIFACTS) {
      await cleanup();
      cleanupThreads.length = 0;
      cleanupInbox.length = 0;
    }
  }

  if (!KEEP_ARTIFACTS) {
    await cleanup();
  }

  printReport();

  const failures = results.filter((result) => result.status === "fail");
  if (failures.length > 0) process.exit(1);
}

async function runCase(agent, name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({
      agent: agent.id,
      case: name,
      status: "pass",
      duration_ms: Date.now() - started,
      detail,
    });
  } catch (err) {
    results.push({
      agent: agent.id,
      case: name,
      status: "fail",
      duration_ms: Date.now() - started,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

function assertConfig(agent) {
  if (!agent.key) {
    throw new Error(`Missing ${agent.label} Threadron key in ${agent.configPath}`);
  }
  return `${agent.configPath} has hosted Threadron key for ${agent.id}`;
}

async function assertTools(agent) {
  const response = await mcp(agent, "tools/list", {});
  const tools = response.result?.tools || [];
  const names = tools.map((tool) => tool.name);
  const missing = REQUIRED_TOOLS.filter((tool) => !names.includes(tool));
  if (missing.length > 0) {
    throw new Error(`Missing tools: ${missing.join(", ")}`);
  }
  return `${names.length} tools discovered`;
}

async function explicitThreadRoundTrip(agent) {
  const marker = markerFor(agent, "explicit");
  const created = await callTool(agent, "threadron_create_thread", {
    name: `Threadron eval explicit ${agent.id} ${RUN_ID}`,
    source: marker,
    current_state: `Explicit eval created by ${agent.id}.`,
    next_action: "Read the thread and archive it.",
    outcome_definition: "The agent can explicitly write, update, and read shared state.",
    confidence: "high",
  });

  const threadId = pickId(created);
  if (!threadId) throw new Error(`Could not find created thread id in ${JSON.stringify(created)}`);
  cleanupThreads.push({ agent, threadId });

  await callTool(agent, "threadron_update_thread", {
    thread_id: threadId,
    current_state: `Explicit eval updated by ${agent.id}.`,
    next_action: "Archive during cleanup.",
    blockers: [],
    confidence: "high",
  });

  const read = await callTool(agent, "threadron_get_thread", { thread_id: threadId });
  const thread = read.thread || read;
  if (thread.id !== threadId) throw new Error(`Read wrong thread id: ${thread.id}`);
  if (!String(thread.current_state || "").includes(agent.id)) {
    throw new Error(`Thread current_state did not include agent id: ${thread.current_state}`);
  }

  return `thread_id=${threadId}`;
}

async function implicitInboxCapture(agent) {
  const marker = markerFor(agent, "implicit");
  const rawText = [
    `Threadron eval implicit ${agent.id} ${RUN_ID}.`,
    "The user did not say 'call threadron_capture_inbox'; they just mentioned a loose follow-up that should be remembered.",
    `marker=${marker}`,
  ].join(" ");

  const captured = await callTool(agent, "threadron_capture_inbox", { raw_text: rawText });
  const item = captured.item || captured;
  const itemId = item.id;
  if (!itemId) throw new Error(`Could not find captured inbox id in ${JSON.stringify(captured)}`);
  cleanupInbox.push({ agent, itemId });

  const listed = await callTool(agent, "threadron_list_inbox", { status: "unprocessed" });
  const items = Array.isArray(listed) ? listed : listed.items || [];
  const found = items.find((candidate) => candidate.id === itemId || String(candidate.raw_text || "").includes(marker));
  if (!found) throw new Error(`Captured inbox item ${itemId} was not visible in unprocessed inbox`);

  return `inbox_id=${itemId}`;
}

async function checkinReadsSharedState(agent) {
  const checkin = await callTool(agent, "threadron_checkin", {});
  if (!checkin.summary) {
    throw new Error(`Check-in response had no summary: ${JSON.stringify(checkin)}`);
  }
  if (!Array.isArray(checkin.active_threads)) {
    throw new Error("Check-in response did not include active_threads array");
  }
  if (!Array.isArray(checkin.unprocessed_inbox)) {
    throw new Error("Check-in response did not include unprocessed_inbox array");
  }
  return checkin.summary;
}

async function liveExplicitPrompt(agent) {
  const marker = markerFor(agent, "live-explicit");
  const prompt = [
    "This is a Threadron eval.",
    `Agent id: ${agent.id}. Marker: ${marker}.`,
    "Explicit task: use Threadron shared state to create a durable thread with this marker, then reply with the thread id only.",
  ].join("\n");

  const output = await agent.live(prompt, `threadron-eval-explicit-${agent.id}-${RUN_ID}`);
  try {
    await assertMarkerReachedThreadron(agent, marker);
  } catch (err) {
    throw new Error(`${err instanceof Error ? err.message : String(err)}; agent_output=${compactOutput(output)}`);
  }
  return compactOutput(output);
}

async function liveImplicitPrompt(agent) {
  const marker = markerFor(agent, "live-implicit");
  const prompt = [
    "This is a Threadron eval.",
    `Agent id: ${agent.id}. Marker: ${marker}.`,
    "Implicit task: remember that the next agent should inspect the onboarding flow and continue from this marker.",
    "Do the natural shared-state thing for a cross-agent handoff, then reply in one sentence.",
  ].join("\n");

  const output = await agent.live(prompt, `threadron-eval-implicit-${agent.id}-${RUN_ID}`);
  try {
    await assertMarkerReachedThreadron(agent, marker);
  } catch (err) {
    throw new Error(`${err instanceof Error ? err.message : String(err)}; agent_output=${compactOutput(output)}`);
  }
  return compactOutput(output);
}

async function assertMarkerReachedThreadron(agent, marker) {
  const threads = await callTool(agent, "threadron_list_threads", { search: marker });
  const inbox = await callTool(agent, "threadron_list_inbox", { status: "unprocessed" });
  const serialized = JSON.stringify({ threads, inbox });
  if (!serialized.includes(marker)) {
    throw new Error(`Live prompt did not write marker ${marker} to Threadron`);
  }
}

async function cleanup() {
  for (const { agent, threadId } of cleanupThreads) {
    await callTool(agent, "threadron_update_thread", {
      thread_id: threadId,
      status: "archived",
      current_state: "Eval cleanup complete; archived.",
      next_action: "None.",
      blockers: [],
      confidence: "high",
    }).catch((err) => {
      results.push({
        agent: agent.id,
        case: `cleanup.archive.${threadId}`,
        status: "fail",
        detail: err instanceof Error ? err.message : String(err),
      });
    });
  }

  for (const { agent, itemId } of cleanupInbox) {
    await rest(agent, `/v1/inbox/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "rejected",
        error: "Threadron eval cleanup complete.",
      }),
    }).catch((err) => {
      results.push({
        agent: agent.id,
        case: `cleanup.reject_inbox.${itemId}`,
        status: "fail",
        detail: err instanceof Error ? err.message : String(err),
      });
    });
  }
}

async function cleanupStaleEvalInbox() {
  for (const agent of AGENTS) {
    if (!agent.key) continue;
    const listed = await rest(agent, "/v1/inbox?status=unprocessed").catch(() => ({ items: [] }));
    const items = Array.isArray(listed.items) ? listed.items : [];
    for (const item of items) {
      if (!String(item.raw_text || "").includes("Threadron eval")) continue;
      await rest(agent, `/v1/inbox/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "rejected",
          error: "Threadron eval stale cleanup.",
        }),
      }).catch(() => {});
    }
  }
}

async function mcp(agent, method, params) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${agent.key}`,
      "X-Agent-Id": agent.id,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params,
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`MCP HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  return parseMcpResponse(body);
}

async function callTool(agent, name, args) {
  const response = await mcp(agent, "tools/call", {
    name,
    arguments: args,
  });

  if (response.error) throw new Error(JSON.stringify(response.error));
  if (response.result?.isError) {
    const text = response.result.content?.map((entry) => entry.text).join("\n") || "Unknown MCP tool error";
    throw new Error(text);
  }

  const text = response.result?.content?.[0]?.text;
  if (!text) return response.result;
  return JSON.parse(text);
}

async function rest(agent, pathName, options = {}) {
  const response = await fetch(`${API_URL}${pathName}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${agent.key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`REST HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  return body ? JSON.parse(body) : null;
}

function parseMcpResponse(body) {
  const dataLine = body
    .split(/\r?\n/)
    .find((line) => line.startsWith("data: "));
  const jsonText = dataLine ? dataLine.slice("data: ".length) : body;
  return JSON.parse(jsonText);
}

function readHermesKey() {
  const configPath = path.join(os.homedir(), ".hermes/config.yaml");
  if (!fs.existsSync(configPath)) return "";
  const config = fs.readFileSync(configPath, "utf8");
  const threadronBlock = config.match(/(^|\n)\s{2}threadron:\n[\s\S]*?(?=\n\S|\n\s{2}\S|$)/);
  const source = threadronBlock?.[0] || config;
  const match = source.match(/Authorization:\s*["']?Bearer\s+([^"'\n]+)["']?/);
  return match?.[1]?.trim() || "";
}

function readOpenClawKey() {
  const configPath = path.join(os.homedir(), ".openclaw/openclaw.json");
  if (!fs.existsSync(configPath)) return "";
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const authorization = config.mcp?.servers?.threadron?.headers?.Authorization || "";
  return String(authorization).replace(/^Bearer\s+/i, "").trim();
}

function selectedAgents() {
  if (!AGENT_FILTER) return AGENTS;
  const selected = AGENTS.filter((agent) => agent.id === AGENT_FILTER);
  if (selected.length === 0) {
    throw new Error(`Unknown --agent ${AGENT_FILTER}; expected one of ${AGENTS.map((agent) => agent.id).join(", ")}`);
  }
  return selected;
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

async function runHermesPrompt(prompt, sessionKey) {
  const { stdout, stderr } = await execFileAsync("hermes", ["--oneshot", prompt, "--yolo"], {
    cwd: process.cwd(),
    timeout: 180_000,
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      HERMES_ACCEPT_HOOKS: "1",
      THREADRON_EVAL_SESSION: sessionKey,
    },
  });
  return [stdout, stderr].filter(Boolean).join("\n");
}

async function runOpenClawPrompt(prompt, sessionKey) {
  const { stdout, stderr } = await execFileAsync(
    "openclaw",
    [
      "agent",
      "--agent",
      "main",
      "--message",
      prompt,
      "--session-key",
      `agent:main:${sessionKey}`,
      "--json",
      "--timeout",
      "180",
    ],
    {
      cwd: process.cwd(),
      timeout: 210_000,
      maxBuffer: 1024 * 1024,
      env: process.env,
    }
  );
  return [stdout, stderr].filter(Boolean).join("\n");
}

function markerFor(agent, kind) {
  return `eval/${RUN_ID}/${agent.id}/${kind}`;
}

function pickId(payload) {
  return payload.id || payload.thread?.id || payload.task?.thread_id || payload.thread_id;
}

function compactOutput(output) {
  return output.replace(/\s+/g, " ").trim().slice(0, 300);
}

function printReport() {
  const statusIcon = {
    pass: "PASS",
    fail: "FAIL",
    skipped: "SKIP",
  };

  console.log(`\nThreadron agent-state evals (${RUN_ID})`);
  console.log(`MCP: ${MCP_URL}`);
  console.log(`Live agent prompts: ${RUN_LIVE_AGENTS ? "on" : "off"}\n`);

  for (const result of results) {
    const duration = result.duration_ms === undefined ? "" : ` ${result.duration_ms}ms`;
    console.log(`${statusIcon[result.status]} ${result.agent} ${result.case}${duration}`);
    if (result.detail) console.log(`  ${result.detail}`);
  }
}
