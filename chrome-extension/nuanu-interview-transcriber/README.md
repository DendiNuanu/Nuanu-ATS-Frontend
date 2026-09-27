# Nuanu Interview Transcriber (Chrome Extension)

Captures Google Meet's **built-in live captions** (the CC feature — free for
all Meet users) during interviews and streams the transcript to the Nuanu
ATS. When the session stops, the ATS generates an AI summary (via the
existing Groq → Gemini → Cerebras chain) that appears in the candidate's
**Interview Results** tab.

This is the same mechanism tools like Tactiq use: the extension reads
captions already rendered in **your own browser** while you're in the call.
No bot participant, no separate speech-to-text service.

## ⚠️ Consent policy (agreed with HR)

Before starting transcription, **verbally inform the candidate and all
participants** that the interview is being transcribed for HR
record-keeping. While transcription is active, a red banner is displayed on
the HR user's screen as a constant reminder. Meet's live captions are also
visible to everyone in the call.

## Install (load unpacked)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this folder (`chrome-extension/nuanu-interview-transcriber`)
5. Pin the extension to the toolbar (puzzle-piece icon → pin)

## Use

1. Open the Google Meet interview tab (join the call).
2. Click the extension icon → log in with your **ATS email + password**
   (same credentials as hr.ats.new.nuanu.site).
3. Search and select the candidate this interview is for.
4. Click **Start Transcribing**. The extension will:
   - Try to turn on live captions automatically (clicks the CC button).
   - Show a red banner + "REC" toolbar badge while active.
   - Capture and stream finalized caption lines every ~5 seconds.
5. At the end of the interview, click **Stop & Finalize**. The ATS marks the
   session complete and generates the AI summary — it appears in the
   candidate's Interview Results tab within seconds (the tab auto-refreshes
   while a session is live).

## Troubleshooting

- **Popup shows "Captions: not detected"**: the extension has not read any
  caption TEXT from the Meet DOM yet. While this is amber it keeps pressing
  the CC button (with a fast 1s probe until the first line is read), then
  turns green ("Captions: detected ✓") the moment real caption text is
  parsed. If it stays amber with captions visibly on screen, see
  **Debugging caption detection** below.
- **"Could not locate captions container"** (in the Meet tab's DevTools
  console, prefix `[nuanu-transcriber]`): live captions are off, or Google
  changed the Meet DOM. Turn captions on manually with the CC button —
  capture starts automatically once captions render.
- **"Captions still not detected after ~15s"**: printed once per session
  when captions were never detected; it automatically runs the DOM dump. If
  captions are visibly ON when it appears, copy the dump and send it to the
  developer — it contains everything needed to update the selectors.
- **401 on upload**: your password changed — log out and back in in the
  popup.
- **Session stuck "in_progress"**: if the tab closed without Stop, the
  transcript stays in-progress; open the candidate's Interview Results tab
  and use the retry/refresh controls there.

## Debugging caption detection

Run these in the **Meet tab's** DevTools console (they are globals the
content script installs):

- `__nuanuDebugCaptions()` — snapshot: is the session active, has caption
  text been detected, which element is being observed, is it still attached
  to the DOM, how many lines parse right now, outbox size.
- `__nuanuDebugDump()` — dumps every caption-ish element (tag, id, classes,
  `aria-live`, `aria-label`, `role`, position, text, shadow-DOM flag). If
  detection is broken, copy this output to the developer; it is enough to
  add a new selector without guessing.
- `__nuanuDebugRescan()` — force an immediate re-scan and return the element
  now being observed (or `null`).

Console prefix is always `[nuanu-transcriber]`. Useful lines to look for:

- `Captions container located via ... →` — a container was found and the
  MutationObserver attached.
- `Captions DETECTED — text is being read from ...` — real caption text was
  parsed; the popup flips to green and the line counter starts rising.
- `Caption activity: N line(s) parsed: ...` — throttled heartbeat proving
  the observer is firing and text is being read.
- `Line finalized: <speaker> → <text>` — a line was confirmed and queued for
  upload.

## Notes on caption detection (v1.2)

- **Structure-first, not class-based.** Google randomizes Meet's class names
  (they change frequently), so the old approach of matching
  `div[aria-live="assertive"]` / `#captions` / `class*="captions"` broke
  silently. Detection now walks an ordered ladder of *stable* signals:
  1. live regions and `role="region"` whose `aria-label` mentions
     captions/subtitles (any UI language);
  2. any live region below the video band (polite **or** assertive);
  3. legacy selectors, kept as cheap fallbacks;
  4. a bounded geometric heuristic (short text block pinned near the bottom).
  Open **shadow roots** are searched too, since parts of Meet's UI live in
  shadow DOM.
- **Empty containers are accepted**, so the MutationObserver attaches before
  the first line renders. Detection ("detected ✓") is now truth-based: it
  flips only once caption **text** is parsed, never merely because a node
  was found.
- **Self-healing.** If Meet re-mounts the captions node mid-interview, the
  observer notices the container detached, re-locates it, and re-attaches —
  capture continues without a manual restart. A 1s probe runs until the
  first line is read; a 5s relocate sweep runs for the whole session.
- Meeting-event announcers (`role="status"` / `role="alert"` — "X joined the
  meeting", recording notices) are explicitly excluded so they are never
  mistaken for captions.
- The CC button is found via its `aria-label`, matching `caption`,
  `subtitle`, `subtitel` (Indonesian UI), or the locale-independent
  shortcut hint `ctrl+shift+c` that Meet appends in every UI language.
- Switching captions on is retried until caption text is detected; after
  detection the extension never touches the CC button again (so it can't
  fight a user who turns captions off manually).
- Speaker labels vs caption text: a text node is treated as a speaker name
  only when it is short, unpunctuated, alone in its own wrapper with a
  following text-bearing sibling, and not rendered in white (Meet draws
  caption text white, speaker names colored). All checks fail safe — text
  is kept as a caption line when in doubt.

## Privacy / credentials

Your ATS credentials are stored only in this browser's
`chrome.storage.local` and sent with each API request to
`https://hr.ats.new.nuanu.site` for authentication (the same login endpoint
the web app uses). They are never transmitted anywhere else. Transcripts are
attributable to the logged-in HR user.
