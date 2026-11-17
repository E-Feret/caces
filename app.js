/* Révision CACES R489 — app 100 % front, données sauvegardées dans le navigateur (localStorage) */
(() => {
  "use strict";

  const STORE_KEY = "caces_r489_v1";
  const LETTERS = "ABCDEFGH";
  const app = document.getElementById("app");
  const topInfo = document.getElementById("topInfo");

  // Identifiant stable par question = position dans la banque
  QUESTIONS.forEach((q, i) => { q.id = i; q.multi = Array.isArray(q.a); q.ans = q.multi ? q.a : [q.a]; });

  // ---------- Stockage ----------
  const defaults = () => ({ sessions: [], qstats: {}, settings: { size: 100, threshold: 80, mode: "smart", themes: Object.keys(THEMES) } });
  let db;
  function load() {
    try { db = Object.assign(defaults(), JSON.parse(localStorage.getItem(STORE_KEY)) || {}); }
    catch { db = defaults(); }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
    catch { toast("Impossible de sauvegarder (stockage plein ?)"); }
  }
  load();

  // ---------- Utilitaires ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmtDate = (ts) => new Date(ts).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
  const current = () => db.sessions.find((s) => !s.finished);
  const getSession = (id) => db.sessions.find((s) => s.id === id);

  // ---------- Création de session ----------
  function pickQuestions(themes, size, mode) {
    let pool = QUESTIONS.filter((q) => themes.includes(q.t));
    const st = (q) => db.qstats[q.id] || { seen: 0, wrong: 0 };
    if (mode === "errors") {
      pool = pool.filter((q) => st(q).wrong > 0);
      pool = shuffle(pool).sort((a, b) => (st(b).wrong / st(b).seen) - (st(a).wrong / st(a).seen));
    } else if (mode === "smart") {
      // priorité : jamais vues, puis taux d'erreur élevé, puis le reste (aléatoire à égalité)
      pool = shuffle(pool).map((q) => {
        const s = st(q);
        const w = s.seen === 0 ? 2 : s.wrong / s.seen;
        return { q, w: w + Math.random() * 0.35 };
      }).sort((a, b) => b.w - a.w).map((x) => x.q);
    } else {
      pool = shuffle(pool);
    }
    const chosen = size === "all" ? pool : pool.slice(0, size);
    return shuffle(chosen); // l'ordre final reste aléatoire
  }

  function startSession(opts) {
    const qs = pickQuestions(opts.themes, opts.size, opts.mode);
    if (!qs.length) { toast(opts.mode === "errors" ? "Aucune erreur enregistrée pour l'instant 👍" : "Aucune question pour ces thèmes"); return; }
    const s = {
      id: Date.now().toString(36),
      created: Date.now(),
      mode: opts.mode,
      themes: opts.themes,
      items: qs.map((q) => ({ id: q.id, order: shuffle(q.o.map((_, i) => i)), sel: null, ok: null })),
      pos: 0,
      finished: false,
    };
    db.sessions.push(s);
    save();
    renderQuiz(s.id);
  }

  // ---------- Écran d'accueil ----------
  function renderHome() {
    window.scrollTo(0, 0);
    topInfo.textContent = "";
    const run = current();
    const done = db.sessions.filter((s) => s.finished);
    const seenCount = Object.values(db.qstats).filter((s) => s.seen > 0).length;
    const avg = done.length ? Math.round(done.reduce((a, s) => a + s.score, 0) / done.length) : null;
    const errCount = Object.values(db.qstats).filter((s) => s.wrong > 0).length;
    const st = db.settings;
    const countBy = (t) => QUESTIONS.filter((q) => q.t === t).length;

    app.innerHTML = `
      <h1>Révision théorique</h1>
      <div class="stats-grid">
        <div class="stat"><b>${seenCount}/${QUESTIONS.length}</b><span>questions vues</span></div>
        <div class="stat"><b>${done.length}</b><span>sessions finies</span></div>
        <div class="stat"><b>${avg === null ? "–" : avg + "%"}</b><span>moyenne</span></div>
      </div>

      ${run ? `
        <div class="card" style="margin-top:14px">
          <div class="field-title">Session en cours</div>
          <p class="muted small" style="margin:0 0 12px">Commencée le ${fmtDate(run.created)} — ${run.items.filter((i) => i.sel).length}/${run.items.length} répondues</p>
          <div class="row">
            <button class="btn primary" id="resume">Reprendre</button>
            <button class="btn danger" id="abandon">Abandonner</button>
          </div>
        </div>` : ""}

      <h2>Nouvelle session</h2>
      <div class="card">
        <div class="field">
          <span class="field-title">Nombre de questions</span>
          <div class="seg">
            ${[20, 50, 100, "all"].map((n) => `<label><input type="radio" name="size" value="${n}" ${String(st.size) === String(n) ? "checked" : ""}>${n === "all" ? "Toutes" : n}</label>`).join("")}
          </div>
        </div>
        <div class="field">
          <span class="field-title">Mode</span>
          <div class="seg">
            <label><input type="radio" name="mode" value="smart" ${st.mode === "smart" ? "checked" : ""}>Intelligent</label>
            <label><input type="radio" name="mode" value="random" ${st.mode === "random" ? "checked" : ""}>Aléatoire</label>
            <label><input type="radio" name="mode" value="errors" ${st.mode === "errors" ? "checked" : ""}>Mes erreurs (${errCount})</label>
          </div>
          <p class="muted small" style="margin:8px 0 0">« Intelligent » propose en priorité les questions jamais vues et celles que vous ratez le plus.</p>
        </div>
        <div class="field" style="margin-bottom:6px">
          <span class="field-title">Thèmes</span>
          <div class="checks">
            ${Object.entries(THEMES).map(([k, v]) => `<label><input type="checkbox" name="theme" value="${k}" ${st.themes.includes(k) ? "checked" : ""}>${esc(v)}<span class="count">${countBy(k)}</span></label>`).join("")}
          </div>
        </div>
      </div>
      <button class="btn primary" id="start">${run ? "Démarrer une nouvelle session" : "Démarrer"}</button>

      ${renderThemeStats()}

      <h2>Historique</h2>
      ${db.sessions.length ? db.sessions.slice().reverse().map(histItem).join("") : `<p class="muted">Aucune session pour l'instant.</p>`}

      <h2>Sauvegarde</h2>
      <div class="card stack">
        <p class="muted small" style="margin:0">Vos sessions sont enregistrées dans ce navigateur. Exportez-les pour les transférer vers un autre appareil.</p>
        <div class="row">
          <button class="btn" id="export">Exporter</button>
          <button class="btn" id="import">Importer</button>
        </div>
        <button class="btn danger" id="reset">Tout effacer</button>
        <input type="file" id="importFile" accept="application/json" class="hidden">
      </div>
      <p class="muted small" style="text-align:center;margin-top:20px">${QUESTIONS.length} questions — outil d'entraînement non officiel.</p>
    `;

    const readOpts = () => {
      const size = app.querySelector("input[name=size]:checked").value;
      return {
        size: size === "all" ? "all" : Number(size),
        mode: app.querySelector("input[name=mode]:checked").value,
        themes: [...app.querySelectorAll("input[name=theme]:checked")].map((i) => i.value),
      };
    };
    app.querySelectorAll("input").forEach((i) => i.addEventListener("change", () => {
      Object.assign(db.settings, readOpts()); save();
    }));
    app.querySelector("#start").onclick = () => {
      const o = readOpts();
      if (!o.themes.length) return toast("Choisissez au moins un thème");
      const r = current();
      if (r && !confirm("Une session est en cours. L'abandonner et en démarrer une nouvelle ?")) return;
      if (r) db.sessions = db.sessions.filter((s) => s !== r);
      startSession(o);
    };
    if (run) {
      app.querySelector("#resume").onclick = () => renderQuiz(run.id);
      app.querySelector("#abandon").onclick = () => {
        if (!confirm("Abandonner la session en cours ? Elle sera supprimée.")) return;
        db.sessions = db.sessions.filter((s) => s !== run); save(); renderHome();
      };
    }
    app.querySelectorAll("[data-session]").forEach((b) => b.onclick = () => {
      const s = getSession(b.dataset.session);
      s.finished ? renderResults(s.id) : renderQuiz(s.id);
    });
    app.querySelector("#export").onclick = exportData;
    const file = app.querySelector("#importFile");
    app.querySelector("#import").onclick = () => file.click();
    file.onchange = importData;
    app.querySelector("#reset").onclick = () => {
      if (!confirm("Effacer tout l'historique et les statistiques ?")) return;
      db = defaults(); save(); renderHome();
    };
  }

  function histItem(s) {
    const answered = s.items.filter((i) => i.sel).length;
    const passed = s.finished && s.score >= db.settings.threshold;
    return `<button class="hist-item" data-session="${s.id}">
      <span class="pct">${s.finished ? s.score + "%" : "…"}</span>
      <span class="meta"><b>${s.items.length} questions</b><br>${fmtDate(s.created)}${s.finished ? "" : ` · ${answered} répondues`}</span>
      ${s.finished ? `<span class="pill ${passed ? "ok" : "ko"}">${passed ? "Réussi" : "À revoir"}</span>` : `<span class="pill run">En cours</span>`}
    </button>`;
  }

  function renderThemeStats() {
    const rows = Object.entries(THEMES).map(([k, v]) => {
      let seen = 0, wrong = 0;
      QUESTIONS.filter((q) => q.t === k).forEach((q) => { const s = db.qstats[q.id]; if (s) { seen += s.seen; wrong += s.wrong; } });
      return { v, seen, rate: seen ? pct(seen - wrong, seen) : null };
    });
    if (!rows.some((r) => r.seen)) return "";
    return `<h2>Réussite par thème</h2><div class="card">${rows.map((r) => `
      <div class="bar-line"><div class="lbl"><span>${esc(r.v)}</span><b>${r.rate === null ? "–" : r.rate + "%"}</b></div>
      <div class="bar"><div style="width:${r.rate || 0}%;background:${colorFor(r.rate)}"></div></div></div>`).join("")}</div>`;
  }
  const colorFor = (r) => (r === null ? "var(--line)" : r >= 80 ? "var(--ok)" : r >= 60 ? "var(--accent)" : "var(--ko)");

  // ---------- Quiz ----------
  let pending = []; // sélection en cours (avant validation)

  function renderQuiz(id, keepScroll) {
    const s = getSession(id);
    if (!s) return renderHome();
    const item = s.items[s.pos];
    const q = QUESTIONS[item.id];
    const answered = item.sel !== null;
    const nbAnswered = s.items.filter((i) => i.sel).length;
    const goodSoFar = s.items.filter((i) => i.ok).length;
    if (!answered && !keepScroll) pending = [];
    if (!keepScroll) window.scrollTo(0, 0);
    topInfo.textContent = `✓ ${goodSoFar} / ${nbAnswered}`;

    const optHtml = item.order.map((origIdx, displayIdx) => {
      let cls = "";
      if (answered) {
        if (q.ans.includes(origIdx)) cls = "correct";
        else if (item.sel.includes(origIdx)) cls = "wrong";
      } else if (pending.includes(origIdx)) cls = "selected";
      return `<button class="opt ${cls}" data-i="${origIdx}" ${answered ? "disabled" : ""}>
        <span class="letter">${LETTERS[displayIdx]}</span><span>${esc(q.o[origIdx])}</span></button>`;
    }).join("");

    app.innerHTML = `
      <div class="progress"><div style="width:${pct(s.pos + (answered ? 1 : 0), s.items.length)}%"></div></div>
      <div class="q-meta"><span>Question ${s.pos + 1} / ${s.items.length}</span><span class="tag">${esc(THEMES[q.t])}</span></div>
      <div class="question">${esc(q.q)}</div>
      ${q.multi ? `<div class="hint-multi">Plusieurs réponses possibles</div>` : ""}
      <div class="options">${optHtml}</div>
      ${answered ? `<div class="feedback ${item.ok ? "ok" : "ko"}"><b>${item.ok ? "Bonne réponse ✓" : "Mauvaise réponse ✗"}</b>${esc(q.e)}</div>` : ""}
    `;

    // Barre d'action fixe
    let bar = document.querySelector(".action-bar");
    if (!bar) { bar = document.createElement("div"); bar.className = "action-bar"; document.body.appendChild(bar); }
    const isLast = s.pos === s.items.length - 1;
    const allDone = nbAnswered === s.items.length;
    let mainBtn;
    if (!answered) mainBtn = `<button class="btn primary" id="validate" ${pending.length ? "" : "disabled"}>Valider</button>`;
    else if (allDone) mainBtn = `<button class="btn primary" id="finish">Voir le résultat</button>`;
    else mainBtn = `<button class="btn primary" id="next">${isLast ? "Questions sautées" : "Suivante"} →</button>`;
    bar.innerHTML = `<div class="inner">
      <button class="btn icon" id="prev" aria-label="Précédente" ${s.pos === 0 ? "disabled" : ""}>←</button>
      ${mainBtn}
      ${!answered && !isLast ? `<button class="btn icon" id="skip" aria-label="Passer">⤼</button>` : ""}
    </div>`;

    // Événements
    app.querySelectorAll(".opt:not([disabled])").forEach((b) => b.onclick = () => {
      const i = Number(b.dataset.i);
      if (q.multi) pending = pending.includes(i) ? pending.filter((x) => x !== i) : [...pending, i];
      else pending = [i];
      renderQuiz(id, true);
    });
    const $ = (sel) => bar.querySelector(sel);
    if ($("#validate")) $("#validate").onclick = () => answer(s, item, q);
    if ($("#next")) $("#next").onclick = () => { s.pos = nextUnanswered(s); save(); renderQuiz(id); };
    if ($("#finish")) $("#finish").onclick = () => finish(s);
    if ($("#skip")) $("#skip").onclick = () => { s.pos++; save(); renderQuiz(id); };
    $("#prev").onclick = () => { if (s.pos > 0) { s.pos--; save(); renderQuiz(id); } };
  }

  function nextUnanswered(s) {
    for (let k = 1; k <= s.items.length; k++) {
      const p = (s.pos + k) % s.items.length;
      if (!s.items[p].sel) return p;
    }
    return s.pos;
  }

  function answer(s, item, q) {
    if (!pending.length) return;
    item.sel = pending.slice();
    item.ok = sameSet(item.sel, q.ans);
    const st = db.qstats[q.id] || (db.qstats[q.id] = { seen: 0, wrong: 0 });
    st.seen++;
    if (!item.ok) st.wrong++;
    else if (s.mode === "errors" && st.wrong > 0) st.wrong--; // une erreur corrigée allège la liste
    pending = [];
    save();
    renderQuiz(s.id, true);
    if (navigator.vibrate && !item.ok) navigator.vibrate(60);
  }

  function finish(s) {
    s.finished = true;
    s.finishedAt = Date.now();
    s.score = pct(s.items.filter((i) => i.ok).length, s.items.length);
    save();
    renderResults(s.id);
  }

  function removeBar() { const b = document.querySelector(".action-bar"); if (b) b.remove(); }

  // ---------- Résultats & correction ----------
  function renderResults(id, filter = "ko") {
    removeBar();
    window.scrollTo(0, 0);
    const s = getSession(id);
    const good = s.items.filter((i) => i.ok).length;
    const passed = s.score >= db.settings.threshold;
    topInfo.textContent = "";

    const byTheme = {};
    s.items.forEach((it) => {
      const t = QUESTIONS[it.id].t;
      byTheme[t] = byTheme[t] || { n: 0, ok: 0 };
      byTheme[t].n++; if (it.ok) byTheme[t].ok++;
    });

    const list = s.items.filter((it) => filter === "all" || (filter === "ko" ? !it.ok : it.ok));

    app.innerHTML = `
      <h1>Résultat</h1>
      <div class="card">
        <div class="score-big">${s.score}%</div>
        <p class="muted" style="text-align:center;margin:0 0 12px">${good} bonnes réponses sur ${s.items.length} · ${fmtDate(s.created)}</p>
        <div class="verdict ${passed ? "ok" : "ko"}">${passed ? "Objectif atteint 🎉" : `Objectif de ${db.settings.threshold}% non atteint — on continue !`}</div>
      </div>
      <div class="card">
        ${Object.entries(byTheme).map(([t, v]) => { const r = pct(v.ok, v.n); return `
          <div class="bar-line"><div class="lbl"><span>${esc(THEMES[t])}</span><b>${v.ok}/${v.n}</b></div>
          <div class="bar"><div style="width:${r}%;background:${colorFor(r)}"></div></div></div>`; }).join("")}
      </div>
      <div class="row" style="margin-bottom:6px">
        <button class="btn primary" id="again">Nouvelle session</button>
        <button class="btn" id="home">Accueil</button>
      </div>

      <h2>Correction</h2>
      <div class="filters">
        <button class="btn ${filter === "ko" ? "on" : ""}" data-f="ko">Erreurs (${s.items.length - good})</button>
        <button class="btn ${filter === "ok" ? "on" : ""}" data-f="ok">Justes (${good})</button>
        <button class="btn ${filter === "all" ? "on" : ""}" data-f="all">Toutes</button>
      </div>
      ${list.length ? list.map((it) => reviewItem(it)).join("") : `<p class="muted">Rien à afficher.</p>`}
      <button class="btn danger" id="del" style="margin-top:20px">Supprimer cette session</button>
    `;
    app.querySelector("#again").onclick = renderHome;
    app.querySelector("#home").onclick = renderHome;
    app.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => renderResults(id, b.dataset.f));
    app.querySelector("#del").onclick = () => {
      if (!confirm("Supprimer cette session de l'historique ?")) return;
      db.sessions = db.sessions.filter((x) => x.id !== id); save(); renderHome();
    };
  }

  function reviewItem(it) {
    const q = QUESTIONS[it.id];
    const sel = it.sel || [];
    const lis = it.order.map((i, d) => {
      const cls = q.ans.includes(i) ? "good" : sel.includes(i) ? "bad" : "";
      const mark = q.ans.includes(i) ? " ✓" : "";
      return `<li class="${cls}"><b>${LETTERS[d]}.</b> ${esc(q.o[i])}${mark}${sel.includes(i) ? " <em class='muted'>(votre choix)</em>" : ""}</li>`;
    }).join("");
    return `<div class="card review-item ${it.ok ? "ok" : "ko"}">
      <span class="tag">${esc(THEMES[q.t])}</span>
      <div style="font-weight:650;margin-top:8px">${esc(q.q)}</div>
      ${!it.sel ? `<p class="muted small" style="margin:6px 0 0">Non répondue</p>` : ""}
      <ul>${lis}</ul>
      <p class="muted small" style="margin:10px 0 0">${esc(q.e)}</p>
    </div>`;
  }

  // ---------- Export / import ----------
  function exportData() {
    const blob = new Blob([JSON.stringify(db, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `caces-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importData(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!Array.isArray(data.sessions) || typeof data.qstats !== "object") throw 0;
        if (!confirm("Remplacer les données actuelles par cette sauvegarde ?")) return;
        db = Object.assign(defaults(), data); save(); toast("Sauvegarde importée"); renderHome();
      } catch { toast("Fichier invalide"); }
    };
    r.readAsText(f);
  }

  // ---------- Navigation ----------
  document.getElementById("homeBtn").onclick = () => { removeBar(); renderHome(); };

  // Clavier (pratique sur ordinateur) : A-D / 1-4 pour choisir, Entrée pour valider/suivant
  document.addEventListener("keydown", (e) => {
    const bar = document.querySelector(".action-bar");
    if (!bar) return;
    const k = e.key.toUpperCase();
    let idx = LETTERS.indexOf(k);
    if (idx < 0 && /^[1-8]$/.test(k)) idx = Number(k) - 1;
    const opts = app.querySelectorAll(".opt:not([disabled])");
    if (idx >= 0 && opts[idx]) { opts[idx].click(); return; }
    if (e.key === "Enter") { const b = bar.querySelector(".btn.primary:not([disabled])"); if (b) { e.preventDefault(); b.click(); } }
    if (e.key === "ArrowLeft") bar.querySelector("#prev")?.click();
  });

  // Au démarrage : reprendre directement la session en cours si elle existe
  const run = current();
  run ? renderQuiz(run.id) : renderHome();
})();
