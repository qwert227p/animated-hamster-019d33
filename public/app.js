(function () {
  "use strict";
  var ONLINE_SEC = 75;   // no report for this long = offline
  var POLL_MS = 8000;

  var $ = function (id) { return document.getElementById(id); };
  var state = { rows: [], skew: 0, filter: "all", sort: "eggs", q: "", avatars: {}, open: null, tab: "eggs" };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function sum(list) { return (list || []).reduce(function (a, e) { return a + (e.count || 0); }, 0); }
  function age(r) { return Math.max(0, (Date.now() + state.skew - Date.parse(r.updatedAt)) / 1000); }
  function ago(s) {
    s = Math.floor(s);
    if (s < 60) return s + "s ago";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    return Math.floor(s / 3600) + "h ago";
  }
  function dur(s) {
    s = Math.floor(s || 0);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? h + "h " + m + "m" : m + "m";
  }
  function num(n) { return Number(n).toLocaleString(); }
  function avatar(id) { return state.avatars[id] || "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#371a2f"/></svg>'); }

  /* ---------- data ---------- */
  function load() {
    fetch("/api/accounts", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        state.skew = j.now - Date.now();
        state.rows = j.accounts || [];
        setLive(true, state.rows.length + " account" + (state.rows.length === 1 ? "" : "s"));
        fetchAvatars();
        render();
        if (state.open) {
          var r = state.rows.find(function (x) { return x.userId === state.open; });
          if (r) fillSheet(r);
        }
      })
      .catch(function () { setLive(false, "Can't reach server"); });
  }
  function setLive(ok, text) {
    $("live").className = "live " + (ok ? "ok" : "bad");
    $("liveText").textContent = text;
  }
  function fetchAvatars() {
    var need = state.rows.map(function (r) { return r.userId; }).filter(function (id) { return !(id in state.avatars); });
    if (!need.length) return;
    need.forEach(function (id) { state.avatars[id] = ""; });
    fetch("/api/avatar?ids=" + need.join(","))
      .then(function (r) { return r.json(); })
      .then(function (m) { Object.assign(state.avatars, m); render(); })
      .catch(function () {});
  }

  /* ---------- list view ---------- */
  function matches(r) {
    var on = age(r) <= ONLINE_SEC;
    if (state.filter === "on" && !on) return false;
    if (state.filter === "off" && on) return false;
    if (!state.q) return true;
    var q = state.q;
    if ((r.username + " " + r.displayName).toLowerCase().indexOf(q) >= 0) return true;
    return r.eggs.concat(r.items).some(function (e) { return e.name.toLowerCase().indexOf(q) >= 0; });
  }
  function sorter(a, b) {
    switch (state.sort) {
      case "items": return sum(b.items) - sum(a.items);
      case "seen": return age(a) - age(b);
      case "name": return a.username.localeCompare(b.username);
      default: return sum(b.eggs) - sum(a.eggs);
    }
  }
  function top(list, n) {
    return list.slice().sort(function (a, b) { return b.count - a.count; }).slice(0, n);
  }

  function render() {
    var rows = state.rows;
    var online = rows.filter(function (r) { return age(r) <= ONLINE_SEC; }).length;
    var eggs = rows.reduce(function (a, r) { return a + sum(r.eggs); }, 0);
    var items = rows.reduce(function (a, r) { return a + sum(r.items); }, 0);
    var kinds = new Set();
    rows.forEach(function (r) { r.eggs.forEach(function (e) { kinds.add(e.name); }); });
    $("totals").innerHTML = [
      ["Accounts", rows.length, "var(--plum)"],
      ["Online", online, "var(--jade)"],
      ["Eggs", eggs, "var(--gold)"],
      ["Egg types", kinds.size, "var(--red)"],
      ["Items", items, "var(--plum)"]
    ].map(function (t) { return '<div class="tot" style="--c:' + t[2] + '"><b>' + num(t[1]) + "</b><span>" + t[0] + "</span></div>"; }).join("");

    var list = rows.filter(matches).sort(sorter);
    $("empty").hidden = rows.length > 0;
    $("cards").innerHTML = list.map(function (r) {
      var on = age(r) <= ONLINE_SEC;
      var chips = top(r.eggs, 4).map(function (e) { return '<span class="chip egg">' + esc(e.name) + "<x>×" + e.count + "</x></span>"; })
        .concat(top(r.items, 2).map(function (e) { return '<span class="chip">' + esc(e.name) + "<x>×" + e.count + "</x></span>"; }))
        .join("");
      var cash = r.stats && (r.stats.Cash || r.stats.Money || r.stats.Coins);
      return '<button type="button" class="card' + (on ? "" : " off") + '" data-id="' + r.userId + '">' +
        '<div class="c-h"><img src="' + esc(avatar(r.userId)) + '" alt="" referrerpolicy="no-referrer">' +
        '<div class="who"><div class="dn">' + esc(r.displayName || r.username) + '</div><div class="un">@' + esc(r.username) + "</div></div>" +
        '<span class="pill ' + (on ? "on" : "off") + '">' + (on ? "Online" : "Offline") + "</span></div>" +
        '<div class="c-n"><div class="egg"><b>' + num(sum(r.eggs)) + "</b><span>Eggs</span></div>" +
        '<div class="itm"><b>' + num(sum(r.items)) + "</b><span>Items</span></div>" +
        "<div><b>" + (cash != null ? esc(cash) : dur(r.sessionSeconds)) + "</b><span>" + (cash != null ? "Cash" : "Session") + "</span></div></div>" +
        '<div class="chips">' + (chips || '<span class="chip">Nothing yet</span>') + "</div>" +
        '<div class="c-f"><span>' + esc(r.gameName || "Steal an Egg") + "</span><span>" + ago(age(r)) + "</span></div>" +
        "</button>";
    }).join("");
  }

  /* ---------- account sheet ---------- */
  function fillSheet(r) {
    $("aImg").src = avatar(r.userId);
    $("aName").textContent = r.displayName || r.username;
    $("aSub").textContent = "@" + r.username + " · " + (age(r) <= ONLINE_SEC ? "online" : "last seen " + ago(age(r)));
    var stats = Object.assign({ Eggs: sum(r.eggs), Items: sum(r.items), Session: dur(r.sessionSeconds) }, r.stats || {});
    $("aStats").innerHTML = Object.keys(stats).map(function (k) { return "<div>" + esc(k) + "<b>" + esc(stats[k]) + "</b></div>"; }).join("");
    document.querySelectorAll("#acct .tabs button").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.t === state.tab)); });
    var q = $("aQ").value.trim().toLowerCase();
    var list = top(r[state.tab], 1e9).filter(function (e) { return !q || e.name.toLowerCase().indexOf(q) >= 0; });
    $("aList").innerHTML = list.length
      ? list.map(function (e) { return "<li><span>" + esc(e.name) + (e.kind ? "<small>" + esc(e.kind) + "</small>" : "") + "</span><b>×" + num(e.count) + "</b></li>"; }).join("")
      : "<li><span>Nothing here yet</span></li>";
  }
  function openSheet(id) {
    var r = state.rows.find(function (x) { return x.userId === id; });
    if (!r) return;
    state.open = id; $("aQ").value = "";
    fillSheet(r);
    $("acct").showModal();
  }

  /* ---------- events ---------- */
  $("cards").addEventListener("click", function (e) {
    var c = e.target.closest(".card");
    if (c) openSheet(Number(c.dataset.id));
  });
  $("q").addEventListener("input", function () { state.q = this.value.trim().toLowerCase(); render(); });
  $("sort").addEventListener("change", function () { state.sort = this.value; render(); });
  $("seg").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    state.filter = b.dataset.f;
    this.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    render();
  });
  document.querySelector("#acct .tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    state.tab = b.dataset.t;
    var r = state.rows.find(function (x) { return x.userId === state.open; });
    if (r) fillSheet(r);
  });
  $("aQ").addEventListener("input", function () {
    var r = state.rows.find(function (x) { return x.userId === state.open; });
    if (r) fillSheet(r);
  });
  $("acct").addEventListener("close", function () { state.open = null; });
  document.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", function () { b.closest("dialog").close(); }); });
  document.querySelectorAll("dialog").forEach(function (d) {
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
  });

  var loader = 'getgenv().MAIKO_URL = "' + location.origin + '"\n-- getgenv().MAIKO_KEY = "your-key"  -- only if the site owner set one\nloadstring(game:HttpGet("' + location.origin + '/maiko.lua"))()';
  $("loader").textContent = loader;
  $("scriptBtn").addEventListener("click", function () { $("script").showModal(); });
  $("copy").addEventListener("click", function () {
    var b = this;
    navigator.clipboard.writeText(loader).then(function () { b.textContent = "Copied!"; setTimeout(function () { b.textContent = "Copy"; }, 1500); });
  });

  load();
  setInterval(load, POLL_MS);
  setInterval(render, 5000);
})();
