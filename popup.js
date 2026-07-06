const statusBox = document.getElementById("status");
const copyListBtn = document.getElementById("copyList");
const copyDetailsBtn = document.getElementById("copyDetails");
const includePromptBox = document.getElementById("includePrompt");

const PROMPTS = {
  list: `You are helping me choose jobs to apply for. Analyze the LinkedIn job list below and rank the roles from most suitable to least suitable for a Machine Learning / Data Science profile. For each suitable role, explain briefly why it matches, possible risks, and what to emphasize in the application.`,
  details: `You are helping me apply for this LinkedIn job. Analyze the job post below and give me: 1) suitability score, 2) key requirements, 3) resume/cover-letter keywords, 4) a tailored short application message, and 5) likely interview preparation points.`
};

function setStatus(message, type = "") {
  statusBox.className = type;
  statusBox.textContent = message;
}

function setBusy(isBusy) {
  copyListBtn.disabled = isBusy;
  copyDetailsBtn.disabled = isBusy;
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
  return `${PROMPTS[promptType]}\n\n---\n\n${text}`;
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
    setStatus(`${error.message}\n\nTip: reload the LinkedIn tab after installing the extension.`, "error");
  } finally {
    setBusy(false);
  }
}

copyListBtn.addEventListener("click", () => handleCopy("COPY_JOB_LIST", "list"));
copyDetailsBtn.addEventListener("click", () => handleCopy("COPY_JOB_DETAILS", "details"));
setStatus("Ready.");
