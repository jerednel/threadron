const auditForm = document.querySelector("#audit-form");
const emailOutput = document.querySelector("#email-output");
const copyEmail = document.querySelector("#copy-email");
const mailtoLink = document.querySelector("#mailto-link");

function getValue(formData, key) {
  return String(formData.get(key) || "").trim();
}

function buildEmail(formData) {
  const name = getValue(formData, "buyerName");
  const email = getValue(formData, "email");
  const company = getValue(formData, "company");
  const teamSize = getValue(formData, "teamSize");
  const agents = getValue(formData, "agents");
  const failure = getValue(formData, "failure");
  const success = getValue(formData, "success");

  return `AgentOps audit request

Name: ${name}
Email: ${email}
Company/team: ${company}
Team size: ${teamSize || "Not sure"}

Agents in use:
${agents || "Not sure"}

Biggest failure mode:
${failure}

What would make this worth paying for:
${success || "Need help defining this."}

I want to start with the $950 AgentOps Audit. If the failure map shows enough coordination waste, I am open to the 7-day Fieldkit Sprint.`;
}

function updateMailto(text) {
  const subject = encodeURIComponent("AgentOps Audit Request");
  const body = encodeURIComponent(text);
  mailtoLink.href = `mailto:jeremy@jerednel.com?subject=${subject}&body=${body}`;
}

auditForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const emailText = buildEmail(new FormData(auditForm));
  emailOutput.value = emailText;
  updateMailto(emailText);
});

copyEmail.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(emailOutput.value);
    copyEmail.textContent = "Email copied";
  } catch {
    emailOutput.select();
    copyEmail.textContent = "Select and copy";
  }
  setTimeout(() => {
    copyEmail.textContent = "Copy email";
  }, 1600);
});
