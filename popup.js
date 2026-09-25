const DOMAIN_RE = /^[a-z0-9-]+\.atlassian\.net$/;
const JQL = "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC";
const TABS = [
  { id: "all", label: "All" },
  { id: "new", label: "To do" },
  { id: "indeterminate", label: "In progress" },
];

const $ = (id) => document.getElementById(id);
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });

let domain = "";
let issues = [];
let activeTab = "all";

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function openUrl(url, event) {
  // Ctrl/Cmd/middle click opens in background, like a normal link.
  const background = event && (event.ctrlKey || event.metaKey || event.button === 1);
  chrome.tabs.create({ url, active: !background });
}

function timeAgo(iso) {
  const seconds = (new Date(iso) - Date.now()) / 1000;
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

/* ---------- API ---------- */

async function jira(path) {
  const res = await fetch(`https://${domain}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  return res.json();
}

async function load() {
  $("refresh").classList.add("spinning");
  showSkeleton();

  try {
    const params = new URLSearchParams({
      jql: JQL,
      fields: "summary,status,priority,issuetype,updated",
      maxResults: "100", // ponytail: niente paginazione, usare nextPageToken se servono più di 100
    });
    const [me, result] = await Promise.all([
      jira("/rest/api/3/myself"),
      jira(`/rest/api/3/search/jql?${params}`),
    ]);

    issues = result.issues;
    $("avatar").src = me.avatarUrls["48x48"];
    $("avatar").title = me.displayName;
    $("avatar").hidden = false;
    chrome.action.setBadgeText({ text: issues.length ? String(issues.length) : "" });
    render();
  } catch (err) {
    showError(err);
  } finally {
    $("refresh").classList.remove("spinning");
  }
}

/* ---------- Rendering ---------- */

function showSkeleton() {
  $("state").hidden = true;
  $("list").replaceChildren(
    ...Array.from({ length: 5 }, () =>
      el("li", { className: "skeleton" }, el("span"), el("span"), el("span")),
    ),
  );
}

function showState(emoji, title, text, action) {
  $("list").replaceChildren();
  $("state").replaceChildren(
    el("div", { className: "emoji" }, emoji),
    el("strong", {}, title),
    text,
  );
  if (action) {
    const button = el("button", { className: "primary" }, action.label);
    button.onclick = action.run;
    $("state").append(el("div", {}, button));
  }
  $("state").hidden = false;
}

function showError(err) {
  if (err.status === 401 || err.status === 403) {
    return showState("🔒", "You're signed out of Jira", "Sign in, then reopen Jiffy.", {
      label: "Sign in to Jira",
      run: (e) => openUrl(`https://${domain}`, e),
    });
  }
  if (err.status === 404) {
    return showState("🧭", "Site not found", `${domain} doesn't look like a Jira site.`, {
      label: "Switch site",
      run: reset,
    });
  }
  showState(
    "⚡",
    "Couldn't reach Jira",
    err.status ? `Jira replied ${err.message}.` : "Check your connection.",
    {
      label: "Try again",
      run: load,
    },
  );
}

function category(issue) {
  return issue.fields.status.statusCategory?.key ?? "new";
}

function renderTabs() {
  $("tabs").replaceChildren(
    ...TABS.map(({ id, label }) => {
      const count = id === "all" ? issues.length : issues.filter((i) => category(i) === id).length;
      const tab = el(
        "button",
        { className: "tab", role: "tab" },
        label,
        el("span", { className: "count" }, String(count)),
      );
      tab.setAttribute("aria-selected", String(id === activeTab));
      tab.onclick = () => {
        activeTab = id;
        render();
      };
      return tab;
    }),
  );
}

function renderTicket(issue, index) {
  const { summary, status, priority, issuetype, updated } = issue.fields;
  const url = `https://${domain}/browse/${issue.key}`;

  const button = el(
    "button",
    { className: "ticket", title: `${issue.key}: ${summary}` },
    el("img", { className: "type", src: issuetype.iconUrl, alt: issuetype.name }),
    el("span", { className: "summary" }, summary),
    el(
      "span",
      { className: "meta" },
      el("span", { className: "key" }, issue.key),
      el("span", { className: `lozenge ${category(issue)}` }, status.name),
      priority
        ? el("img", {
            className: "priority",
            src: priority.iconUrl,
            alt: priority.name,
            title: priority.name,
          })
        : "",
      el(
        "span",
        { className: "updated", title: new Date(updated).toLocaleString() },
        timeAgo(updated),
      ),
    ),
  );
  button.style.setProperty("--i", Math.min(index, 12));
  button.onclick = (e) => openUrl(url, e);
  button.onauxclick = (e) => e.button === 1 && openUrl(url, e);

  return el("li", {}, button);
}

function render() {
  renderTabs();

  if (!issues.length) {
    return showState("🎉", "Inbox zero", "No open tickets assigned to you.");
  }

  const query = $("filter").value.trim().toLowerCase();
  const visible = issues.filter(
    (i) =>
      (activeTab === "all" || category(i) === activeTab) &&
      (i.key.toLowerCase().includes(query) || i.fields.summary.toLowerCase().includes(query)),
  );

  if (!visible.length) {
    return showState("🔍", "No matches", "Try another key, word or tab.");
  }

  $("state").hidden = true;
  $("list").replaceChildren(...visible.map(renderTicket));
}

/* ---------- Setup ---------- */

function start(savedDomain) {
  domain = savedDomain;
  $("site").textContent = domain;
  $("setup").hidden = true;
  $("main").hidden = false;
  $("footer").hidden = false;
  $("refresh").hidden = false;
  load();
}

async function reset() {
  await chrome.storage.local.remove("domain");
  chrome.action.setBadgeText({ text: "" });
  location.reload();
}

$("setup-form").onsubmit = async (e) => {
  e.preventDefault();
  let value = $("domain").value.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!value.endsWith(".atlassian.net")) value += ".atlassian.net";

  if (!DOMAIN_RE.test(value)) {
    $("setup-error").textContent = "Use only letters, numbers and dashes, like your-company.";
    return;
  }
  await chrome.storage.local.set({ domain: value });
  start(value);
};

$("refresh").onclick = load;
$("reset").onclick = reset;
$("your-work").onclick = (e) => openUrl(`https://${domain}/jira/your-work`, e);
$("filter").oninput = render;

/* ---------- Keyboard: "/" to search, arrows to move ---------- */

document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== $("filter") && !$("main").hidden) {
    e.preventDefault();
    $("filter").focus();
    return;
  }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

  const tickets = [...document.querySelectorAll(".ticket")];
  if (!tickets.length) return;
  e.preventDefault();
  const current = tickets.indexOf(document.activeElement);
  const next = e.key === "ArrowDown" ? current + 1 : current - 1;
  tickets[Math.max(0, Math.min(tickets.length - 1, next))].focus();
});

chrome.action.setBadgeBackgroundColor({ color: "#0C66E4" });

chrome.storage.local.get("domain").then(({ domain: saved }) => {
  if (saved) return start(saved);
  $("setup").hidden = false;
  $("domain").focus();
});
