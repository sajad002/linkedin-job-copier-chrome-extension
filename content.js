(() => {
  if (window.__linkedinJobCopierInstalledV11) return;
  window.__linkedinJobCopierInstalledV11 = true;

  const JOB_CARD_SELECTORS = [
    ".job-card-container",
    ".job-card-container--clickable",
    "li.jobs-search-results__list-item",
    ".jobs-search-results-list__list-item",
    "li.scaffold-layout__list-item",
    "li[data-occludable-job-id]",
    "[data-job-id]",
    "[data-entity-urn*='jobPosting']",
    "[data-view-name='job-card']",
    "[data-testid*='job-card']",
    ".artdeco-list__item"
  ];

  const JOB_CARD_HAS_SELECTORS = [
    "li:has(a[href*='/jobs/view/'])",
    "div:has(a[href*='/jobs/view/'])"
  ];

  const LIST_CONTAINER_SELECTORS = [
    ".jobs-search-results-list",
    ".jobs-search-results-list__list",
    ".scaffold-layout__list",
    "[data-testid*='job-results']",
    "div[aria-label*='Search results']",
    "div[aria-label*='Job results']",
    "main div"
  ];

  const DETAIL_CONTAINER_SELECTORS = [
    ".jobs-search__job-details--container",
    ".jobs-details",
    ".jobs-details__main-content",
    ".job-view-layout",
    ".scaffold-layout__detail",
    "[data-testid*='job-details']",
    "main"
  ];

  const DESCRIPTION_SELECTORS = [
    ".jobs-description__content",
    ".jobs-description-content__text",
    ".jobs-box__html-content",
    ".jobs-description",
    "#job-details",
    "article"
  ];

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const clean = (value) => (value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = (value) => clean(value)
    .split("\n")
    .map((line) => clean(line))
    .filter(Boolean);

  function safeQueryAll(root, selector) {
    try {
      return [...root.querySelectorAll(selector)];
    } catch (_) {
      return [];
    }
  }

  function safeMatches(el, selector) {
    try {
      return el.matches(selector);
    } catch (_) {
      return false;
    }
  }

  function rectOf(el) {
    try {
      return el.getBoundingClientRect();
    } catch (_) {
      return { width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 };
    }
  }

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const rect = rectOf(el);
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function textOf(el) {
    return clean(el?.innerText || el?.textContent || "");
  }

  function textFrom(el, selectors) {
    for (const selector of selectors) {
      const node = safeQueryAll(el, selector).find(isVisible) || el.querySelector?.(selector);
      const text = textOf(node);
      if (text) return text;
    }
    return "";
  }

  function getJobIdFromElement(el) {
    let node = el;
    while (node && node !== document.body) {
      const candidates = [
        node.getAttribute?.("data-job-id"),
        node.getAttribute?.("data-occludable-job-id"),
        node.dataset?.jobId,
        node.dataset?.occludableJobId
      ].filter(Boolean);
      if (candidates.length) return candidates[0];
      node = node.parentElement;
    }
    return "";
  }

  function hrefFrom(el) {
    const link = safeQueryAll(el, "a[href*='/jobs/view/'], a[href*='currentJobId='], a[href*='/jobs/collections/']")
      .find((a) => textOf(a) || a.href);
    const jobId = getJobIdFromElement(el);

    if (link?.href) {
      try {
        const url = new URL(link.href, location.origin);
        url.searchParams.delete("refId");
        url.searchParams.delete("trackingId");
        return url.toString();
      } catch (_) {
        return link.href;
      }
    }

    if (jobId) return `https://www.linkedin.com/jobs/view/${jobId}/`;
    return "";
  }

  function getSearchQuery() {
    const inputs = safeQueryAll(document, "input[aria-label*='Search by title'], input[placeholder*='Search jobs'], input[role='combobox'], input[type='text']");
    const query = inputs
      .map((input) => clean(input.value || input.getAttribute("value") || ""))
      .find((value) => value && !/Germany|United States|France|Italy|Remote/i.test(value));
    return query || "";
  }

  function getLocationFilter() {
    const texts = safeQueryAll(document, "button, [role='button']")
      .map(textOf)
      .filter(Boolean);
    return texts.find((text) => /Germany|United States|France|Italy|Spain|Netherlands|Remote|On-site|Hybrid|Berlin|Munich|Hamburg/i.test(text)) || "";
  }

  function normalizeCardText(card) {
    return lines(textOf(card))
      .filter((line) => !/^dismiss$/i.test(line))
      .filter((line) => !/^x$/i.test(line))
      .filter((line) => !/^…$|^\.\.\.$/.test(line))
      .filter((line) => !/^Promoted$/i.test(line))
      .filter((line) => !/^Viewed$/i.test(line))
      .filter((line) => !/^Saved$/i.test(line))
      .join("\n");
  }

  function findLikelyListContainer() {
    const explicit = LIST_CONTAINER_SELECTORS.flatMap((selector) => safeQueryAll(document, selector)).filter(isVisible);
    const visibleScrollable = safeQueryAll(document, "body *").filter((el) => {
      const rect = rectOf(el);
      if (!isVisible(el)) return false;
      if (rect.width < 240 || rect.width > 720 || rect.height < 250) return false;
      if (rect.right > window.innerWidth * 0.62) return false;
      const scrollable = el.scrollHeight > el.clientHeight + 80;
      const jobLinks = safeQueryAll(el, "a[href*='/jobs/view/'], a[href*='currentJobId=']").length;
      return scrollable || jobLinks >= 2;
    });

    const candidates = [...new Set([...explicit, ...visibleScrollable])];
    let best = null;
    let bestScore = -Infinity;

    for (const el of candidates) {
      const rect = rectOf(el);
      // Prefer the left results pane, not the right job-detail pane.
      const isClearlyLeftPane = rect.right <= window.innerWidth * 0.62;
      const jobLinks = safeQueryAll(el, "a[href*='/jobs/view/'], a[href*='currentJobId=']").length;
      const textLen = textOf(el).length;
      const scrollBonus = el.scrollHeight > el.clientHeight + 80 ? 30 : 0;
      const leftBonus = isClearlyLeftPane ? 100 : -100;
      const sizePenalty = rect.height > window.innerHeight * 0.95 && rect.width > window.innerWidth * 0.75 ? -150 : 0;
      const score = leftBonus + scrollBonus + jobLinks * 25 + Math.min(textLen / 120, 30) + sizePenalty;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }

    return best || document.body;
  }

  function isLikelyJobCard(el) {
    if (!isVisible(el)) return false;
    const rect = rectOf(el);
    if (rect.width < 180 || rect.height < 35 || rect.height > 320) return false;
    const rawLines = lines(normalizeCardText(el));
    if (rawLines.length < 2) return false;
    const hasJobHint = Boolean(
      getJobIdFromElement(el) ||
      safeQueryAll(el, "a[href*='/jobs/view/'], a[href*='currentJobId=']").length ||
      /remote|on-site|hybrid|applicant|ago|company alumni|school alumni|viewed|promoted|Berlin|Munich|Hamburg|Germany/i.test(rawLines.join(" "))
    );
    return hasJobHint;
  }

  function nearestCardFromLink(link, listRoot) {
    const obvious = link.closest(JOB_CARD_SELECTORS.join(","));
    if (obvious && (!listRoot || listRoot.contains(obvious)) && isLikelyJobCard(obvious)) return obvious;

    let current = link;
    for (let depth = 0; current && current !== document.body && depth < 10; depth += 1) {
      if (listRoot && !listRoot.contains(current)) break;
      if (isLikelyJobCard(current)) return current;
      const rect = rectOf(current);
      if (rect.height > 340 || rect.width > 760) break;
      current = current.parentElement;
    }
    return null;
  }

  function collectJobCardCandidates(listRoot) {
    const candidates = new Set();
    const roots = [listRoot];
    if (listRoot !== document.body) roots.push(document.body);

    for (const root of roots) {
      for (const selector of JOB_CARD_SELECTORS) {
        for (const el of safeQueryAll(root, selector)) {
          if (isLikelyJobCard(el)) candidates.add(el);
        }
      }

      // Chrome supports :has(), but keep it isolated so older Chromium forks do not break the extension.
      for (const selector of JOB_CARD_HAS_SELECTORS) {
        for (const el of safeQueryAll(root, selector)) {
          if (isLikelyJobCard(el)) candidates.add(el);
        }
      }

      for (const link of safeQueryAll(root, "a[href*='/jobs/view/'], a[href*='currentJobId=']").filter(isVisible)) {
        const card = nearestCardFromLink(link, root);
        if (card) candidates.add(card);
      }
    }

    return [...candidates]
      .filter((el) => {
        const rect = rectOf(el);
        // Keep cards in the results column. This prevents the open job details pane from being read as a list item.
        return rect.right <= window.innerWidth * 0.68 || (listRoot !== document.body && listRoot.contains(el));
      })
      .sort((a, b) => rectOf(a).top - rectOf(b).top);
  }

  function meaningfulTextFromLink(link) {
    if (!link) return "";
    const direct = textOf(link);
    const aria = clean(link.getAttribute("aria-label") || link.getAttribute("title") || "");
    const value = direct || aria;
    return lines(value)
      .filter((line) => !/^(view job|opens in a new tab|apply)$/i.test(line))
      .join(" ");
  }

  function extractJobFromCard(card) {
    const rawLines = lines(normalizeCardText(card));
    if (rawLines.length < 2) return null;

    const titleLink = safeQueryAll(card, "a[href*='/jobs/view/'], a[href*='currentJobId=']")
      .find((a) => meaningfulTextFromLink(a));

    const title = clean(
      textFrom(card, [
        ".job-card-list__title--link",
        ".job-card-list__title",
        ".job-card-container__link strong",
        ".job-card-container__link",
        ".artdeco-entity-lockup__title",
        "[data-testid*='job-title']"
      ]) || meaningfulTextFromLink(titleLink) || rawLines[0]
    );

    const titleWords = new Set(lines(title).join(" ").toLowerCase().split(/\s+/).filter(Boolean));

    const company = clean(
      textFrom(card, [
        ".job-card-container__primary-description",
        ".artdeco-entity-lockup__subtitle",
        ".job-card-container__company-name",
        "[data-testid*='company']"
      ]) || rawLines.find((line) => {
        const lower = line.toLowerCase();
        return line !== title && !/applicant|ago|promoted|remote|on-site|hybrid|viewed|saved|alumni|easy apply/i.test(lower);
      }) || ""
    );

    const locationText = clean(
      textFrom(card, [
        ".job-card-container__metadata-item",
        ".artdeco-entity-lockup__caption",
        "[data-testid*='location']"
      ]) || rawLines.find((line) => /remote|on-site|hybrid|area|berlin|munich|hamburg|germany|frankfurt|cologne|düsseldorf|stuttgart|hannover|dingolfing|wolfsburg|weez|kaufbeuren/i.test(line)) || ""
    );

    const link = hrefFrom(card);
    const notes = rawLines
      .filter((line) => line !== title && line !== company && line !== locationText)
      .filter((line) => !/^apply$/i.test(line))
      .filter((line, index, arr) => arr.indexOf(line) === index)
      .slice(0, 8)
      .join("; ");

    const titleTokenOverlap = rawLines[0]
      ? rawLines[0].toLowerCase().split(/\s+/).filter((word) => titleWords.has(word)).length
      : 0;

    if (!title || title.length < 3) return null;
    if (!link && !getJobIdFromElement(card) && titleTokenOverlap === 0 && rawLines.length < 3) return null;

    return { title, company, locationText, link, notes, raw: rawLines.join(" | ") };
  }

  function extractJobCards() {
    const listRoot = findLikelyListContainer();
    const candidates = collectJobCardCandidates(listRoot);
    const seenKeys = new Set();
    const jobs = [];

    for (const card of candidates) {
      const job = extractJobFromCard(card);
      if (!job) continue;
      const key = clean(`${job.title}|${job.company}|${job.locationText}|${job.link || job.raw}`.toLowerCase());
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      jobs.push(job);
    }

    // Last-resort fallback: parse the left results pane line-by-line so the user still gets useful text.
    if (!jobs.length && listRoot && listRoot !== document.body) {
      const rawLines = lines(normalizeCardText(listRoot));
      for (let i = 0; i < rawLines.length - 1 && jobs.length < 40; i += 1) {
        const title = rawLines[i];
        const company = rawLines[i + 1] || "";
        const locationText = rawLines[i + 2] || "";
        if (!title || /results|job search alert|premium|helpful|feedback|about|privacy|accessibility/i.test(title)) continue;
        if (/ago|applicant|alumni|promoted|viewed|saved/i.test(title)) continue;
        if (title.length < 4 || company.length < 2) continue;
        jobs.push({ title, company, locationText, link: "", notes: rawLines.slice(i + 3, i + 6).join("; "), raw: rawLines.slice(i, i + 6).join(" | ") });
        i += 2;
      }
    }

    return jobs.slice(0, 80);
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
    const candidates = DETAIL_CONTAINER_SELECTORS.flatMap((selector) => safeQueryAll(document, selector)).filter(isVisible);
    // Prefer the visible details pane on the right, not the whole page.
    return candidates
      .map((el) => {
        const rect = rectOf(el);
        const text = textOf(el);
        const score =
          rect.width * rect.height +
          (/About the job|About this job|Job description/i.test(text) ? 500000 : 0) +
          (rect.left > window.innerWidth * 0.25 ? 250000 : 0) -
          (rect.width > window.innerWidth * 0.9 ? 800000 : 0);
        return { el, score };
      })
      .sort((a, b) => b.score - a.score)[0]?.el || document.body;
  }

  function selectedText() {
    const selection = window.getSelection?.();
    const text = clean(selection?.toString() || "");
    // If the user highlights exact text, use that instead of guessing. Do not use tiny accidental selections.
    return text.length >= 25 ? text : "";
  }

  function detailField(container, selectors) {
    return textFrom(container, selectors);
  }

  function findDescriptionNode(container) {
    return DESCRIPTION_SELECTORS
      .flatMap((selector) => safeQueryAll(container, selector))
      .filter(isVisible)
      .sort((a, b) => textOf(b).length - textOf(a).length)[0] || null;
  }

  function looksLikeMoreButton(el) {
    const text = textOf(el).toLowerCase();
    const aria = clean(el.getAttribute?.("aria-label") || "").toLowerCase();
    const combined = `${text} ${aria}`.trim();
    if (!combined || combined.length > 120) return false;
    if (/show less|see less|less/i.test(combined)) return false;
    return /(^|\s)(show|see)?\s*(more|mehr)($|\s)|…\s*more|\.\.\.\s*more|show more|see more|mehr anzeigen/i.test(combined);
  }

  async function clickMoreButtons(container) {
    const roots = [container, document.body];
    const clickable = new Set();

    for (const root of roots) {
      for (const el of safeQueryAll(root, "button, [role='button'], a, span")) {
        if (!isVisible(el) || !looksLikeMoreButton(el)) continue;
        const button = el.closest("button, [role='button'], a") || el;
        if (button) clickable.add(button);
      }
    }

    let clicked = 0;
    for (const button of clickable) {
      try {
        button.scrollIntoView?.({ block: "center", inline: "nearest" });
        button.click();
        clicked += 1;
        await sleep(180);
      } catch (_) {
        // Ignore buttons that LinkedIn intercepts or removes while expanding.
      }
    }
    return clicked;
  }

  async function expandHiddenJobDescription(container) {
    // LinkedIn often truncates the job description behind a "… more" / "Show more" control.
    // Scroll the detail pane and description area, then click all matching controls twice because
    // LinkedIn sometimes re-renders the button after the first click.
    for (let pass = 0; pass < 3; pass += 1) {
      const descriptionNode = findDescriptionNode(container);
      try {
        if (descriptionNode) descriptionNode.scrollTop = descriptionNode.scrollHeight;
        if (container && container !== document.body) container.scrollTop = container.scrollHeight;
      } catch (_) {}
      await clickMoreButtons(container);
      await sleep(220);
    }
  }

  function filterDescriptionText(text) {
    const stopPatterns = [
      /^Job search faster with Premium$/i,
      /^Access company insights/i,
      /^Millions of members use Premium$/i,
      /^Reactivate Premium/i,
      /^Cancel anytime/i,
      /^See how you compare/i,
      /^Your profile and resume/i,
      /^Show match details$/i,
      /^BETA\b/i
    ];

    const removePatterns = [
      /^…\s*more$/i,
      /^\.\.\.\s*more$/i,
      /^show more$/i,
      /^show less$/i,
      /^see more$/i,
      /^see less$/i,
      /^Skip to main content$/i,
      /^LinkedIn$/i
    ];

    const out = [];
    for (const line of lines(text)) {
      if (stopPatterns.some((pattern) => pattern.test(line))) break;
      if (removePatterns.some((pattern) => pattern.test(line))) continue;
      out.push(line);
    }
    return out.join("\n");
  }

  function getAboutJobText(container) {
    const descriptionNode = findDescriptionNode(container);
    const description = filterDescriptionText(textOf(descriptionNode));
    if (description && description.length > 40) return description;

    const allLines = lines(container.innerText);
    const start = allLines.findIndex((line) => /^About the job$/i.test(line) || /^About this job$/i.test(line) || /^Job description$/i.test(line));
    if (start >= 0) return filterDescriptionText(allLines.slice(start).join("\n"));
    return filterDescriptionText(allLines.slice(0, 160).join("\n"));
  }

  async function getOpenJobDetails() {
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

    let container = findDetailContainer();
    await expandHiddenJobDescription(container);
    container = findDetailContainer();

    const title = detailField(container, [
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
      "[data-testid*='job-title']",
      "h1"
    ]);
    const company = detailField(container, [
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name",
      "[data-testid*='company']",
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
    if (message?.type === "PING") {
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "COPY_JOB_LIST") {
      try {
        const jobs = extractJobCards();
        if (!jobs.length) {
          sendResponse({
            ok: false,
            error: "No visible LinkedIn job cards were found. Scroll the left results pane slightly, then try again."
          });
          return false;
        }
        sendResponse({ ok: true, count: jobs.length, text: formatJobList(jobs) });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || String(error) });
      }
      return false;
    }

    if (message?.type === "COPY_JOB_DETAILS") {
      getOpenJobDetails()
        .then((details) => {
          if (!details.text || details.text.length < 80) {
            sendResponse({ ok: false, error: "Could not find the open job details. Click a job first or highlight the text you want copied." });
            return;
          }
          sendResponse({ ok: true, count: details.count, text: details.text });
        })
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
      return true;
    }

    sendResponse({ ok: false, error: "Unknown action." });
    return false;
  });
})();
