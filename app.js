/* APS Prep: flashcards, daily check-in and progress, stored in localStorage. */
(function () {
  "use strict";

  const STORAGE_KEY = "aps-prep-v1";
  const CARDS = window.QUESTIONS || [];
  const BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));
  // Leitner boxes: days until the next review after a "Thuộc" answer in this box.
  const INTERVALS = [0, 1, 2, 4, 7, 14, 30];
  const MASTERED_BOX = 4;
  const SOURCE_ORDER = ["subject", "reported", "thesis", "calc", "personal"];
  // The last days before the exam are for review only: no new cards, and the final reviews are spread over them.
  const REVIEW_ONLY_DAYS = 3;
  const DEVICE_KEY = "aps-prep-device";

  // ---------- dates ----------
  function dateKey(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function today() { return dateKey(new Date()); }
  function addDays(key, n) {
    const [y, m, d] = key.split("-").map(Number);
    return dateKey(new Date(y, m - 1, d + n));
  }
  function daysBetween(fromKey, toKey) {
    const [a, b] = [fromKey, toKey].map((k) => { const [y, m, d] = k.split("-").map(Number); return Date.UTC(y, m - 1, d); });
    return Math.round((b - a) / 86400000);
  }

  // ---------- state ----------
  function defaultState() {
    return { cards: {}, days: {}, mocks: [], settings: { examDate: "2026-11-19", dailyGoal: 25, lang: "both" } };
  }
  // Each browser gets its own id, kept outside the backup, so merged daily counts from two devices add up correctly.
  const DEVICE = (() => {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "d-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  })();
  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (raw && raw.cards && raw.days) {
        return { ...defaultState(), ...raw, settings: { ...defaultState().settings, ...raw.settings } };
      }
    } catch (e) { /* fall through to a fresh state */ }
    return defaultState();
  }
  let state = loadState();
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  // Day records keep per-device counts in `dev`; reviewed/good/newSeen are their sums.
  // Days recorded before devices were tracked keep their counts under "legacy".
  const DAY_FIELDS = ["reviewed", "good", "newSeen"];
  function normalizeDay(day) {
    if (!day.dev) day.dev = { legacy: { reviewed: day.reviewed || 0, good: day.good || 0, newSeen: day.newSeen || 0 } };
    for (const f of DAY_FIELDS) day[f] = Object.values(day.dev).reduce((sum, d) => sum + (d[f] || 0), 0);
    return day;
  }
  function dayRecord(key) {
    if (!state.days[key]) state.days[key] = { checkedIn: false, dev: {} };
    const day = normalizeDay(state.days[key]);
    if (!day.dev[DEVICE]) day.dev[DEVICE] = { reviewed: 0, good: 0, newSeen: 0 };
    return day;
  }
  function dayStats(key) {
    return state.days[key] ? normalizeDay(state.days[key]) : { checkedIn: false, reviewed: 0, good: 0, newSeen: 0 };
  }
  function cardStatus(id) {
    const rec = state.cards[id];
    if (!rec) return "new";
    return rec.box >= MASTERED_BOX ? "mastered" : "learning";
  }

  // ---------- pacing towards the exam ----------
  function lastNewDay() { return addDays(state.settings.examDate, -(REVIEW_ONLY_DAYS + 1)); }
  // A review that would fall after the exam is moved into the review-only days before it,
  // spread by card so they do not all land on the same day. The stored due date is kept,
  // so changing the exam date recalculates this.
  function dueOf(id) {
    const rec = state.cards[id];
    let spread = 0;
    for (const ch of id) spread = (spread * 31 + ch.charCodeAt(0)) % 997;
    const finalReview = addDays(state.settings.examDate, -1 - (spread % REVIEW_ONLY_DAYS));
    return rec.due > finalReview && finalReview > rec.last ? finalReview : rec.due;
  }
  function isDue(id, key) {
    return Boolean(state.cards[id]) && dueOf(id) <= key;
  }
  // Order for new cards: questions from real interview reports, then ⭐, then the rest mixed across sources.
  function newPriority(card) {
    if ((card.subsection || "").startsWith("12.") || card.source === "reported") return 0;
    return card.star ? 1 : 2;
  }
  const SOURCE_POS = (() => {
    const seen = {}, total = {}, pos = {};
    for (const c of CARDS) total[c.source] = (total[c.source] || 0) + 1;
    for (const c of CARDS) { seen[c.source] = (seen[c.source] || 0) + 1; pos[c.id] = seen[c.source] / total[c.source]; }
    return pos;
  })();
  function freshOrdered(pool) {
    return pool.filter((c) => !state.cards[c.id])
      .sort((a, b) => newPriority(a) - newPriority(b) || (newPriority(a) === 2 ? SOURCE_POS[a.id] - SOURCE_POS[b.id] : 0));
  }
  // How many new cards to learn today so that every card has been seen before the review-only days.
  function pace() {
    const key = today();
    const seenToday = dayStats(key).newSeen;
    const fresh = CARDS.filter((c) => !state.cards[c.id]).length;
    const stop = lastNewDay();
    const reviewOnly = key > stop;
    const daysLeft = reviewOnly ? 0 : daysBetween(key, stop) + 1;
    const quota = reviewOnly ? 0 : Math.ceil((fresh + seenToday) / daysLeft);
    return { fresh, seenToday, quota, daysLeft, stop, reviewOnly, newLeft: Math.max(0, Math.min(fresh, quota - seenToday)) };
  }
  function todayPlan() {
    const key = today();
    const p = pace();
    const due = CARDS.filter((c) => isDue(c.id, key));
    const dueUnseen = due.filter((c) => state.cards[c.id].last !== key).length;
    const reviewed = dayStats(key).reviewed;
    const target = Math.max(state.settings.dailyGoal, reviewed + dueUnseen + p.newLeft);
    return { ...p, due, dueUnseen, reviewed, target };
  }

  function checkIn() {
    dayRecord(today()).checkedIn = true;
    save();
  }

  // grade: 0 = Chưa thuộc, 1 = Tạm, 2 = Thuộc
  function gradeCard(id, grade) {
    const key = today();
    const isNew = !state.cards[id];
    const rec = state.cards[id] || { box: 0, due: key, reviews: 0, lapses: 0 };
    const firstToday = rec.last !== key;
    if (grade === 0) {
      rec.box = 0;
      rec.lapses += 1;
      rec.due = key;
    } else if (grade === 1) {
      rec.box = Math.max(1, rec.box);
      rec.due = addDays(key, 1);
    } else if (firstToday || rec.lastGrade !== 2) {
      // A second "Thuộc" on the same day (e.g. in random mode) does not move the card up again.
      rec.box = Math.min(rec.box + 1, INTERVALS.length - 1);
      rec.due = addDays(key, INTERVALS[rec.box]);
    }
    rec.reviews += 1;
    rec.last = key;
    rec.lastGrade = grade;
    state.cards[id] = rec;
    const day = dayRecord(key);
    day.checkedIn = true;
    // Count each card once per day, even when "Chưa thuộc" repeats it in the same session.
    if (firstToday) {
      const mine = day.dev[DEVICE];
      mine.reviewed += 1;
      if (grade === 2) mine.good += 1;
      if (isNew) mine.newSeen += 1;
      normalizeDay(day);
    }
    save();
  }

  function streaks() {
    const active = (k) => state.days[k] && (state.days[k].checkedIn || state.days[k].reviewed > 0);
    let current = 0;
    let cursor = active(today()) ? today() : addDays(today(), -1);
    while (active(cursor)) { current += 1; cursor = addDays(cursor, -1); }
    const keys = Object.keys(state.days).filter(active).sort();
    let best = 0, run = 0, prev = null;
    for (const k of keys) {
      run = prev && daysBetween(prev, k) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = k;
    }
    return { current, best };
  }

  // ---------- markdown (subset used in the study guides) ----------
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function inline(s) {
    const codes = [];
    let out = escapeHtml(s).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    out = out
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/\[VERIFY[^\]]*\]/g, (m) => `<span class="verify">${m}</span>`);
    return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
  }
  function markdown(text) {
    const lines = text.split("\n");
    const html = [];
    let list = null, table = null, para = [];
    const flushPara = () => { if (para.length) { html.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
    const flushList = () => { if (list) { html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`); list = null; } };
    const flushTable = () => {
      if (!table) return;
      const rows = table.filter((r) => !/^\|\s*-/.test(r)).map((r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
      const [head, ...body] = rows;
      html.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      table = null;
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      const ul = line.match(/^\s*[-•]\s+(.*)$/);
      const ol = line.match(/^\s*\d+\.\s+(.*)$/);
      if (line.startsWith("|")) { flushPara(); flushList(); (table = table || []).push(line); continue; }
      flushTable();
      if (!line.trim()) { flushPara(); flushList(); continue; }
      if (ul || ol) {
        flushPara();
        const tag = ul ? "ul" : "ol";
        if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
        list.items.push((ul || ol)[1]);
        continue;
      }
      if (line.startsWith(">")) { flushPara(); flushList(); html.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`); continue; }
      flushList();
      // Lines that start a labelled block ("*Say it:*", "**Follow-up:**") begin a new paragraph.
      if (/^\*{1,2}[A-Z][^*]{0,40}:\*{1,2}/.test(line)) flushPara();
      para.push(line.trim());
    }
    flushPara(); flushList(); flushTable();
    return html.join("");
  }

  // ---------- written-answer feedback: keyword coverage + copy prompt for an AI ----------
  const STOP = new Set(("a an the and or but if then than so of in on at to for from by with without as is are was " +
    "were be been being it its this that these those there their they them we you your my our his her he she me not no " +
    "can could would should will may might must do does did done has have had also very more most less only such etc " +
    "which what when where who whom how why each every all any some one two three four five into over under about after " +
    "before between both same other others while because like just even much many often usually say see example eg ie " +
    "workbook get gets make makes made use used uses using way ways thing things well first second third part").split(" "));
  const WORD = /[A-Za-z][A-Za-z0-9/]*|\d[\d,.]*%?/g;

  function stem(token) {
    let w = token.toLowerCase().replace(/[,]/g, "").replace(/\.$/, "").replace(/'s$/, "");
    if (/^\d/.test(w)) return w;
    if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
    else if (w.length > 4 && w.endsWith("sses")) w = w.slice(0, -2);
    else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
    if (w.length > 6 && w.endsWith("ing")) w = w.slice(0, -3);
    else if (w.length > 5 && w.endsWith("ed")) w = w.slice(0, -2);
    return w;
  }
  function isKeyword(token) {
    const s = stem(token);
    if (/^[qp]\d+$/.test(s)) return false;          // cross-references such as Q34 or P28
    if (/^\d/.test(s)) return s.replace(/\D/g, "").length >= 2 || /[.%]/.test(s);
    return !STOP.has(s) && !STOP.has(token.toLowerCase()) && (s.length >= 3 || s.includes("/"));
  }
  function stemsOf(text) {
    return new Set((text.match(WORD) || []).filter(isKeyword).map(stem));
  }

  // Coverage percentage without touching the page, for the mock exam history.
  function coveragePct(card, text) {
    if (!text.trim()) return 0;
    const mine = stemsOf(text);
    const given = stemsOf(card.question);
    const wanted = [...stemsOf(el("div", {}, markdown(card.answer)).textContent)].filter((s) => !given.has(s));
    return wanted.length ? Math.round((wanted.filter((s) => mine.has(s)).length / wanted.length) * 100) : 0;
  }

  // Highlights keywords inside the rendered model answer and returns the coverage numbers.
  // Words already in the question (e.g. "WTO", "principles") are not counted.
  function highlightCoverage(answerEl, mine, given) {
    const wanted = new Set([...stemsOf(answerEl.textContent)].filter((s) => !given.has(s)));
    const hit = new Set([...wanted].filter((s) => mine.has(s)));
    const walker = document.createTreeWalker(answerEl, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue;
      const frag = document.createDocumentFragment();
      let last = 0;
      for (const m of text.matchAll(WORD)) {
        if (!isKeyword(m[0]) || !wanted.has(stem(m[0]))) continue;
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        frag.appendChild(el("mark", { class: hit.has(stem(m[0])) ? "hit" : "miss" })).textContent = m[0];
        last = m.index + m[0].length;
      }
      if (last === 0) continue;
      frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
    return { hit: hit.size, total: wanted.size };
  }

  // Bold phrases in the model answer ("**Transaction risk**") serve as a checklist of key points.
  function keyPoints(card, mine) {
    return (card.answer.match(/\*\*([^*]+)\*\*/g) || [])
      .map((b) => b.slice(2, -2).trim())
      .filter((b) => !b.endsWith(":"))
      .map((point) => {
        const need = [...stemsOf(point.replace(/\(.*?\)/g, ""))];
        const found = need.filter((s) => mine.has(s)).length;
        return { point, ok: need.length > 0 && found / need.length >= 0.6 };
      });
  }

  function aiPrompt(card, text) {
    return [
      "You are an examiner at the APS (Akademische Prüfstelle) interview in Ho Chi Minh City. The candidate holds a Bachelor's degree in International Business (UEH, Vietnam). This is the short written part (about 5 minutes per question).",
      "", `QUESTION:\n${card.question}`,
      "", `MODEL ANSWER (a reference, not the only correct answer):\n${card.answer}`,
      "", `MY ANSWER:\n${text.trim()}`,
      "", "Please:",
      "1. Score my answer from 0 to 10 for content, and say whether it would be acceptable at the APS.",
      "2. List the important points I missed and anything I got wrong.",
      "3. Correct my English briefly (grammar and technical terms).",
      "4. Write an improved answer of 4–6 sentences that I could realistically write in 5 minutes.",
      "Give the feedback in Vietnamese and the improved answer in English.",
    ].join("\n");
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const t = el("textarea");
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
  }

  // Fills a ".feedback" box in `container` by comparing `text` with the card's model answer.
  function attachFeedback(container, card, text) {
    const box = container.querySelector(".feedback");
    const answerEl = container.querySelector(".card-a");
    if (!box || !answerEl || !text.trim() || card.source === "personal") return;
    const mine = stemsOf(text);
    answerEl.classList.add("graded");
    const { hit, total } = highlightCoverage(answerEl, mine, stemsOf(card.question));
    const pct = total ? Math.round((hit / total) * 100) : 0;
    // Model answers are long spoken scripts, so a good 5-minute written answer covers roughly 35-50%.
    const level = pct >= 35 ? "g2" : pct >= 18 ? "g1" : "g0";
    const verdict = { g2: "Đủ ý chính", g1: "Tạm, còn thiếu ý", g0: "Thiếu nhiều ý" }[level];
    const points = keyPoints(card, mine);
    box.innerHTML = `
      <div class="fb-head"><b>So với đáp án mẫu</b><span class="fb-score ${level}">${pct}%</span><span class="${level}">${verdict}</span><span class="muted small">${hit}/${total} từ khóa</span></div>
      <div class="goal-bar"><div class="goal-fill ${level}" style="width:${pct}%"></div></div>
      ${points.length >= 2 ? `<ul class="fb-points">${points.map((p) => `<li class="${p.ok ? "ok" : "missing"}">${p.ok ? "✓" : "✗"} ${inline(p.point)}</li>`).join("")}</ul>` : ""}
      <p class="muted small">Trong đáp án mẫu: <mark class="hit">xanh</mark> = bạn đã viết, <mark class="miss">đỏ</mark> = còn thiếu. Đáp án mẫu là bài nói dài, nên bài viết 5 phút đạt khoảng 35% đã là đủ ý chính. Đây chỉ là so từ khóa: viết đúng ý bằng từ khác vẫn bị tính thiếu, và có đủ từ khóa chưa chắc đã giải thích đúng.</p>
      <button class="btn btn-ghost btn-copy">📋 Copy để nhờ AI chấm kỹ</button>`;
    const btn = box.querySelector(".btn-copy");
    btn.addEventListener("click", async () => {
      await copyText(aiPrompt(card, text));
      btn.textContent = "✓ Đã copy. Dán vào Claude.ai (hoặc Claude Code) để được chấm";
    });
  }

  // ---------- Vietnamese translation and abbreviation glossary ----------
  function lang() { return state.settings.lang || "both"; }
  function hasVi(card) { return Boolean(card.vi); }

  // Question block: in "vi" mode the Vietnamese leads and the English (the exam language) stays visible below.
  function questionHtml(card) {
    const en = markdown(card.question);
    if (!hasVi(card) || lang() === "en") return `<div class="card-q">${en}</div>`;
    const vi = markdown(card.vi.question);
    return lang() === "vi"
      ? `<div class="card-q">${vi}</div><div class="card-q-alt muted">${en}</div>`
      : `<div class="card-q">${en}</div><div class="card-q-alt vi-text">${vi}</div>`;
  }
  // Answer block. The English answer always has class "card-a" because written feedback compares against it.
  function answerHtml(card, hidden) {
    const en = `<div class="card-a">${markdown(card.answer)}</div>`;
    let body = en;
    if (hasVi(card) && lang() === "both") {
      body = `${en}<div class="card-vi"><div class="vi-label">Tiếng Việt</div>${markdown(card.vi.answer)}</div>`;
    } else if (hasVi(card) && lang() === "vi") {
      body = `<div class="card-vi">${markdown(card.vi.answer)}</div><details class="en-original"><summary>Bản tiếng Anh (dùng khi đi thi)</summary>${en}</details>`;
    }
    return `<div class="answer${hidden ? " hidden" : ""}">${body}</div>`;
  }
  function termInText(term, text) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    return new RegExp(`(^|[^A-Za-z0-9])${escaped}($|[^A-Za-z0-9])`).test(text);
  }
  // Before the answer is revealed, only list abbreviations from the question, so the list does not give the answer away.
  function glossaryHtml(card, revealed) {
    const all = card.glossary || [];
    const shown = revealed ? all : all.filter((g) => termInText(g.term, card.question));
    if (!shown.length) return "";
    const hiddenCount = all.length - shown.length;
    return `<div class="glossary"><div class="glossary-title">Chữ viết tắt</div><dl>${shown.map((g) =>
      `<dt>${escapeHtml(g.term)}</dt><dd><span class="g-full">${escapeHtml(g.full)}</span> · ${inline(g.vi)}</dd>`).join("")}</dl>${
      hiddenCount ? `<div class="muted small">+${hiddenCount} từ nữa sẽ hiện khi xem đáp án</div>` : ""}</div>`;
  }

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  function el(tag, attrs = {}, html = "") {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v; else if (k.startsWith("on")) node.addEventListener(k.slice(2), v); else node.setAttribute(k, v);
    }
    if (html) node.innerHTML = html;
    return node;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function sourceLabel(src) { return (CARDS.find((c) => c.source === src) || {}).sourceLabel || src; }
  function sectionsOf(src) {
    const seen = [];
    for (const c of CARDS) if ((src === "all" || c.source === src) && !seen.includes(c.section)) seen.push(c.section);
    return seen;
  }
  function counts(cards) {
    const r = { mastered: 0, learning: 0, new: 0, total: cards.length };
    for (const c of cards) r[cardStatus(c.id)] += 1;
    return r;
  }

  // ---------- views ----------
  let currentView = "today";
  function showView(name) {
    currentView = name;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
    if (name === "today") renderToday();
    if (name === "progress") renderProgress();
    if (name === "mock" && !mock) renderMockIntro();
  }

  function renderToday() {
    const key = today();
    const { examDate, dailyGoal } = state.settings;
    const left = daysBetween(key, examDate);
    $("#countdown").textContent = left >= 0 ? `${left} ngày` : "Đã qua";
    $("#exam-date-label").textContent = `Ngày thi: ${examDate.split("-").reverse().join("/")}`;

    const s = streaks();
    $("#streak").textContent = `${s.current} ngày`;
    $("#streak-best").textContent = `Kỷ lục: ${s.best} ngày`;

    const c = counts(CARDS);
    $("#mastered-pct").textContent = c.total ? `${Math.round((c.mastered / c.total) * 100)}%` : "–";
    $("#mastered-count").textContent = `${c.mastered} / ${c.total} thẻ · ${c.learning} đang học`;

    const day = dayStats(key);
    const plan = todayPlan();
    document.querySelectorAll(".goal-n").forEach((n) => (n.textContent = plan.target));
    $("#checkin-title").textContent = day.checkedIn
      ? (day.reviewed >= plan.target ? "Xong mục tiêu hôm nay 🎉" : "Đã điểm danh hôm nay ✓")
      : "Bạn chưa điểm danh hôm nay";
    $("#btn-checkin").disabled = day.checkedIn;
    $("#btn-checkin").textContent = day.checkedIn ? "✓ Đã điểm danh" : "✓ Điểm danh";
    $("#goal-fill").style.width = `${Math.min(100, (day.reviewed / plan.target) * 100)}%`;
    $("#goal-text").textContent = `Hôm nay: ${day.reviewed} / ${plan.target} thẻ (${day.newSeen} thẻ mới) · ${day.good} thẻ "Thuộc"`;

    renderHeatmap();

    const fmt = (k) => k.split("-").reverse().slice(0, 2).join("/");
    const paceLine = plan.reviewOnly
      ? `<li>Đang trong ${REVIEW_ONLY_DAYS} ngày cuối: chỉ ôn lại, không thêm thẻ mới${plan.fresh ? ` (còn ${plan.fresh} thẻ chưa học, học ở Luyện tập › Chỉ câu mới nếu còn sức)` : ""}.</li>`
      : `<li>Thẻ mới hôm nay: <b>${plan.seenToday} / ${plan.quota}</b>${plan.newLeft ? ` · còn ${plan.newLeft}` : " ✓"}</li>
         <li class="muted small">Để học hết ${plan.fresh + plan.seenToday} thẻ chưa học trước ${fmt(plan.stop)} (còn ${plan.daysLeft} ngày học thẻ mới) cần khoảng ${plan.quota} thẻ mới/ngày. Bỏ một ngày thì các ngày sau tự tăng lên.</li>`;
    $("#queue-summary").innerHTML = `
      <li><b>${plan.dueUnseen}</b> thẻ đến hạn ôn lại</li>
      ${paceLine}
      <li class="muted small">Thứ tự thẻ mới: câu từ các buổi phỏng vấn thật (Section 12), rồi ⭐, rồi các phần còn lại xen kẽ. Lần ôn nào rơi sau ngày thi được dời vào ${REVIEW_ONLY_DAYS} ngày cuối (${fmt(addDays(examDate, -REVIEW_ONLY_DAYS))}–${fmt(addDays(examDate, -1))}) để thẻ nào cũng được ôn lại trước khi thi.</li>`;

    const weak = Object.entries(state.cards).filter(([id, r]) => r.lapses > 0 && BY_ID[id])
      .sort((a, b) => b[1].lapses - a[1].lapses || a[1].box - b[1].box).slice(0, 5);
    $("#weak-list").innerHTML = weak.length
      ? weak.map(([id, r]) => `<li><button class="weak-item" data-id="${escapeHtml(id)}" title="Luyện câu này"><span class="tag">${BY_ID[id].sourceLabel} ${escapeHtml(BY_ID[id].num)}</span> ${inline(BY_ID[id].question.split("\n")[0].slice(0, 90))} <span class="muted small">· sai ${r.lapses} lần</span></button></li>`).join("")
      : '<li class="muted">Chưa có. Bấm "Chưa thuộc" khi bí, thẻ sẽ hiện ở đây.</li>';
    $("#btn-weak-all").hidden = !weak.length;
    document.querySelectorAll("#weak-list .weak-item").forEach((b) => b.addEventListener("click", () => {
      showView("practice");
      startPractice([BY_ID[b.dataset.id]]);
    }));
  }

  function renderHeatmap() {
    const box = $("#heatmap");
    box.innerHTML = "";
    const key = today();
    const [y, m, d] = key.split("-").map(Number);
    const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday = 0
    const start = addDays(key, -(7 * 11 + weekday));
    for (let i = 0; i < 7 * 12; i++) {
      const k = addDays(start, i);
      const future = k > key;
      const rec = state.days[k];
      const n = rec ? rec.reviewed : 0;
      const level = future ? "future" : n >= 40 ? "l4" : n >= 20 ? "l3" : n >= 8 ? "l2" : n > 0 || (rec && rec.checkedIn) ? "l1" : "l0";
      const label = `${k.split("-").reverse().join("/")}: ${n} thẻ${rec && rec.checkedIn ? " · đã điểm danh" : ""}`;
      box.appendChild(el("i", { class: `${level}${k === key ? " today" : ""}`, title: label }));
    }
  }

  function renderProgress() {
    const list = $("#progress-list");
    list.innerHTML = "";
    for (const src of SOURCE_ORDER) {
      const srcCards = CARDS.filter((c) => c.source === src);
      if (!srcCards.length) continue;
      const total = counts(srcCards);
      list.appendChild(el("div", { class: "progress-source" }, `<b>${sourceLabel(src)}</b> <span class="muted small">${total.mastered}/${total.total} đã thuộc</span>${bar(total)}`));
      for (const section of sectionsOf(src)) {
        const cards = srcCards.filter((c) => c.section === section);
        const cnt = counts(cards);
        const row = el("button", { class: "progress-row", title: "Luyện phần này" },
          `<span class="progress-name">${escapeHtml(section)}</span><span class="progress-n muted small">${cnt.mastered}/${cnt.total}</span>${bar(cnt)}`);
        row.addEventListener("click", () => {
          showView("practice");
          $("#f-source").value = src; fillSections(); $("#f-section").value = section; $("#f-mode").value = "due";
          startPractice();
        });
        list.appendChild(row);
      }
    }
    $("#s-exam").value = state.settings.examDate;
    $("#s-goal").value = state.settings.dailyGoal;
    $("#mock-history").innerHTML = mockHistoryHtml(30) || '<div class="panel"><h3>Lịch sử thi thử</h3><p class="muted">Chưa có lần thi thử nào. Kết quả được lưu khi bạn làm xong phần nói.</p></div>';
  }
  function bar(c) {
    const pct = (n) => (c.total ? (n / c.total) * 100 : 0);
    return `<div class="seg-bar"><i class="seg-m" style="width:${pct(c.mastered)}%"></i><i class="seg-l" style="width:${pct(c.learning)}%"></i></div>`;
  }

  // ---------- practice ----------
  let session = null;

  function fillSources() {
    const sel = $("#f-source");
    sel.innerHTML = `<option value="all">Tất cả (${CARDS.length})</option>` +
      SOURCE_ORDER.filter((s) => CARDS.some((c) => c.source === s))
        .map((s) => `<option value="${s}">${sourceLabel(s)} (${CARDS.filter((c) => c.source === s).length})</option>`).join("");
  }
  function fillSections() {
    const src = $("#f-source").value;
    $("#f-section").innerHTML = `<option value="all">Tất cả</option>` +
      sectionsOf(src).map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  }

  function buildQueue({ source = "all", section = "all", mode = "due", starOnly = false, limit = Infinity }) {
    const key = today();
    let pool = CARDS.filter((c) => (source === "all" || c.source === source) && (section === "all" || c.section === section) && (!starOnly || c.star));
    if (mode === "random") return shuffle(pool).slice(0, limit);
    if (mode === "new") return freshOrdered(pool).slice(0, limit);
    if (mode === "weak") {
      return pool.filter((c) => state.cards[c.id] && state.cards[c.id].lapses > 0)
        .sort((a, b) => state.cards[b.id].lapses - state.cards[a.id].lapses).slice(0, limit);
    }
    const due = shuffle(pool.filter((c) => isDue(c.id, key))).sort((a, b) => dueOf(a.id).localeCompare(dueOf(b.id)));
    return [...due, ...freshOrdered(pool)].slice(0, limit);
  }

  // Today's session: everything due, today's share of new cards, topped up with more new cards
  // if that is still below the daily minimum (not during the review-only days).
  function todayQueue() {
    const plan = todayPlan();
    const due = shuffle(plan.due).sort((a, b) => dueOf(a.id).localeCompare(dueOf(b.id)));
    const topUp = plan.reviewOnly ? 0 : Math.max(0, state.settings.dailyGoal - plan.reviewed - plan.dueUnseen - plan.newLeft);
    return [...due, ...freshOrdered(CARDS).slice(0, plan.newLeft + topUp)];
  }

  function startPractice(queue) {
    const q = queue || buildQueue({
      source: $("#f-source").value, section: $("#f-section").value,
      mode: $("#f-mode").value, starOnly: $("#f-star").checked,
    });
    session = { queue: q, index: 0, revealed: false, done: 0, again: [], tally: [0, 0, 0] };
    renderCard();
  }

  function renderCard() {
    const area = $("#practice-area");
    if (!session) { area.innerHTML = '<div class="panel empty">Chọn bộ lọc rồi bấm <b>Bắt đầu</b>.</div>'; return; }
    if (session.index >= session.queue.length && session.again.length) {
      session.queue.push(...session.again.splice(0));
    }
    if (session.index >= session.queue.length) {
      const [a, h, g] = session.tally;
      area.innerHTML = session.done
        ? `<div class="panel empty"><h2>Xong buổi ôn 🎉</h2><p>${session.done} lượt: <b class="g2">${g}</b> thuộc · <b class="g1">${h}</b> tạm · <b class="g0">${a}</b> chưa thuộc.</p><p class="muted">Thẻ "Chưa thuộc" đã được hỏi lại trong buổi này và sẽ quay lại vào ngày mai.</p><button class="btn btn-primary" id="btn-back-today">Về trang Hôm nay</button></div>`
        : '<div class="panel empty"><h2>Không có thẻ nào phù hợp</h2><p class="muted">Đổi bộ lọc, hoặc chọn chế độ "Ngẫu nhiên tất cả" để ôn thêm.</p></div>';
      const back = $("#btn-back-today");
      if (back) back.addEventListener("click", () => showView("today"));
      return;
    }
    const card = session.queue[session.index];
    const rec = state.cards[card.id];
    const statusText = rec ? `hộp ${rec.box} · đã ôn ${rec.reviews} lần` : "thẻ mới";
    area.innerHTML = `
      <div class="session-bar"><span>${session.index + 1} / ${session.queue.length}</span><div class="goal-bar"><div class="goal-fill" style="width:${(session.index / session.queue.length) * 100}%"></div></div></div>
      <article class="panel card">
        <div class="card-meta"><span class="tag">${card.sourceLabel} ${escapeHtml(card.num)}</span>${card.star ? '<span class="tag star">⭐</span>' : ""}<span class="muted small">${escapeHtml(card.section)}${card.subsection ? " · " + escapeHtml(card.subsection) : ""}</span><span class="muted small right">${statusText}</span></div>
        ${questionHtml(card)}
        ${glossaryHtml(card, session.revealed)}
        <details class="draft"${session.draft ? " open" : ""}><summary>Viết nháp câu trả lời (luyện phần thi viết, có so với đáp án)</summary><textarea placeholder="Gõ câu trả lời của bạn trước khi xem đáp án…">${escapeHtml(session.draft || "")}</textarea></details>
        ${answerHtml(card, !session.revealed)}
        <div class="feedback"></div>
        <div class="card-actions">
          ${session.revealed
            ? `<button class="btn grade g0" data-g="0">Chưa thuộc <kbd>1</kbd></button><button class="btn grade g1" data-g="1">Tạm <kbd>2</kbd></button><button class="btn grade g2" data-g="2">Thuộc <kbd>3</kbd></button>`
            : `<button class="btn btn-primary" id="btn-reveal">Hiện đáp án <kbd>Space</kbd></button><button class="btn btn-ghost" id="btn-skip">Bỏ qua</button>`}
        </div>
      </article>`;
    if (session.revealed) {
      if (session.draft && lang() === "vi") area.querySelectorAll("details.en-original").forEach((d) => (d.open = true));
      attachFeedback(area.querySelector(".card"), card, session.draft || "");
      area.querySelectorAll(".grade").forEach((b) => b.addEventListener("click", () => grade(Number(b.dataset.g))));
    } else {
      $("#btn-reveal").addEventListener("click", reveal);
      $("#btn-skip").addEventListener("click", () => { session.index += 1; session.draft = ""; renderCard(); });
    }
  }
  function reveal() {
    if (!session || session.revealed) return;
    const draft = document.querySelector("#practice-area textarea");
    session.draft = draft ? draft.value : "";
    session.revealed = true;
    renderCard();
  }
  function grade(g) {
    const card = session.queue[session.index];
    gradeCard(card.id, g);
    session.tally[g] += 1;
    session.done += 1;
    if (g === 0) session.again.push(card);
    session.index += 1;
    session.revealed = false;
    session.draft = "";
    renderCard();
  }

  // ---------- mock exam (APS format: written ~15 min, then oral ~20 min) ----------
  let mock = null;
  let timer = null;

  function renderMockIntro() {
    clearInterval(timer);
    mock = null;
    $("#mock-area").innerHTML = `
      <div class="panel">
        <h2>Thi thử theo đúng format APS</h2>
        <ol>
          <li><b>Phần viết, 15 phút:</b> 3 câu tự luận. Gõ câu trả lời vào ô, hết giờ thì tự nộp.</li>
          <li><b>Phần nói, 20 phút:</b> 1 câu giới thiệu bản thân, 1 câu về thesis, 4 câu môn học. Trả lời <i>thành tiếng</i>, rồi tự chấm từng câu.</li>
          <li>Cuối buổi so bài viết với đáp án mẫu. Mọi câu đã chấm đều được tính vào tiến độ.</li>
        </ol>
        <p class="muted small">Câu hỏi lấy ngẫu nhiên, ưu tiên câu ⭐ và câu từ các bài review thật (Section 12).</p>
        <button class="btn btn-primary" id="btn-mock-start">Bắt đầu thi thử</button>
      </div>
      ${mockHistoryHtml(5)}`;
    $("#btn-mock-start").addEventListener("click", startMock);
  }

  function pick(pool, n, exclude) {
    return shuffle(pool.filter((c) => !exclude.has(c.id))).slice(0, n).map((c) => { exclude.add(c.id); return c; });
  }
  function startMock() {
    const used = new Set();
    const written = pick(CARDS.filter((c) => c.subsection.startsWith("12.2")), 1, used)
      .concat(pick(CARDS.filter((c) => (c.source === "subject" || c.source === "reported") && c.star), 2, used));
    const oral = pick(CARDS.filter((c) => c.id === "subject-Q132" || c.source === "personal"), 1, used)
      .concat(pick(CARDS.filter((c) => c.source === "subject" && c.star), 3, used))
      .concat(pick(CARDS.filter((c) => c.source === "reported" || c.subsection.startsWith("12.3")), 1, used))
      .concat(pick(CARDS.filter((c) => c.source === "thesis"), 1, used));
    mock = { phase: "written", written, answers: written.map(() => ""), oral, oralIndex: 0, revealed: false, graded: {} };
    startTimer(15 * 60, () => finishWritten());
    renderMock();
  }
  function startTimer(seconds, onEnd) {
    clearInterval(timer);
    mock.endsAt = Date.now() + seconds * 1000;
    timer = setInterval(() => {
      const t = document.querySelector("#mock-timer");
      const left = Math.max(0, Math.round((mock.endsAt - Date.now()) / 1000));
      if (t) { t.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; t.classList.toggle("urgent", left <= 60); }
      if (left <= 0) { clearInterval(timer); onEnd(); }
    }, 250);
  }
  function finishWritten() {
    document.querySelectorAll("#mock-area textarea[data-i]").forEach((t) => (mock.answers[Number(t.dataset.i)] = t.value));
    mock.phase = "oral";
    mock.revealed = false;
    startTimer(20 * 60, () => { mock.timeUp = true; const t = $("#mock-timer"); if (t) t.textContent = "Hết giờ"; });
    renderMock();
  }

  function renderMock() {
    const area = $("#mock-area");
    if (mock.phase === "written") {
      area.innerHTML = `
        <div class="mock-head panel"><b>Phần viết</b><span>3 câu · trả lời ngắn gọn: định nghĩa → 2–4 ý → 1 ví dụ</span><span class="timer" id="mock-timer">15:00</span></div>
        ${mock.written.map((c, i) => `
          <article class="panel card">
            <div class="card-meta"><span class="tag">Câu ${i + 1}</span><span class="muted small">${c.sourceLabel} ${escapeHtml(c.num)} · ${escapeHtml(c.section)}</span></div>
            ${questionHtml(c)}
            ${glossaryHtml(c, false)}
            <textarea data-i="${i}" rows="7" placeholder="Câu trả lời của bạn…">${escapeHtml(mock.answers[i])}</textarea>
          </article>`).join("")}
        <div class="card-actions"><button class="btn btn-primary" id="btn-submit-written">Nộp bài viết → sang phần nói</button></div>`;
      $("#btn-submit-written").addEventListener("click", finishWritten);
      return;
    }
    if (mock.phase === "oral") {
      const c = mock.oral[mock.oralIndex];
      area.innerHTML = `
        <div class="mock-head panel"><b>Phần nói</b><span>Câu ${mock.oralIndex + 1} / ${mock.oral.length} · nói to, rồi mới xem đáp án</span><span class="timer" id="mock-timer">20:00</span></div>
        <article class="panel card">
          <div class="card-meta"><span class="tag">${c.sourceLabel} ${escapeHtml(c.num)}</span><span class="muted small">${escapeHtml(c.section)}</span></div>
          ${questionHtml(c)}
          ${glossaryHtml(c, mock.revealed)}
          ${answerHtml(c, !mock.revealed)}
          <div class="card-actions">
            ${mock.revealed
              ? `<button class="btn grade g0" data-g="0">Chưa thuộc <kbd>1</kbd></button><button class="btn grade g1" data-g="1">Tạm <kbd>2</kbd></button><button class="btn grade g2" data-g="2">Thuộc <kbd>3</kbd></button>`
              : `<button class="btn btn-primary" id="btn-mock-reveal">Đã trả lời xong, xem đáp án <kbd>Space</kbd></button>`}
          </div>
        </article>`;
      if (mock.revealed) area.querySelectorAll(".grade").forEach((b) => b.addEventListener("click", () => mockGrade(Number(b.dataset.g))));
      else $("#btn-mock-reveal").addEventListener("click", () => { mock.revealed = true; renderMock(); });
      return;
    }
    // review
    clearInterval(timer);
    const oralGood = Object.values(mock.graded).filter((g) => g === 2).length;
    area.innerHTML = `
      <div class="panel"><h2>Kết quả thi thử</h2><p>Phần nói: <b>${oralGood} / ${mock.oral.length}</b> câu "Thuộc". Giờ tự chấm phần viết bằng cách so với đáp án mẫu.</p></div>
      ${mock.written.map((c, i) => `
        <article class="panel card">
          <div class="card-meta"><span class="tag">Câu viết ${i + 1}</span><span class="muted small">${c.sourceLabel} ${escapeHtml(c.num)}</span></div>
          ${questionHtml(c)}
          ${glossaryHtml(c, true)}
          <div class="compare">
            <div><h4>Bài của bạn</h4><div class="mine">${mock.answers[i] ? escapeHtml(mock.answers[i]).replace(/\n/g, "<br>") : '<span class="muted">(bỏ trống)</span>'}</div></div>
            <div><h4>Đáp án mẫu</h4>${answerHtml(c, false)}</div>
          </div>
          <div class="feedback"></div>
          <div class="card-actions" data-wi="${i}">
            ${mock.graded[c.id] === undefined
              ? `<button class="btn grade g0" data-g="0">Chưa đạt</button><button class="btn grade g1" data-g="1">Tạm</button><button class="btn grade g2" data-g="2">Tốt</button>`
              : '<span class="muted">Đã chấm ✓</span>'}
          </div>
        </article>`).join("")}
      <div class="card-actions"><button class="btn btn-primary" id="btn-mock-again">Thi thử lần nữa</button><button class="btn btn-ghost" id="btn-mock-home">Về trang Hôm nay</button></div>`;
    area.querySelectorAll("#mock-area article.card").forEach((art, i) => attachFeedback(art, mock.written[i], mock.answers[i]));
    area.querySelectorAll("[data-wi] .grade").forEach((b) => b.addEventListener("click", () => {
      const c = mock.written[Number(b.closest("[data-wi]").dataset.wi)];
      gradeCard(c.id, Number(b.dataset.g));
      mock.graded[c.id] = Number(b.dataset.g);
      const saved = state.mocks.find((m) => m.id === mock.recordId);
      const entry = saved && saved.written.find((w) => w.id === c.id);
      if (entry) { entry.grade = Number(b.dataset.g); save(); }
      renderMock();
    }));
    $("#btn-mock-again").addEventListener("click", startMock);
    $("#btn-mock-home").addEventListener("click", () => { renderMockIntro(); showView("today"); });
  }
  function mockGrade(g) {
    const c = mock.oral[mock.oralIndex];
    gradeCard(c.id, g);
    mock.graded[c.id] = g;
    mock.oralIndex += 1;
    mock.revealed = false;
    if (mock.oralIndex >= mock.oral.length) {
      mock.phase = "review";
      recordMock();
    }
    renderMock();
  }

  // ---------- mock exam history ----------
  function recordMock() {
    const record = {
      id: `${Date.now().toString(36)}-${DEVICE}`,
      date: today(),
      oral: mock.oral.map((c) => ({ id: c.id, grade: mock.graded[c.id] })),
      written: mock.written.map((c, i) => ({ id: c.id, coverage: coveragePct(c, mock.answers[i]), blank: !mock.answers[i].trim() })),
    };
    state.mocks = [...(state.mocks || []), record];
    mock.recordId = record.id;
    save();
  }
  function mockSummary(m) {
    const oralGood = m.oral.filter((o) => o.grade === 2).length;
    const cov = Math.round(m.written.reduce((s, w) => s + w.coverage, 0) / m.written.length);
    const graded = m.written.filter((w) => w.grade !== undefined);
    const self = graded.length
      ? [2, 1, 0].map((g) => [g, graded.filter((w) => w.grade === g).length]).filter(([, n]) => n)
        .map(([g, n]) => `<b class="g${g}">${n}</b> ${["chưa đạt", "tạm", "tốt"][g]}`).join(" · ")
      : '<span class="muted">chưa chấm</span>';
    return { oralGood, oralTotal: m.oral.length, cov, self };
  }
  function mockHistoryHtml(limit) {
    const list = (state.mocks || []).slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    if (!list.length) return "";
    const rows = list.slice(0, limit).map((m) => {
      const s = mockSummary(m);
      const level = (pct, hi, lo) => (pct >= hi ? "g2" : pct >= lo ? "g1" : "g0");
      return `<tr><td>${m.date.split("-").reverse().join("/")}</td>
        <td><b class="${level(s.oralGood / s.oralTotal, 0.67, 0.34)}">${s.oralGood}/${s.oralTotal}</b></td>
        <td><b class="${level(s.cov, 35, 18)}">${s.cov}%</b></td><td>${s.self}</td></tr>`;
    }).join("");
    let trend = "";
    if (list.length >= 2) {
      const avg = (ms) => ms.reduce((t, m) => t + mockSummary(m).oralGood / m.oral.length, 0) / ms.length;
      const n = Math.min(3, Math.floor(list.length / 2));
      const diff = Math.round((avg(list.slice(0, n)) - avg(list.slice(n, 2 * n))) * 100);
      trend = `<p class="muted small">Phần nói, ${n} lần gần nhất so với ${n} lần trước đó: ${diff > 0 ? `tăng ${diff}` : diff < 0 ? `giảm ${-diff}` : "không đổi"} điểm phần trăm câu "Thuộc".</p>`;
    }
    return `<div class="panel"><h3>Lịch sử thi thử (${list.length} lần)</h3>
      <div class="table-wrap"><table class="mock-history"><thead><tr><th>Ngày</th><th>Nói: câu "Thuộc"</th><th>Viết: độ phủ ý TB</th><th>Viết: tự chấm</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${trend}<p class="muted small">Độ phủ ý là so từ khóa với đáp án mẫu; khoảng 35% đã là đủ ý chính.</p></div>`;
  }

  // ---------- events ----------
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showView(t.dataset.view)));
  $("#btn-checkin").addEventListener("click", () => { checkIn(); renderToday(); });
  $("#btn-start-today").addEventListener("click", () => {
    showView("practice");
    $("#f-source").value = "all"; fillSections(); $("#f-mode").value = "due"; $("#f-star").checked = false;
    startPractice(todayQueue());
  });
  $("#btn-weak-all").addEventListener("click", () => {
    showView("practice");
    $("#f-source").value = "all"; fillSections(); $("#f-mode").value = "weak"; $("#f-star").checked = false;
    startPractice();
  });
  $("#f-source").addEventListener("change", fillSections);
  const THEMES = { auto: "🌓 Tự động", light: "☀️ Sáng", dark: "🌙 Tối" };
  function applyTheme() {
    const theme = state.settings.theme || "auto";
    if (theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    $("#btn-theme").textContent = THEMES[theme];
  }
  $("#btn-theme").addEventListener("click", () => {
    const order = ["auto", "light", "dark"];
    state.settings.theme = order[(order.indexOf(state.settings.theme || "auto") + 1) % order.length];
    save();
    applyTheme();
  });
  function syncLangButtons() {
    document.querySelectorAll(".lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang()));
  }
  document.querySelectorAll(".lang-btn").forEach((b) => b.addEventListener("click", () => {
    const draft = document.querySelector("#practice-area details.draft textarea");
    if (session && draft && !session.revealed) session.draft = draft.value;
    if (mock && mock.phase === "written") document.querySelectorAll("#mock-area textarea[data-i]").forEach((t) => (mock.answers[Number(t.dataset.i)] = t.value));
    state.settings.lang = b.dataset.lang;
    save();
    syncLangButtons();
    if (currentView === "practice") renderCard();
    if (currentView === "mock" && mock) renderMock();
  }));
  $("#btn-start-practice").addEventListener("click", () => startPractice());

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("textarea, input, select")) return;
    if (currentView === "practice" && session) {
      if (e.code === "Space" && !session.revealed && session.index < session.queue.length) { e.preventDefault(); reveal(); }
      else if (session.revealed && ["1", "2", "3"].includes(e.key)) grade(Number(e.key) - 1);
    } else if (currentView === "mock" && mock && mock.phase === "oral") {
      if (e.code === "Space" && !mock.revealed) { e.preventDefault(); mock.revealed = true; renderMock(); }
      else if (mock.revealed && ["1", "2", "3"].includes(e.key)) mockGrade(Number(e.key) - 1);
    }
  });

  $("#s-exam").addEventListener("change", (e) => { if (e.target.value) { state.settings.examDate = e.target.value; save(); } });
  $("#s-goal").addEventListener("change", (e) => { const n = Number(e.target.value); if (n >= 5) { state.settings.dailyGoal = n; save(); } });
  $("#btn-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: `aps-prep-backup-${today()}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  });
  // Merges another device's backup into this one. Safe to repeat: importing the same file twice changes nothing.
  function mergeBackup(data) {
    const result = { cards: 0, days: 0, mocks: 0 };
    for (const [id, theirs] of Object.entries(data.cards)) {
      const mine = state.cards[id];
      if (!mine) { state.cards[id] = theirs; result.cards += 1; continue; }
      const newer = (theirs.last || "") > (mine.last || "") || (theirs.last === mine.last && theirs.reviews > mine.reviews);
      const pick = newer ? { ...theirs } : mine;
      pick.reviews = Math.max(mine.reviews || 0, theirs.reviews || 0);
      pick.lapses = Math.max(mine.lapses || 0, theirs.lapses || 0);
      state.cards[id] = pick;
      if (newer) result.cards += 1;
    }
    for (const [key, theirsRaw] of Object.entries(data.days)) {
      const theirs = normalizeDay({ ...theirsRaw });
      if (!state.days[key]) result.days += 1;
      const day = state.days[key] ? normalizeDay(state.days[key]) : { checkedIn: false, dev: {} };
      // Counts per device only grow, so the larger value is the latest one.
      for (const [dev, counts] of Object.entries(theirs.dev)) {
        const mine = day.dev[dev] || {};
        day.dev[dev] = Object.fromEntries(DAY_FIELDS.map((f) => [f, Math.max(mine[f] || 0, counts[f] || 0)]));
      }
      day.checkedIn = day.checkedIn || Boolean(theirs.checkedIn);
      state.days[key] = normalizeDay(day);
    }
    // The same mock can arrive again with more written answers self-graded; keep the more complete copy.
    const gradedCount = (m) => m.written.filter((w) => w.grade !== undefined).length;
    const mocks = new Map((state.mocks || []).map((m) => [m.id, m]));
    for (const m of data.mocks || []) {
      if (!mocks.has(m.id)) result.mocks += 1;
      if (!mocks.has(m.id) || gradedCount(m) > gradedCount(mocks.get(m.id))) mocks.set(m.id, m);
    }
    state.mocks = [...mocks.values()];
    return result;
  }

  $("#file-import").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.cards || !data.days) throw new Error("not a backup");
      if (!confirm("Gộp file backup này vào tiến độ hiện tại?\n\nMỗi thẻ giữ lần ôn mới nhất từ hai bên, lịch sử các ngày học và các lần thi thử được gộp lại. Cài đặt trên máy này giữ nguyên.")) return;
      const r = mergeBackup(data);
      save();
      renderProgress();
      alert(`Đã gộp backup: ${r.cards} thẻ lấy theo backup, ${r.days} ngày học, ${r.mocks} lần thi thử mới.`);
    } catch (err) {
      alert("File không hợp lệ: " + err.message);
    } finally {
      e.target.value = "";
    }
  });
  $("#btn-reset").addEventListener("click", () => {
    if (!confirm("Xóa toàn bộ tiến độ và lịch sử điểm danh? Không thể hoàn tác (trừ khi bạn có file backup).")) return;
    state = defaultState();
    save();
    renderProgress();
  });

  // ---------- init ----------
  applyTheme();
  syncLangButtons();
  fillSources();
  fillSections();
  renderCard();
  $("#foot").textContent = CARDS.length
    ? `${CARDS.length} thẻ từ các file ôn tập trong APS/. Sửa file .md xong, chạy "python3 APS/quiz-app/build.py" để cập nhật.`
    : 'Chưa có câu hỏi. Chạy "python3 APS/quiz-app/build.py" để tạo questions.js.';
  showView("today");
})();
