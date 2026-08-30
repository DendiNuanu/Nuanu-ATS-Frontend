/**
 * Nuanu Interview Transcriber — popup logic.
 *
 * Three states:
 *   1. Logged out → email/password login against the ATS (same endpoint
 *      the web app uses). Credentials are kept in chrome.storage.local
 *      for the browser session — per-user, never shared or hardcoded.
 *   2. Logged in, idle → candidate search (ATS global search API) +
 *      "Start Transcribing" (messages the Meet tab's content script).
 *   3. Live → red status + "Stop & Finalize" (sends session-complete).
 */

const ATS_BASE = "https://hr.ats.new.nuanu.site";

const $ = (id) => document.getElementById(id);

let selectedCandidate = null; // { id, name }
let pollTimer = null;

// ── State restore ───────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["auth", "session"], (data) => {
    if (data && data.auth && data.auth.user) {
      showApp(data.auth.user);
    } else {
      showLogin();
    }
    refreshLiveView();
  });
});

// ── Views ───────────────────────────────────────────────────────────────────
function showLogin() {
  $("view-login").classList.remove("hidden");
  $("view-app").classList.add("hidden");
}

function showApp(user) {
  $("view-login").classList.add("hidden");
  $("view-app").classList.remove("hidden");
  $("user-name").textContent = user.name;
  $("user-email").textContent = user.email;
}

// ── Login / logout ──────────────────────────────────────────────────────────
$("btn-login").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  const errEl = $("login-error");
  errEl.textContent = "";
  if (!email || !password) {
    errEl.textContent = "Enter your ATS email and password.";
    return;
  }
  $("btn-login").disabled = true;
  $("btn-login").textContent = "Logging in…";
  try {
    const res = await fetch(`${ATS_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      errEl.textContent = data.error || "Login failed.";
      return;
    }
    chrome.storage.local.set({
      auth: { user: data.user, email, password },
    });
    showApp(data.user);
  } catch (err) {
    errEl.textContent = "Network error — check your connection.";
  } finally {
    $("btn-login").disabled = false;
    $("btn-login").textContent = "Log in";
  }
});

$("btn-logout").addEventListener("click", () => {
  chrome.storage.local.remove(["auth", "session"], () => {
    selectedCandidate = null;
    showLogin();
    refreshLiveView();
  });
});

// ── Candidate search ────────────────────────────────────────────────────────
let searchDebounce = null;
$("search").addEventListener("input", (e) => {
  const q = e.target.value.trim();
  clearTimeout(searchDebounce);
  if (q.length < 2) {
    $("results").classList.add("hidden");
    return;
  }
  searchDebounce = setTimeout(() => void doSearch(q), 300);
});

async function doSearch(q) {
  try {
    const res = await fetch(
      `${ATS_BASE}/api/search?q=${encodeURIComponent(q)}`,
    );
    const data = await res.json();
    const candidates = (data && data.candidates) || [];
    const box = $("results");
    box.innerHTML = "";
    if (candidates.length === 0) {
      box.innerHTML = '<div class="result" style="color:#94a3b8;">No candidates found</div>';
    }
    for (const c of candidates) {
      const div = document.createElement("div");
      div.className = "result";
      div.innerHTML = `<div>${escapeHtml(c.name)}</div><div class="sub">${escapeHtml(c.position || "")}</div>`;
      div.addEventListener("click", () => {
        selectedCandidate = { id: c.id, name: c.name };
        $("search").value = "";
        $("results").classList.add("hidden");
        $("selected-candidate").textContent = c.name;
        $("selected-candidate").classList.remove("hidden");
        $("btn-start").disabled = false;
      });
      box.appendChild(div);
    }
    box.classList.remove("hidden");
  } catch (err) {
    console.error("[nuanu-popup] search failed", err);
  }
}

function escapeHtml(s) {
  const map = {
    "&": "&" + "amp;",
    "<": "&" + "lt;",
    ">": "&" + "gt;",
    '"': "&" + "quot;",
    "'": "&" + "#39;",
  };
  return String(s ?? "").replace(/[&<>"']/g, (ch) => map[ch]);
}

// ── Start / stop ────────────────────────────────────────────────────────────
$("btn-start").addEventListener("click", async () => {
  const errEl = $("pick-error");
  errEl.textContent = "";
  if (!selectedCandidate) return;

  const { auth } = await chrome.storage.local.get(["auth"]);
  if (!auth || !auth.email || !auth.password) {
    errEl.textContent = "Not logged in — please log in again.";
    return;
  }

  // Send start to the active Meet tab's content script.
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.url || !tab.url.startsWith("https://meet.google.com/")) {
      errEl.textContent = "Open the Google Meet interview tab first, then click Start.";
      return;
    }
    chrome.tabs.sendMessage(
      tab.id,
      {
        type: "START_SESSION",
        payload: {
          candidateId: selectedCandidate.id,
          candidateName: selectedCandidate.name,
          userEmail: auth.email,
          userPassword: auth.password,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          errEl.textContent = "Could not reach the Meet tab — reload the Meet page and try again.";
          return;
        }
        if (!response || !response.ok) {
          errEl.textContent = (response && response.error) || "Failed to start.";
          return;
        }
        refreshLiveView();
      },
    );
  });
});

$("btn-stop").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    const finish = () => {
      chrome.storage.local.set({ session: { active: false } }, refreshLiveView);
    };
    if (!tab || !tab.url || !tab.url.startsWith("https://meet.google.com/")) {
      finish();
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: "STOP_SESSION" }, () => {
      // Ignore errors — storage update below resets the badge regardless.
      finish();
    });
  });
});

// ── Live view sync ──────────────────────────────────────────────────────────
function refreshLiveView() {
  chrome.runtime.sendMessage({ type: "GET_TAB_SESSION_STATE" }, (data) => {
    const live = data && data.active;
    $("view-pick").classList.toggle("hidden", !!live);
    $("view-live").classList.toggle("hidden", !live);
    if (live) {
      $("live-candidate").textContent = data.candidateName || "";
      $("live-meta").textContent = `${data.lineCount || 0} lines captured · session ${data.sessionId || ""}`;
      startPolling();
    } else {
      stopPolling();
      // Reset picker state.
      selectedCandidate = null;
      $("selected-candidate").classList.add("hidden");
      $("btn-start").disabled = true;
    }
  });
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(refreshLiveView, 3000);
}
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
