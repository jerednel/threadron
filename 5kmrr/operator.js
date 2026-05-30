const storageKey = "agentops-fieldkit-prospects";
const form = document.querySelector("#prospect-form");
const pipeline = document.querySelector("#pipeline");
const count = document.querySelector("#count");
const dmButton = document.querySelector("#copy-dm");
const exportButton = document.querySelector("#export-json");
const clearDoneButton = document.querySelector("#clear-done");
const loadSeedsButton = document.querySelector("#load-seeds");

const statuses = ["New", "Replied", "DM sent", "Call booked", "Audit", "Sprint", "Retainer", "Lost"];
const seedProspects = [
  {
    name: "Degen Sing / OpenClaw orchestration thread",
    url: "https://x.com/degensing/status/2026578817016566047",
    signal: "Agent branches or worktrees",
    note: "Public thread describes isolated worktrees, task registry, multi-agent orchestration, reviewer weakness, and security surface. Good reply angle: receipts and review gates are the missing operating layer.",
  },
  {
    name: "tetsuo / AgenC runtime traces",
    url: "https://x.com/tetsuoai/status/2032031965575332172",
    signal: "Local agents or internal wrappers",
    note: "Public launch thread argues agent behavior improvements need runtime traces and prompt/tool routing patterns. Good reply angle: run ledgers need a human-buyable workflow and stop conditions, not only traces.",
  },
  {
    name: "Matthew Cassinelli / Codex Cursor Claude sync blocker",
    url: "https://x.com/mattcassinelli/status/2039865090988806215",
    signal: "Using Cursor/Codex/Claude Code",
    note: "Public post names lack of sync across Codex, Cursor, and Claude Code as the blocker. Good reply angle: shared state plus handoff receipts solves the research/work continuity version.",
  },
  {
    name: "am.will / c-CRAB AI review benchmark thread",
    url: "https://x.com/LLMJunky/status/2036675950553804818",
    signal: "AI PR review pain",
    note: "Public thread says AI review tools catch fewer human-identified issues and create too many comments. Good reply angle: review needs cited claims, failing cases, and a receipt humans can inspect.",
  },
  {
    name: "Kaxil Naik / shared AI agent patterns in engineering org",
    url: "https://x.com/kaxil/status/2037503513350005134",
    signal: "Using Cursor/Codex/Claude Code",
    note: "Public post describes sharing Cursor rules and slash commands across an engineering org. Good reply angle: this is the exact moment rules need ownership, freshness, and deletion policy.",
  },
  {
    name: "Chen Cheng / 5-10 Claude Code Codex worktrees",
    url: "https://x.com/chenchengpro/status/2032411474703053012",
    signal: "Agent branches or worktrees",
    note: "Public thread describes 5-10 Claude Code/Codex sessions, isolated worktrees, and dependency duplication. Good reply angle: once isolation works, the next bottleneck is receipts, merge order, and review gates.",
  },
];

function loadProspects() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function saveProspects(prospects) {
  localStorage.setItem(storageKey, JSON.stringify(prospects));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}

function render() {
  const prospects = loadProspects();
  count.textContent = String(prospects.filter((item) => item.status !== "Lost" && item.status !== "Retainer").length);
  pipeline.innerHTML = prospects.length
    ? prospects.map((item) => `
      <article class="prospect-card" data-id="${item.id}">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.signal)}</p>
          ${item.url ? `<a href="${escapeHtml(item.url)}">${escapeHtml(item.url)}</a>` : ""}
          ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
        </div>
        <label>
          Status
          <select data-action="status">
            ${statuses.map((status) => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </label>
      </article>
    `).join("")
    : `<div class="empty-state">Add five prospects today. Bias toward people already complaining about agent review, state, branches, or cost.</div>`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const prospects = loadProspects();
  prospects.unshift({
    id: crypto.randomUUID(),
    name: String(data.get("name")).trim(),
    url: String(data.get("url")).trim(),
    signal: String(data.get("signal")),
    note: String(data.get("note")).trim(),
    status: "New",
    createdAt: new Date().toISOString(),
  });
  saveProspects(prospects);
  form.reset();
  render();
});

pipeline.addEventListener("change", (event) => {
  if (event.target.dataset.action !== "status") return;
  const card = event.target.closest(".prospect-card");
  const prospects = loadProspects().map((item) => (
    item.id === card.dataset.id ? { ...item, status: event.target.value } : item
  ));
  saveProspects(prospects);
  render();
});

dmButton.addEventListener("click", async () => {
  const message = `Saw your post about your team using coding agents. I am testing a narrow AgentOps sprint: one week to make agent work inspectable in real repos with run receipts, worktree lanes, shared state, review gates, and cost routing.\n\nIf you already have messy agent branches or unclear AI PR review, I can do a 25-minute workflow audit and send back a failure map. Useful?\n\nhttps://jerednel.github.io/agentops-fieldkit/`;
  try {
    await navigator.clipboard.writeText(message);
    dmButton.textContent = "DM copied";
  } catch {
    window.prompt("Copy this DM", message);
    dmButton.textContent = "DM ready";
  }
  setTimeout(() => {
    dmButton.textContent = "Copy DM";
  }, 1600);
});

exportButton.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(loadProspects(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `agentops-fieldkit-prospects-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

clearDoneButton.addEventListener("click", () => {
  const active = loadProspects().filter((item) => item.status !== "Lost" && item.status !== "Retainer");
  saveProspects(active);
  render();
});

loadSeedsButton.addEventListener("click", () => {
  const prospects = loadProspects();
  const knownUrls = new Set(prospects.map((item) => item.url));
  const additions = seedProspects
    .filter((item) => !knownUrls.has(item.url))
    .map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      status: "New",
      createdAt: new Date().toISOString(),
    }));
  saveProspects([...additions, ...prospects]);
  loadSeedsButton.textContent = additions.length ? `Loaded ${additions.length}` : "Already loaded";
  setTimeout(() => {
    loadSeedsButton.textContent = "Load seed radar";
  }, 1600);
  render();
});

render();
