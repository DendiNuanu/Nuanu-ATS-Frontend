/**
 * Nuanu Interview Transcriber — content script (meet.google.com).
 *
 * Captures Google Meet's built-in live captions (the CC feature) from the
 * DOM and streams finalized lines to the Nuanu ATS. This is the same
 * mechanism tools like Tactiq use — no speech-to-text of our own, no bot
 * participant; it only reads captions already rendered in HR's own browser.
 *
 * ── How caption detection works ────────────────────────────────────────────
 * Google does NOT publish stable selectors for the captions overlay, and it
 * randomizes class names on every release — so class-based selectors rot
 * quickly. We therefore detect the container STRUCTURALLY, from stable
 * accessibility signals, with fallbacks:
 *
 *   1. Live regions / role="region" whose aria-label mentions
 *      captions|subtitles (works in any UI language).
 *   2. Any live region below the video band (polite OR assertive).
 *   3. Legacy/deprecated selectors, kept as cheap fallbacks.
 *   4. A bounded geometric heuristic (short text near the bottom).
 *
 * Open shadow roots are searched too. An empty container is accepted so the
 * MutationObserver attaches before the first caption line renders, and the
 * container is re-located if Meet re-mounts it mid-session. "Detected" only
 * flips true once real caption TEXT is parsed — never merely because a node
 * was found.
 *
 * Every failure is logged with a clear prefix [nuanu-transcriber] so a
 * broken selector is obvious in DevTools and quick to patch. Debug helpers:
 * __nuanuDebugCaptions(), __nuanuDebugDump(), __nuanuDebugRescan().
 *
 * ── Line finalization ──────────────────────────────────────────────────────
 * Meet refines the current caption line as speech continues (the same line
 * element gets rewritten). We debounce: a line is considered final after
 * SETTLE_MS of no changes, or immediately when a new line starts. Finalized
 * lines are batched and POSTed every FLUSH_MS.
 */

(() => {
  "use strict";

  const ATS_BASE = "https://hr.ats.new.nuanu.site";
  const SETTLE_MS = 1500; // quiet period before a caption line is "final"
  const FLUSH_MS = 5000; // batch send interval
  const RELOCATE_INTERVAL_MS = 5000; // re-scan for caption container
  const DIAGNOSTICS_DELAY_MS = 15000; // no captions by then → dump DOM candidates
  const MUTATION_LOG_THROTTLE_MS = 2000; // observer heartbeat log interval
  const LOG_PREFIX = "[nuanu-transcriber]";

  // ── Session state (mirrored to chrome.storage for popup/badge) ──────────
  let session = {
    active: false,
    sessionId: null,
    candidateId: null,
    candidateName: null,
    userEmail: null,
    userPassword: null, // per-user credential, never shared/hardcoded
    startedAt: null,
    lineCount: 0,
  };

  // ── Caption capture state ────────────────────────────────────────────────
  let captionsContainer = null; // current best-guess captions wrapper
  let observer = null; // MutationObserver on captionsContainer
  let relocateTimer = null;
  let pendingLine = null; // { speaker, text, firstSeen, lastSeen }
  let settleTimer = null;
  let outbox = []; // finalized lines awaiting batch POST
  let flushTimer = null;
  let bannerEl = null;
  let captionsEverDetected = false; // true once captions hooked this session
  let diagnosticsDumped = false; // one-shot DOM diagnostics flag
  let lastMutationLogAt = 0; // throttled observer heartbeat timestamp
  let blindCcClicks = 0; // CC clicks without aria-pressed feedback (max 2)
  let lastAlreadyOnLogAt = 0; // throttle for "captions already on" log

  // ── Logging ──────────────────────────────────────────────────────────────
  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }
  function warn(...args) {
    console.warn(LOG_PREFIX, ...args);
  }
  function error(...args) {
    console.error(LOG_PREFIX, ...args);
  }

  // ── Storage sync ─────────────────────────────────────────────────────────
  function persistSession() {
    chrome.storage.local.set({ session: { ...session } });
  }

  // ── Consent banner (visible to ALL participants via screen share) ───────
  // Note: a DOM banner is only visible to other participants if HR shares
  // the screen/tab; the primary consent mechanism is HR verbally informing
  // the candidate, per the agreed policy. The banner makes it unmistakable
  // to the HR user that transcription is running.
  function showBanner() {
    if (bannerEl) return;
    bannerEl = document.createElement("div");
    bannerEl.id = "nuanu-transcriber-banner";
    bannerEl.textContent = `🔴 Transcribing for: ${session.candidateName} — this interview is being transcribed for HR record-keeping. Please inform all participants.`;
    Object.assign(bannerEl.style, {
      position: "fixed",
      top: "70px",
      right: "16px",
      zIndex: "99999",
      background: "#7f1d1d",
      color: "#fff",
      padding: "10px 14px",
      borderRadius: "8px",
      fontSize: "13px",
      fontFamily: "system-ui, sans-serif",
      maxWidth: "340px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
      lineHeight: "1.4",
    });
    document.body.appendChild(bannerEl);
    log("Consent banner shown");
  }

  function hideBanner() {
    if (bannerEl) {
      bannerEl.remove();
      bannerEl = null;
      log("Consent banner hidden");
    }
  }

  // ── Debug logging ─────────────────────────────────────────────────────────
  // Caption selectors rot every time Google reshuffles Meet's DOM. These logs
  // (prefix [nuanu-transcriber]) make the failure obvious in DevTools, and the
  // __nuanuDebug*() helpers below turn a fresh DOM dump into a copy-paste fix.
  // They are cheap: the periodic probe path only logs on state CHANGES.
  const DEBUG = true;

  function dlog(...args) {
    if (DEBUG) log(...args);
  }

  // ── Caption container location (resilient, layered) ─────────────────────
  // Detection is deliberately STRUCTURE-first: Google randomizes every class
  // name (a4cQT, ygicle, …), so class-based selectors — the v1 approach —
  // rot within weeks. What survives a Meet release is the accessibility
  // contract: the captions overlay is a live region named "Captions" /
  // "Subtitles" (aria-label and/or aria-live). We try, in order:
  //
  //   1. Caption-named live regions / regions (aria-label ~ captions|subtitles).
  //   2. Any live region (polite OR assertive) below the video band.
  //   3. Named regions (role="region" with a caption label).
  //   4. Legacy/deprecated selectors, kept as a cheap fallback.
  //   5. Heuristic: short text block pinned to the bottom of the main column.
  //
  // A container is accepted even while EMPTY, so the observer attaches BEFORE
  // the first caption line renders. (v1 required non-empty text at scan time,
  // so it could never hook until after a line already existed and, worse,
  // treated merely finding a node as "detected".)
  const CAPTION_HINT_RE = /(caption|subtitle|subtitel|closed\s*cap|teks\s*(langsung|waktu)|subjudul)/i;

  const CAPTION_CONTAINER_SELECTORS = [
    // Tier 1 — textual live regions (the modern Meet contract).
    'div[aria-live][aria-label*="captions" i]',
    'div[aria-live][aria-label*="subtitles" i]',
    'div[aria-live][aria-label*="subtitel" i]',
    // Tier 2 — named regions.
    '[role="region"][aria-label*="captions" i]',
    '[role="region"][aria-label*="subtitles" i]',
    '[role="region"][aria-label*="subtitel" i]',
    '[aria-label*="captions" i]',
    '[aria-label*="subtitles" i]',
    '[aria-label*="subtitel" i]',
    // Tier 1 (broad) — legacy/deprecated shapes, cheap to keep. Generic
    // live-region selectors deliberately live in findCaptionsContainer() so
    // they can be geometry-filtered there.
    "#captions",
    'div[class*="captions" i]',
    'div[class*="subtitle" i]',
  ];

  // Diagnostics-only: a much wider net used by the one-shot DOM dump so a
  // future selector fix is a copy-paste job.
  const CAPTION_CONTAINER_SELECTORS_WIDE = [
    '[aria-live]',
    '[role="region"]',
    '[aria-label*="caption" i]',
    '[aria-label*="subtitle" i]',
    '[aria-label*="subtitel" i]',
    '[class*="caption" i]',
    '[class*="subtitle" i]',
    '[class*="subtitel" i]',
    '[class*="live" i]',
  ];

  // Elements that merely *announce* meeting events ("X joined the meeting",
  // "Recording started") also live in live regions — never treat them as
  // captions, or we would hook the wrong node and show "detected" while
  // capturing nothing.
  const ANNOUNCER_SELECTOR =
    '[role="status"], [role="alert"], [aria-label*="notification" i]';

  function isAnnouncer(el) {
    try {
      return !!el.closest(ANNOUNCER_SELECTOR);
    } catch (err) {
      return false;
    }
  }

  function hasCaptionHint(el) {
    const label = (el.getAttribute && el.getAttribute("aria-label")) || "";
    return CAPTION_HINT_RE.test(label);
  }

  // Broad positional gate (v1's was far too tight: height < 200 and top > 40%
  // rejected Meet's actual overlay). The captions overlay is wide, its top
  // edge sits in the lower half of the viewport, and it is never the whole
  // screen. Text may be empty — we still want to attach pre-first-line.
  function looksLikeCaptions(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    if (rect.height > 0.6 * window.innerHeight) return false;
    if (rect.top < window.innerHeight * 0.35) return false;
    const text = (el.textContent || "").trim();
    if (text.length >= 800) return false;
    return true;
  }

  // querySelectorAll wrapper that also walks open shadow roots — Meet renders

  // querySelectorAll wrapper that also walks open shadow roots — Meet renders
  // parts of its UI (video grid, controls) in shadow DOM, so a plain
  // document scan misses nodes inside them.
  function queryAllSafe(selector, root) {
    const out = [];
    const walk = (node) => {
      try {
        node.querySelectorAll(selector).forEach((el) => out.push(el));
      } catch (err) {
        /* invalid selector on this root — skip */
      }
      let children;
      try {
        children = node.querySelectorAll("*");
      } catch (err) {
        return;
      }
      for (const child of children) {
        if (child.shadowRoot) walk(child.shadowRoot);
      }
    };
    walk(root || document);
    return out;
  }

  function queryFirstSafe(selector, root) {
    const all = queryAllSafe(selector, root);
    return all.length ? all[0] : null;
  }

  // Keep only the deepest of a set of nested matches (the innermost wrapper
  // is the tightest region to observe).
  function dedupeByDeepest(elements) {
    const bounded = elements.slice(0, 200);
    return bounded.filter(
      (el) => !bounded.some((other) => other !== el && other.contains(el)),
    );
  }

  // Best-effort caption search, most-specific tier first.
  function findCaptionsContainer() {
    const main =
      document.querySelector('[role="main"]') ||
      document.querySelector("main") ||
      document.body;

    // Tier 1 — explicit caption-named live regions / regions (structural,
    // survives class-name churn). Empty ones are accepted.
    const named = queryAllSafe(
      '[aria-live][aria-label*="caption" i], [aria-live][aria-label*="subtitle" i], ' +
      '[aria-live][aria-label*="subtitel" i], [role="region"][aria-label*="caption" i], ' +
      '[role="region"][aria-label*="subtitle" i], [role="region"][aria-label*="subtitel" i]',
    );
    for (const el of named) {
      if (el !== document.body && !isAnnouncer(el)) return el;
    }

    // Tier 2 — any live region below the video band (polite OR assertive).
    const belowVideo = [];
    for (const el of queryAllSafe('[aria-live="polite"], [aria-live="assertive"]')) {
      if (el === document.body || isAnnouncer(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top >= window.innerHeight * 0.35) belowVideo.push(el);
    }
    if (belowVideo.length) return belowVideo[0];

    // Tier 3 — legacy/deprecated selectors.
    for (const selector of CAPTION_CONTAINER_SELECTORS) {
      const el = queryFirstSafe(selector);
      if (el && !isAnnouncer(el)) return el;
    }

    // Tier 4 — heuristic text block pinned to the bottom of the main column.
    // Bounded so the 5s sweep stays cheap even when captions are off.
    const MAX_HEURISTIC_CHECKS = 1500;
    const heuristics = [];
    let checked = 0;
    for (const el of main.querySelectorAll("div, span, p")) {
      if (++checked > MAX_HEURISTIC_CHECKS) break;
      if (isAnnouncer(el)) continue;
      const text = (el.textContent || "").trim();
      if (text.length === 0 || text.length >= 800) continue;
      if (hasCaptionHint(el) || looksLikeCaptions(el)) heuristics.push(el);
    }
    const deepest = dedupeByDeepest(heuristics);
    if (deepest.length) return deepest[0];

    return null;
  }

  // ── Container liveness / fast re-scan ────────────────────────────────────
  function isContainerAlive(el) {
    // isConnected is true for nodes in open shadow roots too, unlike
    // documentElement.contains() — important since Meet uses shadow DOM.
    return !!el && el.isConnected !== false;
  }

  // Cheap re-scan used mid-capture: reuses the tier-1 structural query only.
  // Enough to catch Meet swapping its captions node between lines without
  // waiting for the 5s relocate sweep.
  function locateContainerQuick() {
    const found = queryFirstSafe(
      '[aria-live][aria-label*="caption" i], [aria-live][aria-label*="subtitle" i], ' +
      '[aria-live][aria-label*="subtitel" i], [role="region"][aria-label*="caption" i], ' +
      '[role="region"][aria-label*="subtitle" i], [role="region"][aria-label*="subtitel" i]',
    );
    if (!found || isAnnouncer(found)) return null;
    if (captionsContainer && captionsContainer.contains(found)) return captionsContainer;
    return found;
  }

  // ── Pre-caption probe ────────────────────────────────────────────────────
  // Runs every 1s ONLY until the first caption text is parsed. It grabs the
  // (possibly empty) captions container as soon as Meet mounts it, keeps
  // pressing CC, and parses on each tick — this is what fixes "CC on, caption
  // visible, but 0 lines captured": the observer is attached before the first
  // line and never relies on a single text-bearing container existing.
  let probeTimer = null;
  const PROBE_INTERVAL_MS = 1000;

  function startProbeLoop() {
    if (probeTimer) return;
    probeTimer = setInterval(() => {
      if (captionsEverDetected) {
        stopProbeLoop();
        return;
      }
      const found = locateContainerQuick() || findCaptionsContainer();
      if (found && found !== captionsContainer) {
        captionsContainer = found;
        attachObserver();
        dlog("Captions container acquired during probe:", describeEl(found));
      }
      if (captionsContainer) handleCaptionMutation();
      if (!captionsEverDetected) ensureCaptionsOn();
    }, PROBE_INTERVAL_MS);
  }

  function stopProbeLoop() {
    if (probeTimer) {
      clearInterval(probeTimer);
      probeTimer = null;
    }
  }

  function relocateCaptionsContainer(reason) {
    // Missed a re-mount? Reconnect on the periodic sweep.
    if (captionsContainer && !isContainerAlive(captionsContainer)) {
      dlog("Captions container detached from DOM — re-scanning");
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      captionsContainer = null;
    }

    const found = findCaptionsContainer();
    if (found !== captionsContainer) {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      captionsContainer = found;
      if (captionsContainer) {
        dlog("Captions container located via", reason, "→", describeEl(captionsContainer));
        attachObserver();
      } else if (session.active) {
        dlog(
          "Could not locate captions container (" + reason + ").",
          "Live captions may be OFF, or Google changed the Meet DOM.",
        );
      }
    }

    if (!session.active) return;

    // Parse immediately if we already have a container (captions may have
    // rendered between sweeps).
    if (captionsContainer) handleCaptionMutation();

    // "Detected" now means text parsed, NOT merely a node found. Until then
    // keep pressing CC and keep the fast probe running.
    if (!captionsEverDetected) {
      ensureCaptionsOn();
      startProbeLoop();
    } else {
      stopProbeLoop();
    }
    maybeDumpCaptionDiagnostics();
  }

  // ── Manual helpers (paste in the Meet tab's DevTools console) ────────────
  //   __nuanuDebugCaptions() — print live detection state
  //   __nuanuDebugDump()     — dump every caption-ish element (for a fix)
  //   __nuanuDebugRescan()   — force an immediate re-scan
  window.__nuanuDebugCaptions = function () {
    const dump = {
      sessionActive: session.active,
      captionsDetected: captionsEverDetected,
      container: captionsContainer ? describeEl(captionsContainer) : null,
      containerAlive: isContainerAlive(captionsContainer),
      parsedLines: captionsContainer ? extractLines(captionsContainer).length : 0,
      pendingLine: pendingLine ? pendingLine.text.slice(0, 80) : null,
      outbox: outbox.length,
      lineCount: session.lineCount,
    };
    warn("Caption debug snapshot:", dump);
    return dump;
  };

  window.__nuanuDebugRescan = function () {
    relocateCaptionsContainer("manual rescan");
    return captionsContainer ? describeEl(captionsContainer) : null;
  };

  window.__nuanuDebugDump = function () {
    const candidates = [];
    for (const el of queryAllSafe(CAPTION_CONTAINER_SELECTORS_WIDE.join(","))) {
      const rect = el.getBoundingClientRect();
      candidates.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        cls: typeof el.className === "string" ? el.className.slice(0, 80) : null,
        ariaLive: el.getAttribute("aria-live"),
        ariaLabel: el.getAttribute("aria-label") || null,
        role: el.getAttribute("role") || null,
        text: (el.textContent || "").trim().slice(0, 80) || null,
        pos: `top:${Math.round(rect.top)} h:${Math.round(rect.height)} w:${Math.round(rect.width)}`,
        inShadow: !!(el.getRootNode && el.getRootNode() !== document),
      });
    }
    warn("Caption DOM dump (" + candidates.length + " candidates):", candidates);
    return candidates;
  };

  // One-shot diagnostics: if captions are still not detected ~15s after
  // session start, print the DOM candidates plus any open shadow roots — so a
  // future selector update is a copy-paste job, not guesswork.
  function maybeDumpCaptionDiagnostics() {
    if (diagnosticsDumped) return;
    if (!session.startedAt || Date.now() - session.startedAt < DIAGNOSTICS_DELAY_MS) {
      return;
    }
    diagnosticsDumped = true;
    if (captionsEverDetected) return;
    warn(
      `Captions still not detected after ~${Math.round(DIAGNOSTICS_DELAY_MS / 1000)}s.`,
      "Run __nuanuDebugDump() in this tab's console and send the output to the",
      "developer to update CAPTION_CONTAINER_SELECTORS in content.js.",
    );
    try {
      window.__nuanuDebugDump();
    } catch (err) {
      /* non-fatal */
    }
  }

  function describeEl(el) {
    if (!el) return "(null)";
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = el.className && typeof el.className === "string"
      ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
      : "";
    const label =
      el.getAttribute && el.getAttribute("aria-label")
        ? `[aria-label="${el.getAttribute("aria-label").slice(0, 40)}"]`
        : "";
    return `${tag}${id}${cls}${label}`;
  }

  // ── Caption line extraction ──────────────────────────────────────────────
  // Meet renders each speaker turn as a group: a speaker-name label inside
  // its own wrapper element, followed by that speaker's caption text in a
  // sibling wrapper. A text node is classified as a speaker LABEL only when
  // three independent signals agree (v1 used only the first signal, which
  // swallowed short unpunctuated speech like "This is" as a speaker name):
  //
  //   1. Shape — short (≤ 40 chars) and no sentence-ending punctuation.
  //   2. Structure — the text sits ALONE in its own wrapper element and a
  //      FOLLOWING sibling wrapper contains text (the caption it labels).
  //      Genuine caption lines never have caption text in a following
  //      sibling wrapper, so real speech fails this check.
  //   3. Color — Meet draws caption text in white and speaker names in the
  //      speaker's assigned color, so white-ish text is never a label.
  //
  // Every check fails SAFE: when in doubt the text is kept as a caption
  // line (worst case the speaker attribution is off), never dropped.
  let lastSpeaker = "Unknown";

  function visibleTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.textContent || "").trim();
      if (!text) continue;
      const parent = node.parentElement;
      if (!parent || parent.getAttribute("aria-hidden") === "true") continue;
      nodes.push({ node, text });
    }
    return nodes;
  }

  function extractLines(container) {
    const entries = visibleTextNodes(container);
    const lines = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (isSpeakerLabel(entry, container)) {
        lastSpeaker = entry.text;
      } else {
        lines.push({ speaker: lastSpeaker, text: entry.text });
      }
    }
    return lines;
  }

  function isSpeakerLabel(entry, container) {
    const text = entry.text;

    // 1. Shape: labels are short and carry no sentence punctuation.
    if (text.length > 40) return false;
    if (/[.!?…]["')\]]?$/.test(text)) return false;

    // 2. Structure: the text must be alone in its own wrapper (the highest
    //    ancestor below the container holding ONLY this text), and a
    //    following sibling of that wrapper must contain text.
    const wrapper = ownWrapperOf(entry.node, container);
    if (!wrapper || !followingSiblingHasText(wrapper)) return false;

    // 3. Color: caption text renders white; speaker names are colored.
    return !isWhiteish(entry.node.parentElement);
  }

  function ownWrapperOf(textNode, container) {
    let own = textNode.parentElement;
    if (!own || own === container) return null; // text directly in container — no wrapper
    let anc = own.parentElement;
    while (anc && anc !== container) {
      if (visibleTextNodes(anc).length > 1) break;
      own = anc;
      anc = anc.parentElement;
    }
    return own;
  }

  function followingSiblingHasText(wrapperEl) {
    let sib = wrapperEl.nextElementSibling;
    while (sib) {
      if (visibleTextNodes(sib).length > 0) return true;
      sib = sib.nextElementSibling;
    }
    return false;
  }

  function isWhiteish(el) {
    try {
      const m = getComputedStyle(el).color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return false;
      return +m[1] > 230 && +m[2] > 230 && +m[3] > 230;
    } catch (err) {
      return false; // can't tell → don't reject on color alone
    }
  }

  // ── Line finalization (debounce) ─────────────────────────────────────────
  function handleCaptionMutation() {
    if (!session.active || !captionsContainer) return;

    // The container may have been replaced by Meet since we attached (this is
    // what silently killed capture in v1). Re-locate before giving up.
    if (!isContainerAlive(captionsContainer)) {
      dlog("Observed container detached — re-locating");
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      captionsContainer = locateContainerQuick() || findCaptionsContainer();
      if (captionsContainer) attachObserver();
      if (!captionsContainer) return;
    }

    const lines = extractLines(captionsContainer);
    if (lines.length === 0) return; // captured container but no text yet

    // Truth-based detection: we are only "detected" once real caption text
    // has been parsed — not merely because a node was found.
    if (!captionsEverDetected) {
      captionsEverDetected = true;
      stopProbeLoop();
      log("Captions DETECTED — text is being read from", describeEl(captionsContainer));
    }

    // Throttled heartbeat: proves the observer fires and lines parse, so
    // "observer never fired" vs "fired but nothing finalized" is visible
    // in the console without log spam on every caption refinement.
    const now = Date.now();
    if (now - lastMutationLogAt >= MUTATION_LOG_THROTTLE_MS) {
      lastMutationLogAt = now;
      dlog("Caption activity:", lines.length, "line(s) parsed:", lines.slice(-1)[0].text.slice(0, 80));
    }

    // Meet keeps only the last couple of lines in the DOM. The newest line
    // is the "live" one being refined; anything before it is final.
    const newest = lines[lines.length - 1];
    const settled = lines.slice(0, -1);

    for (const line of settled) {
      finalizeLine(line);
    }

    // Debounce the newest line.
    if (
      pendingLine &&
      (pendingLine.speaker !== newest.speaker || pendingLine.text !== newest.text)
    ) {
      // The live line changed content — if the speaker changed, the old
      // pending line is final; if only text refined, replace pending.
      if (pendingLine.speaker !== newest.speaker) {
        finalizeLine(pendingLine);
      }
      pendingLine = { ...newest, firstSeen: Date.now() };
    } else if (!pendingLine) {
      pendingLine = { ...newest, firstSeen: Date.now() };
    } else {
      pendingLine.text = newest.text; // refined in place
    }

    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (pendingLine) {
        finalizeLine(pendingLine);
        pendingLine = null;
      }
    }, SETTLE_MS);
  }

  function finalizeLine(line) {
    const text = (line.text || "").trim();
    if (!text) return;
    // Skip exact duplicate of the last finalized line (Meet sometimes
    // re-renders the same finalized line).
    const last = outbox.length ? outbox[outbox.length - 1] : null;
    const lastSent = !last ? lastFinalizedSent : null;
    const candidate = `${line.speaker}\u0000${text}`;
    if (last && `${last.speaker}\u0000${last.text}` === candidate) return;
    if (lastSent === candidate) return;

    outbox.push({
      speaker: line.speaker || "Unknown",
      text: text.slice(0, 2000),
      timestamp: Date.now(),
    });
    session.lineCount += 1;
    persistSession();
    log("Line finalized:", line.speaker, "→", text.slice(0, 80));
  }

  let lastFinalizedSent = null;

  // ── Batched upload ───────────────────────────────────────────────────────
  async function flushOutbox() {
    if (!session.active || outbox.length === 0) return;
    const batch = outbox.splice(0, outbox.length);
    lastFinalizedSent = batch.length
      ? `${batch[batch.length - 1].speaker}\u0000${batch[batch.length - 1].text}`
      : lastFinalizedSent;

    try {
      const res = await fetch(`${ATS_BASE}/api/interview-transcripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: session.candidateId,
          sessionId: session.sessionId,
          userEmail: session.userEmail,
          userPassword: session.userPassword,
          lines: batch,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        error("Chunk upload failed:", res.status, data.error || "");
        // Re-queue the batch at the front so lines aren't lost (best effort,
        // capped to avoid unbounded growth).
        outbox = batch.concat(outbox).slice(0, 1000);
        if (res.status === 401) {
          error("Credentials rejected — stop the session and log in again.");
        }
      } else {
        log(`Uploaded ${batch.length} lines`);
      }
    } catch (err) {
      error("Chunk upload network error:", err);
      outbox = batch.concat(outbox).slice(0, 1000);
    }
  }

  function startFlushLoop() {
    stopFlushLoop();
    flushTimer = setInterval(() => void flushOutbox(), FLUSH_MS);
  }

  function stopFlushLoop() {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  }

  // ── Auto-enable captions (best effort, retried until detected) ───────────
  const CAPTION_BUTTON_SELECTORS = [
    'button[aria-label*="caption" i]',
    'button[aria-label*="subtitle" i]',
    // Indonesian UI: "Aktifkan subtitel (Ctrl+Shift+C)".
    'button[aria-label*="subtitel" i]',
    // Locale-independent: Meet appends the keyboard-shortcut hint
    // "(Ctrl+Shift+C)" to the CC button's aria-label in every UI language.
    'button[aria-label*="ctrl+shift+c" i]',
    'button[aria-pressed]', // broad fallback; filtered below
  ];

  // Lowercase keywords that identify the CC button by its aria-label.
  // "subtitel" covers the Indonesian UI; "ctrl+shift+c" works in any locale.
  const CAPTION_BUTTON_LABEL_KEYWORDS = [
    "caption",
    "subtitle",
    "subtitel",
    "cc",
    "ctrl+shift+c",
  ];

  function findCaptionToggleButton() {
    for (const selector of CAPTION_BUTTON_SELECTORS) {
      try {
        const buttons = document.querySelectorAll(selector);
        for (const btn of buttons) {
          const label = (btn.getAttribute("aria-label") || "").toLowerCase();
          if (CAPTION_BUTTON_LABEL_KEYWORDS.some((kw) => label.includes(kw))) {
            return btn;
          }
        }
      } catch (err) {
        warn("Caption button selector threw:", selector, err);
      }
    }
    return null;
  }

  function ensureCaptionsOn() {
    const btn = findCaptionToggleButton();
    if (!btn) {
      warn(
        "Caption (CC) toggle button not found — cannot auto-enable captions.",
        "Turn on captions manually with the CC button; capture will start automatically.",
      );
      return;
    }
    const pressed = btn.getAttribute("aria-pressed");
    if (pressed === "true") {
      const now = Date.now();
      if (now - lastAlreadyOnLogAt > 30000) {
        lastAlreadyOnLogAt = now;
        log("Live captions already on — waiting for caption text to render (speak to test)");
      }
      return;
    }
    if (pressed !== "false") {
      // No aria-pressed feedback available. Cap blind clicks so the retry
      // loop can never toggle captions back off.
      if (blindCcClicks >= 2) {
        warn(
          "CC button has no aria-pressed state and two clicks did not enable captions.",
          "Enable captions manually with the CC button; capture will start automatically.",
        );
        return;
      }
      blindCcClicks += 1;
    }
    btn.click();
    log("Clicked the CC button to enable live captions");
  }

  // ── MutationObserver wiring ──────────────────────────────────────────────
  function attachObserver() {
    if (!captionsContainer) return;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    observer = new MutationObserver(() => handleCaptionMutation());
    observer.observe(captionsContainer, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    dlog("MutationObserver attached to", describeEl(captionsContainer));
    // Parse once immediately in case text is already rendered.
    handleCaptionMutation();
  }

  function startRelocateLoop() {
    stopRelocateLoop();
    // Sweep immediately so captions already on screen are read without
    // waiting a full interval, then keep sweeping.
    relocateCaptionsContainer("loop start");
    relocateTimer = setInterval(
      () => relocateCaptionsContainer("periodic re-scan"),
      RELOCATE_INTERVAL_MS,
    );
  }

  function stopRelocateLoop() {
    if (relocateTimer) {
      clearInterval(relocateTimer);
      relocateTimer = null;
    }
  }

  // ── Session control ──────────────────────────────────────────────────────
  async function startSession(payload) {
    if (session.active) {
      warn("Session already active — ignoring start request");
      return { ok: false, error: "Session already active" };
    }
    session = {
      active: true,
      sessionId: `meet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      candidateId: payload.candidateId,
      candidateName: payload.candidateName,
      userEmail: payload.userEmail,
      userPassword: payload.userPassword,
      startedAt: Date.now(),
      lineCount: 0,
    };
    persistSession();
    lastSpeaker = "Unknown";
    pendingLine = null;
    outbox = [];
    lastFinalizedSent = null;
    captionsEverDetected = false;
    diagnosticsDumped = false;
    blindCcClicks = 0;
    stopProbeLoop();

    showBanner();
    // startRelocateLoop() performs an immediate sweep, then repeats; the 1s
    // probe below keeps pressing CC and parsing until the first caption line
    // is read. ensureCaptionsOn() is retried inside both paths but is a no-op
    // once captions are on, so we never fight a user who turns captions off.
    startRelocateLoop();
    startProbeLoop();
    startFlushLoop();
    log(
      `Session started for ${session.candidateName} (${session.candidateId}), sessionId=${session.sessionId}`,
    );
    return { ok: true, sessionId: session.sessionId };
  }

  async function stopSession(sendComplete = true) {
    if (!session.active) return { ok: true, alreadyInactive: true };
    clearTimeout(settleTimer);
    if (pendingLine) {
      finalizeLine(pendingLine);
      pendingLine = null;
    }

    const current = { ...session };
    stopRelocateLoop();
    stopProbeLoop();
    stopFlushLoop();
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    captionsContainer = null;
    hideBanner();

    // Flush remaining lines, then send the complete signal.
    await flushOutbox();

    // Mark inactive only AFTER the final transcript batch has been flushed.
    session = { ...session, active: false };
    persistSession();
    if (sendComplete) {
      try {
        const res = await fetch(`${ATS_BASE}/api/interview-transcripts/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidateId: current.candidateId,
            sessionId: current.sessionId,
            userEmail: current.userEmail,
            userPassword: current.userPassword,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          error("Session-complete signal failed:", res.status, data.error || "");
        } else {
          log(
            "Session complete. Summarized:",
            data.summarized,
            "provider:",
            data.provider,
          );
        }
      } catch (err) {
        error("Session-complete network error:", err);
      }
    }
    log(`Session stopped — ${current.lineCount} lines captured`);
    return { ok: true, lineCount: current.lineCount };
  }

  // ── Message handling (from popup) ────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "START_SESSION") {
      startSession(message.payload).then(sendResponse);
      return true;
    }
    if (message.type === "STOP_SESSION") {
      stopSession(true).then(sendResponse);
      return true;
    }
    if (message.type === "SESSION_STATE") {
      sendResponse({
        active: session.active,
        candidateName: session.candidateName,
        lineCount: session.lineCount,
        sessionId: session.sessionId,
        captionsDetected: captionsEverDetected,
      });
      return false;
    }
    return false;
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────
  // If the tab closes / navigates away mid-session, best-effort final flush.
  // (pagehide is more reliable than unload in modern Chrome.)
  window.addEventListener("pagehide", () => {
    if (session.active) {
      // Synchronous-ish: flush what we can. The complete signal may not
      // make it; the ATS marks abandoned sessions via the Stop button or
      // stays "in_progress" until an HR user retries.
      void flushOutbox();
    }
  });

  // Restore an active session after extension reload (rare) — do NOT
  // auto-restart capture; the HR user re-presses Start.
  chrome.storage.local.get(["session"], (data) => {
    if (data && data.session && data.session.active) {
      warn(
        "Found an active session in storage from a previous page load.",
        "Capture is NOT running — press Start in the popup to resume.",
      );
      // Mark inactive so the badge/popup reflect reality.
      session = { ...data.session, active: false };
      persistSession();
    }
  });

  log("Content script loaded on", location.href);
})();
