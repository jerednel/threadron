const storageKey = "agentops-fieldkit-prospects";
const form = document.querySelector("#prospect-form");
const pipeline = document.querySelector("#pipeline");
const count = document.querySelector("#count");
const dmButton = document.querySelector("#copy-dm");
const exportButton = document.querySelector("#export-json");
const clearDoneButton = document.querySelector("#clear-done");

const statuses = ["New", "Replied", "DM sent", "Call booked", "Audit", "Sprint", "Retainer", "Lost"];

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

render();
