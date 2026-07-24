(() => {
  if (window.__linkedinJobCopierInstalledV132) return;
  window.__linkedinJobCopierInstalledV132 = true;

  const JOB_CARD_SELECTORS = [
    "li[data-occludable-job-id]",
    "[data-occludable-job-id]",
    "[data-job-id]",
    ".job-card-container",
    ".job-card-container--clickable",
    "li.jobs-search-results__list-item",
    ".jobs-search-results-list__list-item",
    "li.scaffold-layout__list-item",
    "[data-view-name='job-card']",
    "[data-testid*='job-card']"
  ];

  const LIST_CONTAINER_SELECTORS = [
    ".jobs-search-results-list",
    ".jobs-search-results-list__list",
    ".jobs-search-results__list",
    ".scaffold-layout__list",
    ".scaffold-layout__list-container",
    "ul.jobs-search-results__list",
    "ul[role='list']",
    "div[aria-label*='Search results']",
    "div[aria-label*='Job results']"
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

  const ROLE_WORDS = /engineer|scientist|developer|entwickler|software|data|machine|learning|ai|nlp|llm|algorithm|intern|internship|student|working student|werkstudent|praktik|praktikum|abschlussarbeit|thesis|quantitative|research|analyst|analytics|computer vision|vision|validation|deployment|strategist|architect|consultant|phd|master/i;

  const NOISE_LINE_PATTERNS = [
    /^dismiss$/i,
    /^x$/i,
    /^…$|^\.\.\.$/,
    /^more$/i,
    /^share$/i,
    /^share negative feedback$/i,
    /^why am i seeing this job\??$/i,
    /^are these results helpful\??$/i,
    /^your feedback helps/i,
    /^see jobs where you/i,
    /^job search alert/i,
    /^this job search alert/i,
    /^reactivate premium/i,
    /^job search faster with premium/i,
    /^about$/i,
    /^accessibility$/i,
    /^help center$/i,
    /^privacy/i,
    /^ad choices$/i,
    /^advertising$/i,
    /^business services$/i,
    /^get the linkedin app$/i,
    /^linkedin corporation/i,
    /^questions\??$/i,
    /^visit our help center/i,
    /^manage your account/i,
    /^recommendation transparency/i,
    /^sales solutions$/i,
    /^mobile$/i,
    /^safety center$/i,
    /^community guidelines$/i,
    /^careers$/i,
    /^talent solutions$/i,
    /^marketing solutions$/i,
    /^small business$/i,
    /^select language$/i
  ];

  const NOISE_BLOCK_RE = /Are these results helpful|Your feedback helps us improve|Share negative feedback|See jobs where you|LinkedIn Corporation|Privacy & Terms|Community Guidelines|Recommendation transparency|Reactivate Premium|Job search faster with Premium|Select language/i;

  const META_LINE_RE = /^(viewed|saved|promoted|be an early applicant|\d+\s+(company|school) alumni|\d+\s+connections? work here|\d+\s+(minute|minutes|hour|hours|day|days|week|weeks) ago|easy apply|actively hiring|verified|no response insights)/i;
  const LOCATION_LINE_RE = /remote|on-site|hybrid|berlin|munich|münchen|hamburg|hannover|hanover|frankfurt|cologne|köln|düsseldorf|stuttgart|wolfsburg|dingolfing|weez|kaufbeuren|germany|deutschland|greater .* area|metropolitan area|europe|emea/i;

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

  function isNoiseLine(line) {
    const value = clean(line);
    return !value || NOISE_LINE_PATTERNS.some((pattern) => pattern.test(value));
  }

  function isBadCardText(text) {
    return NOISE_BLOCK_RE.test(text);
  }

  function normalizeCardText(card) {
    return lines(textOf(card))
      .filter((line) => !isNoiseLine(line))
      .filter((line) => !/^report this job$/i.test(line))
      .filter((line) => !/^send in a message$/i.test(line))
      .join("\n");
  }

  function isInLeftResultsArea(el) {
    const rect = rectOf(el);
    if (!isVisible(el)) return false;
    if (rect.width < 120 || rect.height < 20) return false;
    // The LinkedIn search-results column is the left pane. This avoids copying the right job-detail pane.
    return rect.left < window.innerWidth * 0.52 && rect.right < window.innerWidth * 0.66;
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

  function jobLinksIn(el) {
    return safeQueryAll(el, "a[href*='/jobs/view/']").filter((a) => {
      try {
        const url = new URL(a.href, location.origin);
        return /\/jobs\/view\//.test(url.pathname);
      } catch (_) {
        return /\/jobs\/view\//.test(a.getAttribute("href") || "");
      }
    });
  }

  function hrefFrom(card) {
    const link = jobLinksIn(card).find((a) => textOf(a) || a.href) || jobLinksIn(card)[0];
    const jobId = getJobIdFromElement(card);

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
      .find((value) => value && !/Germany|United States|France|Italy|Remote|Hybrid|On-site/i.test(value));
    return query || "";
  }

  function getLocationFilter() {
    const texts = safeQueryAll(document, "button, [role='button']")
      .map(textOf)
      .filter(Boolean);
    return texts.find((text) => /Germany|United States|France|Italy|Spain|Netherlands|Remote|On-site|Hybrid|Berlin|Munich|Hamburg/i.test(text)) || "";
  }

  function findLikelyListContainer() {
    const explicit = LIST_CONTAINER_SELECTORS
      .flatMap((selector) => safeQueryAll(document, selector))
      .filter((el) => isVisible(el) && isInLeftResultsArea(el) && !isBadCardText(textOf(el)));

    const scrollableLeftPanes = safeQueryAll(document, "body *").filter((el) => {
      if (!isVisible(el) || !isInLeftResultsArea(el)) return false;
      const rect = rectOf(el);
      if (rect.width < 260 || rect.width > 650 || rect.height < 250) return false;
      if (rect.top > window.innerHeight * 0.55) return false;
      const text = textOf(el);
      if (isBadCardText(text) && !ROLE_WORDS.test(text)) return false;
      const scrollable = el.scrollHeight > el.clientHeight + 80;
      const jobIds = safeQueryAll(el, "[data-job-id], [data-occludable-job-id]").length;
      const links = jobLinksIn(el).length;
      const jobClassHits = safeQueryAll(el, ".job-card-container, li.jobs-search-results__list-item, li.scaffold-layout__list-item").length;
      return scrollable || jobIds >= 2 || links >= 2 || jobClassHits >= 2;
    });

    const candidates = [...new Set([...explicit, ...scrollableLeftPanes])];
    let best = null;
    let bestScore = -Infinity;

    for (const el of candidates) {
      const rect = rectOf(el);
      const text = textOf(el);
      const jobIds = safeQueryAll(el, "[data-job-id], [data-occludable-job-id]").length;
      const links = jobLinksIn(el).length;
      const jobClassHits = safeQueryAll(el, ".job-card-container, li.jobs-search-results__list-item, li.scaffold-layout__list-item").length;
      const roleHits = lines(text).filter((line) => ROLE_WORDS.test(line)).length;
      const scrollBonus = el.scrollHeight > el.clientHeight + 80 ? 50 : 0;
      const compactLeftBonus = rect.left < window.innerWidth * 0.2 && rect.right < window.innerWidth * 0.5 ? 80 : 0;
      const noisePenalty = isBadCardText(text) ? -200 : 0;
      const score = compactLeftBonus + scrollBonus + jobIds * 50 + links * 35 + jobClassHits * 30 + roleHits * 8 + Math.min(rect.height / 10, 60) + noisePenalty;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }

    return best;
  }

  function cleanCardLines(card) {
    const raw = lines(normalizeCardText(card));
    const out = [];
    for (const line of raw) {
      if (isNoiseLine(line)) continue;
      if (/^promoted$/i.test(line)) continue;
      if (/^viewed$/i.test(line)) continue;
      if (/^saved$/i.test(line)) continue;
      if (/^apply$/i.test(line)) continue;
      if (out[out.length - 1] !== line) out.push(line);
    }
    return out;
  }

  function nearestCardFromLink(link, listRoot) {
    const preferred = link.closest("li[data-occludable-job-id], li.jobs-search-results__list-item, li.scaffold-layout__list-item, .job-card-container, [data-job-id]");
    if (preferred && isInLeftResultsArea(preferred) && (!listRoot || listRoot.contains(preferred))) return preferred;

    let current = link;
    for (let depth = 0; current && current !== document.body && depth < 10; depth += 1) {
      if (listRoot && !listRoot.contains(current)) break;
      const rect = rectOf(current);
      if (isInLeftResultsArea(current) && rect.height >= 45 && rect.height <= 280 && rect.width >= 220 && rect.width <= 650) {
        return current;
      }
      if (rect.height > 330 || rect.width > 760) break;
      current = current.parentElement;
    }
    return null;
  }

  function collectStructuredCardCandidates(listRoot) {
    const candidates = new Set();
    const roots = listRoot ? [listRoot] : [document];

    for (const root of roots) {
      for (const selector of JOB_CARD_SELECTORS) {
        for (const el of safeQueryAll(root, selector)) {
          const card = el.closest("li[data-occludable-job-id], li.jobs-search-results__list-item, li.scaffold-layout__list-item") || el;
          if (isInLeftResultsArea(card)) candidates.add(card);
        }
      }

      for (const link of jobLinksIn(root).filter(isVisible)) {
        if (!isInLeftResultsArea(link)) continue;
        const card = nearestCardFromLink(link, root === document ? null : root);
        if (card) candidates.add(card);
      }
    }

    return [...candidates]
      .filter((el) => {
        const rect = rectOf(el);
        const text = textOf(el);
        if (!isVisible(el) || !isInLeftResultsArea(el)) return false;
        if (rect.height < 35 || rect.height > 330 || rect.width < 180) return false;
        if (isBadCardText(text)) return false;
        return true;
      })
      .sort((a, b) => rectOf(a).top - rectOf(b).top);
  }

  function meaningfulTextFromLink(link) {
    if (!link) return "";
    const direct = textOf(link);
    const aria = clean(link.getAttribute("aria-label") || link.getAttribute("title") || "");
    const values = lines(direct || aria)
      .filter((line) => !/^(view job|opens in a new tab|apply|save|more)$/i.test(line))
      .filter((line) => !isNoiseLine(line));
    return values.join(" ");
  }

  function pickTitle(rawLines, card) {
    const titleBySelector = clean(textFrom(card, [
      ".job-card-list__title--link",
      ".job-card-list__title",
      ".job-card-container__link strong",
      ".job-card-container__link",
      ".artdeco-entity-lockup__title",
      "[data-testid*='job-title']",
      "strong"
    ]));

    const titleLink = jobLinksIn(card).find((a) => meaningfulTextFromLink(a));
    const linkTextLines = lines(meaningfulTextFromLink(titleLink));
    const selectorLines = lines(titleBySelector);
    const pools = [selectorLines, linkTextLines, rawLines];

    for (const pool of pools) {
      const roleLine = pool.find((line) => !isNoiseLine(line) && !META_LINE_RE.test(line) && ROLE_WORDS.test(line));
      if (roleLine) return roleLine;
    }

    for (const pool of pools) {
      const candidate = pool.find((line) => !isNoiseLine(line) && !META_LINE_RE.test(line) && !LOCATION_LINE_RE.test(line));
      if (candidate) return candidate;
    }

    return rawLines[0] || "";
  }

  function nextUsefulLineAfter(rawLines, anchor, predicate = () => true) {
    const index = rawLines.findIndex((line) => line === anchor || anchor.includes(line) || line.includes(anchor));
    const start = index >= 0 ? index + 1 : 0;
    for (let i = start; i < rawLines.length; i += 1) {
      const line = rawLines[i];
      if (isNoiseLine(line) || META_LINE_RE.test(line)) continue;
      if (predicate(line)) return line;
    }
    return "";
  }

  function pickCompany(rawLines, card, title) {
    const fromSelector = clean(textFrom(card, [
      ".job-card-container__primary-description",
      ".artdeco-entity-lockup__subtitle",
      ".job-card-container__company-name",
      "[data-testid*='company']"
    ]));
    const selected = lines(fromSelector).find((line) => line !== title && !isNoiseLine(line) && !META_LINE_RE.test(line));
    if (selected) return selected;

    return nextUsefulLineAfter(rawLines, title, (line) => line !== title && !LOCATION_LINE_RE.test(line) && !ROLE_WORDS.test(line));
  }

  function pickLocation(rawLines, card, company) {
    const fromSelector = clean(textFrom(card, [
      ".job-card-container__metadata-item",
      ".artdeco-entity-lockup__caption",
      "[data-testid*='location']"
    ]));
    const selected = lines(fromSelector).find((line) => LOCATION_LINE_RE.test(line));
    if (selected) return selected;

    const afterCompany = company ? nextUsefulLineAfter(rawLines, company, (line) => LOCATION_LINE_RE.test(line)) : "";
    if (afterCompany) return afterCompany;
    return rawLines.find((line) => LOCATION_LINE_RE.test(line)) || "";
  }

  function extractJobFromCard(card) {
    const rawLines = cleanCardLines(card);
    if (rawLines.length < 2) return null;
    const rawText = rawLines.join(" | ");
    if (isBadCardText(rawText)) return null;

    const title = clean(pickTitle(rawLines, card));
    const company = clean(pickCompany(rawLines, card, title));
    const locationText = clean(pickLocation(rawLines, card, company));
    const link = hrefFrom(card);
    const hasJobIdentity = Boolean(link || getJobIdFromElement(card) || jobLinksIn(card).length);
    const hasJobSignals = hasJobIdentity || ROLE_WORDS.test(title) || rawLines.some((line) => META_LINE_RE.test(line) || LOCATION_LINE_RE.test(line));

    if (!title || title.length < 3) return null;
    if (isNoiseLine(title) || isBadCardText(title)) return null;
    if (!hasJobSignals) return null;
    if (!hasJobIdentity && !ROLE_WORDS.test(title)) return null;

    const notes = rawLines
      .filter((line) => line !== title && line !== company && line !== locationText)
      .filter((line) => !isNoiseLine(line))
      .filter((line, index, arr) => arr.indexOf(line) === index)
      .slice(0, 8)
      .join("; ");

    return { title, company, locationText, link, notes, raw: rawText };
  }

  function collectFallbackRows(listRoot) {
    if (!listRoot) return [];
    const possibleRows = safeQueryAll(listRoot, "li, div")
      .filter((el) => {
        const rect = rectOf(el);
        const text = textOf(el);
        if (!isVisible(el) || !isInLeftResultsArea(el)) return false;
        if (rect.height < 45 || rect.height > 260 || rect.width < 220 || rect.width > 650) return false;
        if (isBadCardText(text)) return false;
        const rowLines = cleanCardLines(el);
        if (rowLines.length < 2 || rowLines.length > 16) return false;
        return ROLE_WORDS.test(rowLines[0]) || rowLines.some((line) => ROLE_WORDS.test(line));
      })
      .sort((a, b) => rectOf(a).top - rectOf(b).top);

    // Keep outermost useful rows only; nested title/company nodes should not duplicate the same job.
    return possibleRows.filter((row) => !possibleRows.some((other) => other !== row && other.contains(row) && Math.abs(rectOf(other).height - rectOf(row).height) < 35));
  }

  function parseLineFallback(listRoot) {
    if (!listRoot) return [];
    const rawLines = lines(normalizeCardText(listRoot))
      .filter((line) => !isNoiseLine(line))
      .filter((line) => !/^\d+ results?$/i.test(line));
    const jobs = [];

    for (let i = 0; i < rawLines.length - 1 && jobs.length < 60; i += 1) {
      const title = rawLines[i];
      if (!ROLE_WORDS.test(title)) continue;
      const company = rawLines.slice(i + 1, i + 4).find((line) => !META_LINE_RE.test(line) && !LOCATION_LINE_RE.test(line) && !ROLE_WORDS.test(line)) || "";
      const locationText = rawLines.slice(i + 1, i + 5).find((line) => LOCATION_LINE_RE.test(line)) || "";
      if (!company && !locationText) continue;
      const notes = rawLines.slice(i + 1, i + 7).filter((line) => line !== company && line !== locationText).join("; ");
      jobs.push({ title, company, locationText, link: "", notes, raw: rawLines.slice(i, i + 7).join(" | ") });
    }
    return jobs;
  }

  function extractJobCards() {
    const listRoot = findLikelyListContainer();
    const candidates = collectStructuredCardCandidates(listRoot);
    const rowFallbacks = candidates.length ? [] : collectFallbackRows(listRoot);
    const allCandidates = [...candidates, ...rowFallbacks];
    const seenKeys = new Set();
    const jobs = [];

    for (const card of allCandidates) {
      const job = extractJobFromCard(card);
      if (!job) continue;
      const key = clean(`${job.title}|${job.company}|${job.locationText}|${job.link || job.raw}`.toLowerCase());
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      jobs.push(job);
    }

    if (!jobs.length) {
      for (const job of parseLineFallback(listRoot)) {
        const key = clean(`${job.title}|${job.company}|${job.locationText}|${job.raw}`.toLowerCase());
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        jobs.push(job);
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

  function sanitizeDirectoryName(value) {
    let out = clean(value)
      .replace(/[\r\n\t]+/g, " ")
      .replace(/[\\/:\u0000*?"<>|]+/g, " ")
      .replace(/[;`!#$%^&={}\[\]~]+/g, " ")
      .replace(/\s*[-–—]+\s*/g, " - ")
      .replace(/\s+/g, " ")
      .replace(/^[-.\s]+|[-.\s]+$/g, "")
      .trim();

    // Avoid hidden/parent-directory-looking names and keep folder names practical.
    out = out.replace(/^\.+/, "").trim();
    if (out.length > 150) out = out.slice(0, 150).replace(/\s+\S*$/, "").trim();
    return out || "LinkedIn job";
  }

  function formatSafeJobNames(jobs) {
    return jobs
      .map((job) => sanitizeDirectoryName([job.company, job.title].filter(Boolean).join(" - ")))
      .filter(Boolean)
      .filter((name, index, arr) => arr.indexOf(name) === index)
      .join("\n");
  }

  function buttonLabel(el) {
    return clean([
      el?.innerText,
      el?.textContent,
      el?.getAttribute?.("aria-label"),
      el?.getAttribute?.("title"),
      el?.getAttribute?.("data-control-name")
    ].filter(Boolean).join(" "));
  }

  function looksLikeDismissButton(button, card) {
    if (!button || !isVisible(button)) return false;
    if (button.disabled || button.getAttribute?.("aria-disabled") === "true") return false;

    const label = buttonLabel(button).toLowerCase();
    if (/undo|save|saved|apply|share|message|report|more|open|view|premium|alumni|helpful|feedback/.test(label)) return false;
    if (/dismiss|remove|hide|close|not interested|not show|don.t show|won.t recommend|we won.t recommend|entfernen|ausblenden|schlie.en|nicht mehr anzeigen/.test(label)) return true;
    if (/^(x|×|✕|✖)$/.test(label)) return true;

    const closeIcon = button.querySelector?.("li-icon[type*='close' i], li-icon[type*='cancel' i], svg[aria-label*='close' i], svg[aria-label*='dismiss' i], [data-test-icon*='close' i], [data-test-icon*='dismiss' i]");
    if (closeIcon) return true;

    // Fallback for LinkedIn's small icon-only X in the right side of each job card.
    const cardRect = rectOf(card);
    const buttonRect = rectOf(button);
    const smallButton = buttonRect.width > 8 && buttonRect.width <= 58 && buttonRect.height > 8 && buttonRect.height <= 58;
    const onRightSide = buttonRect.left >= cardRect.left + cardRect.width * 0.72;
    const notTooLow = buttonRect.top <= cardRect.top + Math.max(78, cardRect.height * 0.55);
    const iconOnly = !label || label.length <= 2;
    return smallButton && onRightSide && notTooLow && iconOnly;
  }

  function findDismissButton(card) {
    const controls = safeQueryAll(card, "button, [role='button'], a")
      .map((el) => el.closest?.("button, [role='button'], a") || el)
      .filter((el, index, arr) => el && arr.indexOf(el) === index)
      .filter((el) => card.contains(el) && looksLikeDismissButton(el, card));

    if (!controls.length) return null;

    return controls.sort((a, b) => {
      const labelA = buttonLabel(a).toLowerCase();
      const labelB = buttonLabel(b).toLowerCase();
      const rectA = rectOf(a);
      const rectB = rectOf(b);
      const score = (label, rect) =>
        (/dismiss|remove|hide|close|not interested|won.t recommend|entfernen|ausblenden/.test(label) ? 100 : 0) +
        (/^(x|×|✕|✖)$/.test(label) ? 60 : 0) +
        (rect.left / Math.max(window.innerWidth, 1)) * 20 -
        (rect.top / Math.max(window.innerHeight, 1));
      return score(labelB, rectB) - score(labelA, rectA);
    })[0];
  }

  function collectVisibleListedJobCards() {
    const listRoot = findLikelyListContainer();
    const candidates = collectStructuredCardCandidates(listRoot);
    const fallback = candidates.length ? [] : collectFallbackRows(listRoot);
    const seen = new Set();
    return [...candidates, ...fallback]
      .filter((card) => {
        if (!card || !isVisible(card) || !isInLeftResultsArea(card)) return false;
        const job = extractJobFromCard(card);
        if (!job) return false;
        const key = clean(`${job.title}|${job.company}|${job.locationText}|${hrefFrom(card) || job.raw}`.toLowerCase());
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => rectOf(a).top - rectOf(b).top);
  }

  async function removeListedJobs() {
    const cards = collectVisibleListedJobCards();
    let removed = 0;
    let skipped = 0;

    for (const card of cards) {
      if (!isVisible(card)) continue;
      const button = findDismissButton(card);
      if (!button) {
        skipped += 1;
        continue;
      }
      try {
        button.click();
        removed += 1;
        await sleep(260);
      } catch (_) {
        skipped += 1;
      }
    }

    return { removed, skipped, total: cards.length };
  }

  function findDetailContainer() {
    const candidates = DETAIL_CONTAINER_SELECTORS.flatMap((selector) => safeQueryAll(document, selector)).filter(isVisible);
    return candidates
      .map((el) => {
        const rect = rectOf(el);
        const text = textOf(el);
        const score =
          Math.min(rect.width * rect.height, 1200000) +
          (/About the job|About this job|Job description/i.test(text) ? 500000 : 0) +
          (rect.left > window.innerWidth * 0.25 ? 250000 : 0) -
          (rect.width > window.innerWidth * 0.9 ? 800000 : 0) -
          (rect.right < window.innerWidth * 0.55 ? 700000 : 0);
        return { el, score };
      })
      .sort((a, b) => b.score - a.score)[0]?.el || document.body;
  }

  function selectedText() {
    const selection = window.getSelection?.();
    const text = clean(selection?.toString() || "");
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

  function findDescriptionSection(container) {
    const descriptionNode = findDescriptionNode(container);
    if (!descriptionNode) return null;
    return descriptionNode.closest(".jobs-description, .jobs-box, section, article") || descriptionNode.parentElement || descriptionNode;
  }

  function looksLikeDescriptionMoreButton(el, descriptionSection) {
    const text = textOf(el).toLowerCase();
    const aria = clean(el.getAttribute?.("aria-label") || "").toLowerCase();
    const title = clean(el.getAttribute?.("title") || "").toLowerCase();
    const combined = `${text} ${aria} ${title}`.trim();
    if (!combined || combined.length > 140) return false;
    if (/more actions|report|share|send in a message|message|show less|see less|less/i.test(combined)) return false;
    if (!/(^|\s)(show|see)?\s*(more|mehr)($|\s)|…\s*more|\.\.\.\s*more|mehr anzeigen/i.test(combined)) return false;

    // Only expand controls that live in/next to the job description. This prevents LinkedIn's top-card
    // "More" menu from opening and prevents the page/list from scrolling.
    if (descriptionSection && !descriptionSection.contains(el)) {
      const descRect = rectOf(descriptionSection);
      const buttonRect = rectOf(el);
      const nearDescription =
        buttonRect.left >= descRect.left - 30 &&
        buttonRect.right <= descRect.right + 220 &&
        buttonRect.top >= descRect.top - 40 &&
        buttonRect.top <= descRect.bottom + 120;
      if (!nearDescription) return false;
    }

    return true;
  }

  async function clickDescriptionMoreButtons(container) {
    const descriptionSection = findDescriptionSection(container);
    if (!descriptionSection) return 0;

    const clickable = new Set();
    for (const el of safeQueryAll(descriptionSection, "button, [role='button'], a, span")) {
      if (!isVisible(el) || !looksLikeDescriptionMoreButton(el, descriptionSection)) continue;
      const button = el.closest("button, [role='button'], a") || el;
      if (button && descriptionSection.contains(button)) clickable.add(button);
    }

    let clicked = 0;
    for (const button of clickable) {
      try {
        button.click();
        clicked += 1;
        await sleep(160);
      } catch (_) {
        // LinkedIn may remove/re-render the button while expanding.
      }
    }
    return clicked;
  }

  async function expandHiddenJobDescription(container) {
    // Deliberately do not call scrollIntoView() or scroll the list/page. Only click the small "… more"
    // button inside the job-description section, if LinkedIn rendered one.
    for (let pass = 0; pass < 3; pass += 1) {
      const clicked = await clickDescriptionMoreButtons(container);
      if (!clicked) break;
      await sleep(250);
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
      /^BETA\b/i,
      /^Send in a message$/i,
      /^Share in a post$/i,
      /^Share$/i,
      /^Report this job$/i
    ];

    const removePatterns = [
      /^…\s*more$/i,
      /^\.\.\.\s*more$/i,
      /^show more$/i,
      /^show less$/i,
      /^see more$/i,
      /^see less$/i,
      /^mehr anzeigen$/i,
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
    return filterDescriptionText(allLines.slice(0, 180).join("\n"));
  }

  function textWithAttributes(el) {
    if (!el) return "";
    return clean([
      textOf(el),
      el.getAttribute?.("aria-label"),
      el.getAttribute?.("title")
    ].filter(Boolean).join("\n"));
  }

  function isInRightDetailArea(el) {
    if (!isVisible(el)) return false;
    const rect = rectOf(el);
    if (rect.width < 25 || rect.height < 8) return false;
    return rect.left > window.innerWidth * 0.28 && rect.right > window.innerWidth * 0.46;
  }

  function isLikelyOpenJobTitleLine(line, company = "") {
    const value = clean(line);
    if (!value || value.length < 4 || value.length > 180) return false;
    if (company && value.toLowerCase() === clean(company).toLowerCase()) return false;
    if (isNoiseLine(value) || META_LINE_RE.test(value) || LOCATION_LINE_RE.test(value)) return false;
    if (/^(full[- ]time|part[- ]time|contract|internship|temporary|volunteer|on-site|remote|hybrid)$/i.test(value)) return false;
    if (/^(take the next step|practice an interview|application status|your profile|see how you compare|job search faster)/i.test(value)) return false;
    return true;
  }

  function firstBestVisibleText(root, selectors, options = {}) {
    const roots = [root, document].filter(Boolean);
    const seen = new Set();
    const candidates = [];

    for (const base of roots) {
      for (const selector of selectors) {
        for (const el of safeQueryAll(base, selector)) {
          if (seen.has(el) || !isInRightDetailArea(el)) continue;
          seen.add(el);
          const rect = rectOf(el);
          const selectorScore = /h1|job-title|top-card__job-title|title/.test(selector) ? 120 : 30;
          for (const line of lines(textWithAttributes(el))) {
            if (options.predicate && !options.predicate(line)) continue;
            const roleBonus = ROLE_WORDS.test(line) ? 80 : 0;
            const topBonus = Math.max(0, 80 - Math.max(rect.top, 0) / 8);
            const sizeBonus = Math.min(rect.height, 80);
            candidates.push({ text: line, score: selectorScore + roleBonus + topBonus + sizeBonus });
          }
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return clean(candidates[0]?.text || "");
  }

  function topDetailLines(container) {
    const rect = rectOf(container);
    const cutoffY = Math.min(rect.top + 320, window.innerHeight * 0.72);
    const visibleTopNodes = safeQueryAll(container, "h1, h2, h3, a[href*='/company/'], span, div")
      .filter((el) => isInRightDetailArea(el))
      .filter((el) => {
        const r = rectOf(el);
        return r.top >= rect.top - 10 && r.top <= cutoffY;
      })
      .sort((a, b) => rectOf(a).top - rectOf(b).top || rectOf(a).left - rectOf(b).left);

    const out = [];
    for (const node of visibleTopNodes) {
      for (const line of lines(textWithAttributes(node))) {
        if (isNoiseLine(line)) continue;
        if (!out.includes(line)) out.push(line);
      }
      if (out.length >= 35) break;
    }

    if (out.length) return out;

    const all = lines(textOf(container));
    const stop = all.findIndex((line) => /^About the job$/i.test(line) || /^About this job$/i.test(line) || /^Job description$/i.test(line));
    return (stop >= 0 ? all.slice(0, stop) : all.slice(0, 35)).filter((line) => !isNoiseLine(line));
  }

  function getOpenJobTitleAndCompany() {
    const container = findDetailContainer();

    const companySelectors = [
      ".job-details-jobs-unified-top-card__company-name a",
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name a",
      ".jobs-unified-top-card__company-name",
      ".topcard__org-name-link",
      "[data-testid*='company']",
      "a[href*='/company/']"
    ];

    const titleSelectors = [
      ".job-details-jobs-unified-top-card__job-title h1",
      ".job-details-jobs-unified-top-card__job-title a",
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title h1",
      ".jobs-unified-top-card__job-title a",
      ".jobs-unified-top-card__job-title",
      ".top-card-layout__title",
      "[data-testid*='job-title']",
      "h1"
    ];

    const company = firstBestVisibleText(container, companySelectors, {
      predicate: (line) => !isNoiseLine(line) && !META_LINE_RE.test(line) && !LOCATION_LINE_RE.test(line)
    });

    let title = firstBestVisibleText(container, titleSelectors, {
      predicate: (line) => isLikelyOpenJobTitleLine(line, company)
    });

    // LinkedIn sometimes renders the title without the older job-title classes. In that case,
    // the top card usually appears as: company, then title, then location/meta. Use those visible
    // top-card lines as a fallback so the safe folder name does not become company-only.
    if (!title) {
      const visibleLines = topDetailLines(container);
      const companyIndex = company ? visibleLines.findIndex((line) => clean(line).toLowerCase() === company.toLowerCase()) : -1;
      const orderedPool = companyIndex >= 0 ? visibleLines.slice(companyIndex + 1).concat(visibleLines.slice(0, companyIndex)) : visibleLines;
      title = orderedPool.find((line) => isLikelyOpenJobTitleLine(line, company) && ROLE_WORDS.test(line)) ||
        orderedPool.find((line) => isLikelyOpenJobTitleLine(line, company)) || "";
    }

    // Last fallback: use the title from the selected job card on the left only when it matches the
    // currently opened job URL/id context well enough to be useful.
    if (!title) {
      const jobs = extractJobCards();
      const currentId = new URL(location.href).searchParams.get("currentJobId") || "";
      const selected = jobs.find((job) => currentId && job.link.includes(currentId)) || jobs[0];
      if (selected?.title && isLikelyOpenJobTitleLine(selected.title, company)) title = selected.title;
    }

    return { title: clean(title), company: clean(company) };
  }

  function getOpenJobSafeName() {
    const { title, company } = getOpenJobTitleAndCompany();
    if (!title && !company) return "";
    const combined = [company, title].filter(Boolean).join(" - ");
    return sanitizeDirectoryName(combined);
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

  async function handleRuntimeAction(type) {
    if (type === "PING" || type === "PING_V132") {
      return { ok: true, version: "1.3.2" };
    }

    if (type === "COPY_JOB_LIST") {
      const jobs = extractJobCards();
      if (!jobs.length) {
        return {
          ok: false,
          error: "No visible LinkedIn job cards were found. Scroll the left results pane slightly, then try again."
        };
      }
      return { ok: true, count: jobs.length, text: formatJobList(jobs) };
    }

    if (type === "COPY_OPEN_SAFE_JOB_NAME") {
      const name = getOpenJobSafeName();
      if (!name) {
        return {
          ok: false,
          error: "Could not find the open job company and title. Click a job first, then try again."
        };
      }
      return { ok: true, count: 1, text: name };
    }

    if (type === "REMOVE_LISTED_JOBS") {
      const result = await removeListedJobs();
      if (!result.total) {
        return {
          ok: false,
          error: "No visible LinkedIn job cards were found. Scroll the left results pane slightly, then try again."
        };
      }
      if (!result.removed) {
        return {
          ok: false,
          error: "Found job cards, but no visible X/dismiss buttons were detected on them."
        };
      }
      return { ok: true, count: result.removed, removed: result.removed, skipped: result.skipped, total: result.total };
    }

    if (type === "COPY_JOB_DETAILS") {
      const details = await getOpenJobDetails();
      if (!details.text || details.text.length < 80) {
        return { ok: false, error: "Could not find the open job details. Click a job first or highlight the text you want copied." };
      }
      return { ok: true, count: details.count, text: details.text };
    }

    return { ok: false, error: "Unknown action." };
  }

  window.__linkedinJobCopierV132Api = {
    version: "1.3.2",
    handle: handleRuntimeAction
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleRuntimeAction(message?.type)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
    return true;
  });

})();
