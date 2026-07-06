(() => {
  if (window.__linkedinJobCopierInstalled) return;
  window.__linkedinJobCopierInstalled = true;

  const JOB_CARD_SELECTORS = [
    ".job-card-container",
    "li.jobs-search-results__list-item",
    ".jobs-search-results-list__list-item",
    "li.scaffold-layout__list-item",
    "div[data-job-id]"
  ].join(",");

  const LIST_CONTAINER_SELECTORS = [
    ".jobs-search-results-list",
    ".jobs-search-results-list__list",
    ".scaffold-layout__list",
    "div[aria-label*='Search results']",
    "div[aria-label*='Job results']"
  ].join(",");

  const DETAIL_CONTAINER_SELECTORS = [
    ".jobs-search__job-details--container",
    ".jobs-details",
    ".jobs-details__main-content",
    ".job-view-layout",
    ".scaffold-layout__detail",
    "main"
  ].join(",");

  const clean = (value) => (value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = (value) => clean(value)
    .split("\n")
    .map((line) => clean(line))
    .filter(Boolean);

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function textFrom(el, selectors) {
    for (const selector of selectors) {
      const node = el.querySelector(selector);
      const text = clean(node?.innerText || node?.textContent || "");
      if (text) return text;
    }
    return "";
  }

  function hrefFrom(el) {
    const link = el.querySelector("a[href*='/jobs/view/'], a[href*='currentJobId='], a[href*='/jobs/collections/']");
    if (!link?.href) return "";
    try {
      const url = new URL(link.href, location.origin);
      url.searchParams.delete("refId");
      url.searchParams.delete("trackingId");
      return url.toString();
    } catch (_) {
      return link.href;
    }
  }

  function getSearchQuery() {
    const searchInput = document.querySelector("input[aria-label*='Search by title'], input[placeholder*='Search jobs'], input[role='combobox']");
    const query = clean(searchInput?.value || searchInput?.getAttribute("value") || "");
    return query;
  }

  function getLocationFilter() {
    const candidates = [
      "button[aria-label*='Location']",
      "button:has(span[aria-hidden='true'])"
    ];
    for (const selector of candidates) {
      try {
        const found = [...document.querySelectorAll(selector)]
          .map((el) => clean(el.innerText))
          .find((text) => text && /Germany|United States|France|Italy|Spain|Netherlands|Remote|On-site|Hybrid/i.test(text));
        if (found) return found;
      } catch (_) {
        // Older Chrome versions may not support :has(); ignore and continue.
      }
    }
    return "";
  }

  function normalizeCardText(card) {
    return lines(card.innerText)
      .filter((line) => !/^dismiss$/i.test(line))
      .filter((line) => !/^x$/i.test(line))
      .filter((line) => !/^…$|^\.\.\.$/.test(line))
      .filter((line) => !/^Promoted$/i.test(line))
      .join("\n");
  }

  function extractJobCards() {
    const listContainer = document.querySelector(LIST_CONTAINER_SELECTORS) || document.body;
    const candidates = [...listContainer.querySelectorAll(JOB_CARD_SELECTORS)].filter(isVisible);
    const seenKeys = new Set();
    const jobs = [];

    for (const card of candidates) {
      const rawLines = lines(normalizeCardText(card));
      if (rawLines.length < 2) continue;

      const title = textFrom(card, [
        ".job-card-list__title--link",
        ".job-card-list__title",
        ".job-card-container__link strong",
        ".job-card-container__link",
        ".artdeco-entity-lockup__title",
        "a[aria-label]"
      ]) || rawLines[0];

      const company = textFrom(card, [
        ".job-card-container__primary-description",
        ".artdeco-entity-lockup__subtitle",
        ".job-card-container__company-name"
      ]) || rawLines.find((line) => line !== title && !/applicant|ago|promoted|remote|on-site|hybrid/i.test(line)) || "";

      const locationText = textFrom(card, [
        ".job-card-container__metadata-item",
        ".artdeco-entity-lockup__caption"
      ]) || rawLines.find((line) => /remote|on-site|hybrid|area|berlin|munich|hamburg|germany|frankfurt|cologne|düsseldorf|stuttgart|hannover|dingolfing/i.test(line)) || "";

      const link = hrefFrom(card);
      const notes = rawLines
        .filter((line) => ![title, company, locationText].includes(line))
        .filter((line, index, arr) => arr.indexOf(line) === index)
        .slice(0, 6)
        .join("; ");

      const key = clean(`${title}|${company}|${locationText}|${link}`.toLowerCase());
      if (!title || seenKeys.has(key)) continue;
      seenKeys.add(key);
      jobs.push({ title, company, locationText, link, notes, raw: rawLines.join(" | ") });
    }

    return jobs.slice(0, 60);
  }

  function formatJobList(jobs) {
    const header = [
      "# LinkedIn job positions list",
      `Copied at: ${new Date().toLocaleString()}`,
      `Page URL: ${location.href}`
    ];
    const query = getSearchQuery();
    const locationFilter = getLocationFilter();
    if (query) header.push(`Search query: ${query}`);
    if (locationFilter) header.push(`Visible location/filter: ${locationFilter}`);

    const body = jobs.map((job, index) => {
      const parts = [`${index + 1}. ${job.title}`];
      if (job.company) parts.push(`Company: ${job.company}`);
      if (job.locationText) parts.push(`Location: ${job.locationText}`);
      if (job.notes) parts.push(`Visible notes: ${job.notes}`);
      if (job.link) parts.push(`Link: ${job.link}`);
      return parts.join("\n   ");
    }).join("\n\n");

    return `${header.join("\n")}\n\n${body}`;
  }

  function findDetailContainer() {
    const candidates = [...document.querySelectorAll(DETAIL_CONTAINER_SELECTORS)].filter(isVisible);
    // Prefer the largest visible details pane; LinkedIn changes class names often.
    return candidates
      .map((el) => ({ el, area: el.getBoundingClientRect().width * el.getBoundingClientRect().height }))
      .sort((a, b) => b.area - a.area)[0]?.el || document.body;
  }

  function selectedText() {
    const selection = window.getSelection?.();
    const text = clean(selection?.toString() || "");
    // If the user highlights the exact part they want, use that instead of guessing.
    return text.length >= 25 ? text : "";
  }

  function detailField(container, selectors) {
    return textFrom(container, selectors);
  }

  function getAboutJobText(container) {
    const description = detailField(container, [
      ".jobs-description__content",
      ".jobs-description-content__text",
      ".jobs-box__html-content",
      "#job-details",
      "article"
    ]);
    if (description) return description;

    const allLines = lines(container.innerText);
    const start = allLines.findIndex((line) => /^About the job$/i.test(line) || /^About this job$/i.test(line));
    if (start >= 0) return allLines.slice(start).join("\n");
    return allLines.slice(0, 120).join("\n");
  }

  function getOpenJobDetails() {
    const exactSelection = selectedText();
    if (exactSelection) {
      return {
        count: 1,
        text: [
          "# Selected LinkedIn job information",
          `Copied at: ${new Date().toLocaleString()}`,
          `Page URL: ${location.href}`,
          "",
          exactSelection
        ].join("\n")
      };
    }

    const container = findDetailContainer();
    const title = detailField(container, [
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
      "h1"
    ]);
    const company = detailField(container, [
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name",
      "a[href*='/company/']"
    ]);
    const locationAndMeta = detailField(container, [
      ".job-details-jobs-unified-top-card__primary-description-container",
      ".jobs-unified-top-card__primary-description",
      ".job-details-jobs-unified-top-card__tertiary-description-container"
    ]);
    const workplace = detailField(container, [
      ".job-details-preferences-and-skills__pill",
      ".jobs-unified-top-card__job-insight",
      ".job-details-fit-level-preferences"
    ]);
    const about = getAboutJobText(container);

    const linesOut = [
      "# LinkedIn open job information",
      `Copied at: ${new Date().toLocaleString()}`,
      `Page URL: ${location.href}`,
      ""
    ];
    if (title) linesOut.push(`Title: ${title}`);
    if (company) linesOut.push(`Company: ${company}`);
    if (locationAndMeta) linesOut.push(`Location / posted / applicants: ${locationAndMeta}`);
    if (workplace) linesOut.push(`Job type / workplace / fit notes: ${workplace}`);
    linesOut.push("", "## Job description", about);

    return { count: 1, text: clean(linesOut.join("\n")) };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      if (message?.type === "PING") {
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "COPY_JOB_LIST") {
        const jobs = extractJobCards();
        if (!jobs.length) {
          sendResponse({ ok: false, error: "No visible LinkedIn job cards were found. Scroll the list a little or reload the page." });
          return;
        }
        sendResponse({ ok: true, count: jobs.length, text: formatJobList(jobs) });
        return;
      }

      if (message?.type === "COPY_JOB_DETAILS") {
        const details = getOpenJobDetails();
        if (!details.text || details.text.length < 80) {
          sendResponse({ ok: false, error: "Could not find the open job details. Click a job first or highlight the text you want copied." });
          return;
        }
        sendResponse({ ok: true, count: details.count, text: details.text });
        return;
      }

      sendResponse({ ok: false, error: "Unknown action." });
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error) });
    }
  });
})();
