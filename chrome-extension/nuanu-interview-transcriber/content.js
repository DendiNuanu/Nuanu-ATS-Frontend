/**
 * Nuanu Interview Transcriber — content script (meet.google.com).
 *
 * Captures Google Meet's built-in live captions (the CC feature) from the
 * DOM and streams finalized lines to the Nuanu ATS. This is the same
 * mechanism tools like Tactiq use — no speech-to-text of our own, no bot
 * participant; it only reads captions already rendered in HR's own browser.
 *
 * ── How caption detection works ────────────────────────────────────────────
 * Google does NOT publish stable selectors for the captions overlay, and the
 * DOM structure changes periodically. Instead of one brittle selector we use
 * a layered strategy, re-checked whenever the page mutates:
 *
 *   1. Known historical containers (aria/role based).
 *   2. A document-wide scan for elements whose class matches Meet's caption
 *      text styling, falling back to any element that looks like a caption
 *      line by heuristics (short text blocks appearing near the bottom).
 *
 * Every failure is logged with a clear prefix [nuanu-transcriber] so a
 * broken selector is obvious in DevTools and quick to patch.
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

  // ── Caption container location (resilient, layered) ─────────────────────
  const CAPTION_CONTAINER_SELECTORS = [
    // Historical/known containers — try these first.
    'div[aria-live="assertive"]',
    "#captions",
    "div.captions",
    // Meet has used a wrapper with class containing "captions" at times.
    'div[class*="captions"]',
  ];

  function findCaptionsContainer() {
    for (const selector of CAPTION_CONTAINER_SELECTORS) {
      try {
        const el = document.querySelector(selector);
        if (el && el.textContent && el.textContent.trim().length > 0) {
          return el;
        }
      } catch (err) {
        warn("Selector threw (likely invalid CSS):", selector, err);
      }
    }

    // Heuristic fallback: look for elements whose class names suggest Meet's
    // caption text styling. Meet's caption lines historically render inside
    // elements with classes like "KR6ae" or similar obfuscated names, but the
    // container often has role/aria hints. Scan for any element with
    // aria-live (Meet marks the captions region live for screen readers).
    const liveRegions = document.querySelectorAll('[aria-live]');
    for (const el of liveRegions) {
      if (el.textContent && el.textContent.trim().length > 0 && looksLikeCaptions(el)) {
        return el;
      }
    }

    return null;
  }

  function looksLikeCaptions(el) {
    // Heuristic: caption regions are near the bottom of the viewport, have
    // short-ish text, and are not the chat or reaction panels.
    const rect = el.getBoundingClientRect();
    const text = (el.textContent || "").trim();
    return (
      rect.height > 0 &&
      rect.height < 200 &&
      rect.top > window.innerHeight * 0.4 &&
      text.length > 0 &&
      text.length < 600
    );
  }

  function relocateCaptionsContainer(reason) {
    const found = findCaptionsContainer();
    if (found !== captionsContainer) {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      captionsContainer = found;
      if (captionsContainer) {
        captionsEverDetected = true;
        attachObserver();
        log("Captions container located via", reason, "→", describeEl(captionsContainer));
      } else if (session.active) {
        warn(
          "Could not locate captions container (" + reason + ").",
          "Live captions may be OFF, or Google changed the Meet DOM.",
          "If captions are on but this warning repeats, the selectors in content.js need updating.",
        );
      }
    }

    if (!session.active || captionsEverDetected) return;

    // Captions not hooked yet — retry switching them on every cycle (the CC
    // button may not exist at Start, e.g. right after joining the call).
    // ensureCaptionsOn() is a no-op while captions are already enabled, and
    // after the first successful detection we stop calling it entirely so
    // we never fight a user who deliberately turns captions off.
    ensureCaptionsOn();
    maybeDumpCaptionDiagnostics();
  }

  // One-shot diagnostics: if captions are still not detected ~15s after
  // session start, print the elements that COULD be the captions region
  // (tag, class, aria-live, position) plus any open shadow roots — so a
  // future selector update is a copy-paste job, not guesswork.
  function maybeDumpCaptionDiagnostics() {
    if (diagnosticsDumped) return;
    if (!session.startedAt || Date.now() - session.startedAt < DIAGNOSTICS_DELAY_MS) {
      return;
    }
    diagnosticsDumped = true;

    const candidates = [];
    const els = document.querySelectorAll(
      '[aria-live], [class*="caption" i], [class*="subtitel" i]',
    );
    for (const el of els) {
      const rect = el.getBoundingClientRect();
      candidates.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        cls: typeof el.className === "string" ? el.className.slice(0, 100) : null,
        ariaLive: el.getAttribute("aria-live"),
        ariaLabel: el.getAttribute("aria-label") || null,
        text: (el.textContent || "").trim().slice(0, 60) || null,
        pos: `top:${Math.round(rect.top)} h:${Math.round(rect.height)} w:${Math.round(rect.width)}`,
      });
    }

    // Evidence for future shadow-DOM support: list open shadow-root hosts.
    const shadowHosts = [];
    try {
      for (const el of document.querySelectorAll("*")) {
        if (el.shadowRoot) {
          shadowHosts.push(el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ""));
          if (shadowHosts.length >= 10) break;
        }
      }
    } catch (err) {
      // Non-fatal — skip shadow-root evidence on error.
    }

    warn(
      `Captions still not detected after ~${Math.round(DIAGNOSTICS_DELAY_MS / 1000)}s.`,
      "If live captions are visibly ON, copy the dump below and send it to the",
      "developer to update CAPTION_CONTAINER_SELECTORS in content.js:",
      { candidates, openShadowRoots: shadowHosts },
    );
  }

  function describeEl(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = el.className && typeof el.className === "string"
      ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
      : "";
    return `${tag}${id}${cls}`;
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
    const lines = extractLines(captionsContainer);
    if (lines.length === 0) return;

    // Throttled heartbeat: proves the observer fires and lines parse, so
    // "observer never fired" vs "fired but nothing finalized" is visible
    // in the console without log spam on every caption refinement.
    const now = Date.now();
    if (now - lastMutationLogAt >= MUTATION_LOG_THROTTLE_MS) {
      lastMutationLogAt = now;
      log("Caption activity:", lines.length, "line(s) parsed from container");
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
    observer = new MutationObserver(() => handleCaptionMutation());
    observer.observe(captionsContainer, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    log("MutationObserver attached to", describeEl(captionsContainer));
  }

  function startRelocateLoop() {
    stopRelocateLoop();
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

    showBanner();
    // ensureCaptionsOn() runs inside relocateCaptionsContainer (below) and is
    // retried on every relocate cycle until captions are detected — a single
    // call path avoids a double click at Start toggling captions back off.
    relocateCaptionsContainer("session start");
    startRelocateLoop();
    startFlushLoop();
    log(
      `Session started for ${session.candidateName} (${session.candidateId}), sessionId=${session.sessionId}`,
    );
    return { ok: true, sessionId: session.sessionId };
  }

  async function stopSession(sendComplete = true) {
    if (!session.active) return { ok: true, alreadyInactive: true };
    const current = { ...session };
    session = { ...session, active: false };
    persistSession();

    clearTimeout(settleTimer);
    if (pendingLine) {
      finalizeLine(pendingLine);
      pendingLine = null;
    }
    stopRelocateLoop();
    stopFlushLoop();
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    hideBanner();

    // Flush remaining lines, then send the complete signal.
    await flushOutbox();
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
