const statusBox = document.getElementById("status");
const copyListBtn = document.getElementById("copyList");
const copyDetailsBtn = document.getElementById("copyDetails");
const includePromptBox = document.getElementById("includePrompt");
const editPromptsBtn = document.getElementById("editPrompts");
const promptEditor = document.getElementById("promptEditor");
const listPromptBox = document.getElementById("listPrompt");
const detailsPromptBox = document.getElementById("detailsPrompt");
const savePromptsBtn = document.getElementById("savePrompts");
const resetPromptsBtn = document.getElementById("resetPrompts");

const DEFAULT_PROMPTS = {
  list: `You are helping me choose jobs to apply for. Analyze the LinkedIn job list below and rank the roles from most suitable to least suitable for a Machine Learning / Data Science profile. For each suitable role, explain briefly why it matches, possible risks, and what to emphasize in the application.`,
  details: `You are helping me apply for this LinkedIn job. Analyze the job post below and give me: 1) suitability score, 2) key requirements, 3) resume/cover-letter keywords, 4) a tailored short application message, and 5) likely interview preparation points.`
};

let prompts = { ...DEFAULT_PROMPTS };

function setStatus(message, type = "") {
  statusBox.className = type;
  statusBox.textContent = message;
}

function setBusy(isBusy) {
  copyListBtn.disabled = isBusy;
  copyDetailsBtn.disabled = isBusy;
  editPromptsBtn.disabled = isBusy;
}

function normalizePrompts(value) {
  return {
    list: typeof value?.list === "string" && value.list.trim() ? value.list.trim() : DEFAULT_PROMPTS.list,
    details: typeof value?.details === "string" && value.details.trim() ? value.details.trim() : DEFAULT_PROMPTS.details
  };
}

async function loadSettings() {
  const settings = await chrome.storage.local.get({ includePrompt: false, prompts: DEFAULT_PROMPTS });
  includePromptBox.checked = Boolean(settings.includePrompt);
  prompts = normalizePrompts(settings.prompts);
  listPromptBox.value = prompts.list;
  detailsPromptBox.value = prompts.details;
}

async function saveSettings(partial) {
  await chrome.storage.local.set(partial);
}

async function getActiveLinkedInTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  if (!tab.url || !tab.url.startsWith("https://www.linkedin.com/jobs/")) {
    throw new Error("Open a LinkedIn Jobs page first, for example linkedin.com/jobs/search/.");
  }
  return tab;
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
  } catch (_) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  }
}

async function getTextFromPage(type) {
  const tab = await getActiveLinkedInTab();
  await ensureContentScript(tab.id);
  const response = await chrome.tabs.sendMessage(tab.id, { type });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not read the LinkedIn page.");
  }
  return response;
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

function addPromptIfNeeded(text, promptType) {
  if (!includePromptBox.checked) return text;
  return `${prompts[promptType] || DEFAULT_PROMPTS[promptType]}\n\n---\n\n${text}`;
}

async function handleCopy(type, promptType) {
  setBusy(true);
  setStatus("Reading LinkedIn page...");
  try {
    const response = await getTextFromPage(type);
    const finalText = addPromptIfNeeded(response.text, promptType);
    await copyText(finalText);
    const suffix = response.count ? ` (${response.count} item${response.count === 1 ? "" : "s"})` : "";
    setStatus(`Copied to clipboard${suffix}. Paste it into GPT.`, "ok");
  } catch (error) {
    setStatus(`${error.message}\n\nTip: reload the LinkedIn tab after installing or updating the extension.`, "error");
  } finally {
    setBusy(false);
  }
}

includePromptBox.addEventListener("change", async () => {
  await saveSettings({ includePrompt: includePromptBox.checked });
});

editPromptsBtn.addEventListener("click", () => {
  promptEditor.hidden = !promptEditor.hidden;
  editPromptsBtn.textContent = promptEditor.hidden ? "Edit prompt" : "Hide editor";
});

savePromptsBtn.addEventListener("click", async () => {
  prompts = normalizePrompts({ list: listPromptBox.value, details: detailsPromptBox.value });
  listPromptBox.value = prompts.list;
  detailsPromptBox.value = prompts.details;
  await saveSettings({ prompts });
  setStatus("Prompt saved.", "ok");
});

resetPromptsBtn.addEventListener("click", async () => {
  prompts = { ...DEFAULT_PROMPTS };
  listPromptBox.value = prompts.list;
  detailsPromptBox.value = prompts.details;
  await saveSettings({ prompts });
  setStatus("Prompt reset to defaults.", "ok");
});

copyListBtn.addEventListener("click", () => handleCopy("COPY_JOB_LIST", "list"));
copyDetailsBtn.addEventListener("click", () => handleCopy("COPY_JOB_DETAILS", "details"));

loadSettings()
  .then(() => setStatus("Ready."))
  .catch(() => setStatus("Ready. Prompt settings could not be loaded, but copying still works."));
