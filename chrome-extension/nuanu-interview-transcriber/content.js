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
        attachObserver();
        log("Captions container located via", reason, "→", describeEl(captionsContainer));
      } else {
        warn(
          "Could not locate captions container (" + reason + ").",
          "Live captions may be OFF, or Google changed the Meet DOM.",
          "If captions are on but this warning repeats, the selectors in content.js need updating.",
        );
      }
    }
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
  // Meet renders each caption "line" as a text block, often preceded by the
  // speaker name. Structure varies; we extract per text-node group and use
  // the previous known speaker when a line has no name.
  let lastSpeaker = "Unknown";

  function extractLines(container) {
    // Meet's current caption DOM: repeated groups of (speaker-name, text).
    // We walk elements that directly contain meaningful text.
    const lines = [];
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
    );
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.textContent || "").trim();
      if (!text) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      // Speaker names are typically short (< 40 chars), no sentence punctuation.
      const isSpeaker =
        text.length <= 40 &&
        !/[.!?]$/.test(text) &&
        parent.getAttribute("aria-hidden") !== "true";
      if (isSpeaker) {
        lastSpeaker = text;
      } else {
        lines.push({ speaker: lastSpeaker, text });
      }
    }
    return lines;
  }

  // ── Line finalization (debounce) ─────────────────────────────────────────
  function handleCaptionMutation() {
    if (!session.active || !captionsContainer) return;
    const lines = extractLines(captionsContainer);
    if (lines.length === 0) return;

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

  // ── Auto-enable captions (best effort) ───────────────────────────────────
  const CAPTION_BUTTON_SELECTORS = [
    'button[aria-label*="captions" i]',
    'button[aria-label*="subtitle" i]',
    'button[aria-label*="CC"]',
    'button[aria-pressed]', // broad fallback; filtered below
  ];

  function findCaptionToggleButton() {
    for (const selector of CAPTION_BUTTON_SELECTORS) {
      try {
        const buttons = document.querySelectorAll(selector);
        for (const btn of buttons) {
          const label = (btn.getAttribute("aria-label") || "").toLowerCase();
          if (
            label.includes("caption") ||
            label.includes("subtitle") ||
            label.includes("cc")
          ) {
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
      log("Live captions already on");
      return;
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

    showBanner();
    ensureCaptionsOn();
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
