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

  // ---------- icons: Lucide (https://lucide.dev, ISC licence), inlined so the app works offline ----------
  const ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    "circle-check": '<circle cx="12" cy="12" r="10"/><path d="m16 9-5.5 5.5L8 12"/>',
    "clipboard-copy": '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M16 4h2a2 2 0 0 1 2 2v4"/><path d="M21 14H11"/><path d="m15 10-4 4 4 4"/>',
    "party-popper": '<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>',
    mic: '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
    square: '<rect width="18" height="18" x="3" y="3" rx="2"/>',
    star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    "sun-moon": '<path d="M12 2v2"/><path d="M14.837 16.385a6 6 0 1 1-7.223-7.222c.624-.147.97.66.715 1.248a4 4 0 0 0 5.26 5.259c.589-.255 1.396.09 1.248.715"/><path d="M16 12a4 4 0 0 0-4-4"/><path d="m19 5-1.256 1.256"/><path d="M20 12h2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
    download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    upload: '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
    reels: '<path d="M7 2h10"/><path d="M5 6h14"/><rect width="18" height="12" x="3" y="10" rx="2"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "chevron-up": '<path d="m18 15-6-6-6 6"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  };
  function icon(name, cls = "") {
    return `<svg class="icon${cls ? " " + cls : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  }
  const STAR = icon("star", "icon-star");

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
      ${points.length >= 2 ? `<ul class="fb-points">${points.map((p) => `<li class="${p.ok ? "ok" : "missing"}">${icon(p.ok ? "check" : "x")} ${inline(p.point)}</li>`).join("")}</ul>` : ""}
      <p class="muted small">Trong đáp án mẫu: <mark class="hit">xanh</mark> = bạn đã viết, <mark class="miss">đỏ</mark> = còn thiếu. Đáp án mẫu là bài nói dài, nên bài viết 5 phút đạt khoảng 35% đã là đủ ý chính. Đây chỉ là so từ khóa: viết đúng ý bằng từ khác vẫn bị tính thiếu, và có đủ từ khóa chưa chắc đã giải thích đúng.</p>
      <button class="btn btn-ghost btn-copy">${icon("clipboard-copy")} Copy để nhờ AI chấm kỹ</button>`;
    const btn = box.querySelector(".btn-copy");
    btn.addEventListener("click", async () => {
      await copyText(aiPrompt(card, text));
      btn.innerHTML = `${icon("check")} Đã copy. Dán vào Claude.ai (hoặc Claude Code) để được chấm`;
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
    $("#checkin-title").innerHTML = day.checkedIn
      ? (day.reviewed >= plan.target ? `Xong mục tiêu hôm nay ${icon("party-popper")}` : `Đã điểm danh hôm nay ${icon("circle-check")}`)
      : "Bạn chưa điểm danh hôm nay";
    $("#btn-checkin").disabled = day.checkedIn;
    $("#btn-checkin").innerHTML = `${icon("check")} ${day.checkedIn ? "Đã điểm danh" : "Điểm danh"}`;
    $("#goal-fill").style.width = `${Math.min(100, (day.reviewed / plan.target) * 100)}%`;
    $("#goal-text").textContent = `Hôm nay: ${day.reviewed} / ${plan.target} thẻ (${day.newSeen} thẻ mới) · ${day.good} thẻ "Thuộc"`;

    renderHeatmap();

    const fmt = (k) => k.split("-").reverse().slice(0, 2).join("/");
    const paceLine = plan.reviewOnly
      ? `<li>Đang trong ${REVIEW_ONLY_DAYS} ngày cuối: chỉ ôn lại, không thêm thẻ mới${plan.fresh ? ` (còn ${plan.fresh} thẻ chưa học, học ở Luyện tập › Chỉ câu mới nếu còn sức)` : ""}.</li>`
      : `<li>Thẻ mới hôm nay: <b>${plan.seenToday} / ${plan.quota}</b>${plan.newLeft ? ` · còn ${plan.newLeft}` : ` ${icon("check")}`}</li>
         <li class="muted small">Để học hết ${plan.fresh + plan.seenToday} thẻ chưa học trước ${fmt(plan.stop)} (còn ${plan.daysLeft} ngày học thẻ mới) cần khoảng ${plan.quota} thẻ mới/ngày. Bỏ một ngày thì các ngày sau tự tăng lên.</li>`;
    $("#queue-summary").innerHTML = `
      <li><b>${plan.dueUnseen}</b> thẻ đến hạn ôn lại</li>
      ${paceLine}
      <li class="muted small">Thứ tự thẻ mới: câu từ các buổi phỏng vấn thật (Section 12), rồi câu ${STAR}, rồi các phần còn lại xen kẽ. Lần ôn nào rơi sau ngày thi được dời vào ${REVIEW_ONLY_DAYS} ngày cuối (${fmt(addDays(examDate, -REVIEW_ONLY_DAYS))}–${fmt(addDays(examDate, -1))}) để thẻ nào cũng được ôn lại trước khi thi.</li>`;

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
    stopDictation();
    const area = $("#practice-area");
    if (!session) { area.innerHTML = '<div class="panel empty">Chọn bộ lọc rồi bấm <b>Bắt đầu</b>.</div>'; return; }
    if (session.index >= session.queue.length && session.again.length) {
      session.queue.push(...session.again.splice(0));
    }
    if (session.index >= session.queue.length) {
      const [a, h, g] = session.tally;
      area.innerHTML = session.done
        ? `<div class="panel empty"><h2>Xong buổi ôn ${icon("party-popper")}</h2><p>${session.done} lượt: <b class="g2">${g}</b> thuộc · <b class="g1">${h}</b> tạm · <b class="g0">${a}</b> chưa thuộc.</p><p class="muted">Thẻ "Chưa thuộc" đã được hỏi lại trong buổi này và sẽ quay lại vào ngày mai.</p><button class="btn btn-primary" id="btn-back-today">Về trang Hôm nay</button></div>`
        : '<div class="panel empty"><h2>Không có thẻ nào phù hợp</h2><p class="muted">Đổi bộ lọc, hoặc chọn chế độ "Ngẫu nhiên tất cả" để ôn thêm.</p></div>';
      const back = $("#btn-back-today");
      if (back) back.addEventListener("click", () => showView("today"));
      return;
    }
    const card = session.queue[session.index];
    const rec = state.cards[card.id];
    const statusText = rec ? `hộp ${rec.box} · đã ôn ${rec.reviews} lần` : "thẻ mới";
    // Calculation cards with options are answered as multiple choice instead of a written draft.
    const st = card.mcq ? (session.mcq = session.mcq || newMcq(card)) : null;
    if (st && mcqDone(st)) session.revealed = true;
    // With a draft, the revealed answer is shown side by side with it, as in the mock exam review.
    const compare = !st && session.revealed && (session.draft || "").trim();
    const draftHtml = `
        <details class="draft"${session.draft ? " open" : ""}><summary>Viết nháp câu trả lời (luyện phần thi viết, có so với đáp án)</summary>
          <textarea placeholder="Gõ hoặc bấm Đọc để nhập, rồi bấm Kiểm tra…">${escapeHtml(session.draft || "")}</textarea>
          ${session.revealed ? "" : `<div class="draft-tools">
            ${SpeechRec ? `<button class="btn btn-ghost small" id="btn-dictate">${icon("mic")} Đọc để nhập</button>` : ""}
            <button class="btn btn-ghost small" id="btn-check">Kiểm tra bài viết</button>
            <span class="muted small" id="dictate-status"></span>
          </div>
          ${SpeechRec ? '<p class="muted small">Đọc để nhập dùng nhận dạng giọng nói của trình duyệt, tiếng Anh, cần internet. Chrome gửi âm thanh lên máy chủ Google, Safari gửi lên Apple.</p>' : ""}`}
        </details>`;
    area.innerHTML = `
      <div class="session-bar"><span>${session.index + 1} / ${session.queue.length}</span><div class="goal-bar"><div class="goal-fill" style="width:${(session.index / session.queue.length) * 100}%"></div></div></div>
      <article class="panel card">
        <div class="card-meta"><span class="tag">${card.sourceLabel} ${escapeHtml(card.num)}</span>${card.star ? `<span class="tag star">${STAR}</span>` : ""}<span class="muted small">${escapeHtml(card.section)}${card.subsection ? " · " + escapeHtml(card.subsection) : ""}</span><span class="muted small right">${statusText}</span></div>
        ${questionHtml(card)}
        ${compare
          ? `<div class="compare">
              <div><h4>Bài của bạn</h4><div class="mine">${escapeHtml(session.draft).replace(/\n/g, "<br>")}</div></div>
              <div><h4>Đáp án mẫu</h4>${answerHtml(card, false)}</div>
            </div>`
          : `${st ? mcqHtml(card, st, session.revealed) : draftHtml}${answerHtml(card, !session.revealed)}`}
        <div class="feedback"></div>
        <div class="card-actions">
          ${session.revealed
            ? gradeButtons(st ? mcqSuggest(st) : null)
            : `<button class="btn ${st ? "btn-ghost" : "btn-primary"}" id="btn-reveal">Hiện đáp án <kbd>Space</kbd></button><button class="btn btn-ghost" id="btn-skip">Bỏ qua</button>`}
        </div>
        ${glossaryHtml(card, session.revealed)}
      </article>`;
    if (session.revealed) {
      if (session.draft && lang() === "vi") area.querySelectorAll("details.en-original").forEach((d) => (d.open = true));
      attachFeedback(area.querySelector(".card"), card, session.draft || "");
      area.querySelectorAll(".grade").forEach((b) => b.addEventListener("click", () => grade(Number(b.dataset.g))));
    } else {
      $("#btn-reveal").addEventListener("click", reveal);
      $("#btn-skip").addEventListener("click", () => { session.index += 1; session.draft = ""; session.mcq = null; renderCard(); });
      if (st) { bindMcq(area, card, st, renderCard); return; }
      const textarea = area.querySelector("details.draft textarea");
      const status = $("#dictate-status");
      $("#btn-check").addEventListener("click", () => {
        if (!textarea.value.trim()) { status.textContent = "Viết hoặc đọc câu trả lời trước đã."; textarea.focus(); return; }
        reveal();
      });
      const dictate = $("#btn-dictate");
      if (dictate) dictate.addEventListener("click", () => (dictation ? stopDictation() : startDictation(textarea, dictate, status)));
    }
  }

  // ---------- speech to text for the draft (Web Speech API; Chrome, Edge and Safari) ----------
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let dictation = null;
  const DICTATION_ERRORS = {
    "not-allowed": "Trình duyệt chặn micro. Cho phép micro cho trang này rồi thử lại.",
    "service-not-allowed": "Trình duyệt chặn nhận dạng giọng nói trên trang này.",
    "no-speech": "Không nghe thấy gì. Bấm Đọc để nhập để thử lại.",
    "audio-capture": "Không tìm thấy micro.",
    network: "Lỗi mạng: nhận dạng giọng nói cần internet.",
  };
  function stopDictation() {
    if (!dictation) return;
    dictation.stop();
  }
  function startDictation(textarea, btn, status) {
    const recognizer = new SpeechRec();
    recognizer.lang = "en-US";
    recognizer.continuous = true;
    recognizer.interimResults = true;
    // Finished phrases go into the draft; the phrase still being spoken is shown below it.
    recognizer.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript.trim();
        if (!e.results[i].isFinal) { interim += " " + text; continue; }
        if (!text) continue;
        const sep = textarea.value && !/\s$/.test(textarea.value) ? " " : "";
        textarea.value += sep + text.charAt(0).toUpperCase() + text.slice(1) + (/[.?!]$/.test(text) ? "" : ".");
      }
      status.textContent = interim ? `…${interim}` : "Đang nghe (tiếng Anh)…";
    };
    recognizer.onerror = (e) => { status.textContent = DICTATION_ERRORS[e.error] || `Lỗi nhận dạng giọng nói: ${e.error}`; };
    recognizer.onend = () => {
      if (dictation === recognizer) dictation = null;
      if (!btn.isConnected) return;
      btn.innerHTML = `${icon("mic")} Đọc để nhập`;
      btn.classList.remove("recording");
      if (status.textContent.startsWith("…") || status.textContent.startsWith("Đang nghe")) status.textContent = "";
    };
    dictation = recognizer;
    recognizer.start();
    btn.innerHTML = `${icon("square")} Dừng`;
    btn.classList.add("recording");
    status.textContent = "Đang nghe (tiếng Anh)…";
  }

  function reveal() {
    if (!session || session.revealed) return;
    stopDictation();
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
    session.mcq = null;
    renderCard();
  }

  // ---------- multiple choice for calculation cards: pick the formula, then the result, step by step ----------
  // card.mcq comes from calc_mcq.json; the first option of every list is the correct one.
  const OPTION_KEYS = ["A", "B", "C", "D"];
  function newMcq(card) {
    const qs = [];
    card.mcq.forEach((s, step) => {
      if (s.formula) qs.push({ step, kind: "formula" });
      qs.push({ step, kind: "result" });
    });
    return { qs, at: 0, wrong: qs.map(() => []), orders: qs.map((q) => shuffle(card.mcq[q.step][q.kind].map((_, i) => i))) };
  }
  function mcqDone(st) { return st.at >= st.qs.length; }
  // Suggested self-grade: every pick right the first time = Thuộc; at most one miss per two picks = Tạm.
  function mcqSuggest(st) {
    if (!mcqDone(st)) return null;
    const misses = st.wrong.reduce((n, w) => n + w.length, 0);
    return misses === 0 ? 2 : misses <= st.qs.length / 2 ? 1 : 0;
  }
  function mcqPick(card, st, option) {
    if (mcqDone(st)) return;
    if (option === 0) st.at += 1;
    else if (!st.wrong[st.at].includes(option)) st.wrong[st.at].push(option);
  }
  function mcqPrompt(s) {
    if (!s.promptVi || lang() === "en") return escapeHtml(s.prompt);
    return lang() === "vi"
      ? `${escapeHtml(s.promptVi)} <span class="muted">· ${escapeHtml(s.prompt)}</span>`
      : `${escapeHtml(s.prompt)} <span class="vi-text">· ${escapeHtml(s.promptVi)}</span>`;
  }
  // frozen: the answer was revealed before the steps were finished, so the open question is left out.
  function mcqHtml(card, st, frozen = false) {
    const total = card.mcq.length;
    const parts = card.mcq.map((s, step) => {
      const mine = st.qs.map((q, k) => k).filter((k) => st.qs[k].step === step && k <= st.at);
      if (!mine.length) return "";
      const rows = mine.map((k) => {
        const q = st.qs[k];
        const opts = s[q.kind];
        const title = q.kind === "formula" ? "Công thức" : s.formula ? "Kết quả" : "Đáp án";
        if (frozen && k === st.at) return "";
        if (k < st.at) {
          const misses = st.wrong[k].length;
          return `<div class="mcq-done"><span class="${misses ? "g1" : "g2"}">${icon("check")}</span><span class="muted small">${title}</span> <span>${escapeHtml(opts[0])}</span>${misses ? ` <span class="muted small">(chọn sai ${misses} lần)</span>` : ""}</div>`;
        }
        return `<div class="mcq-q"><div class="mcq-ask">Chọn ${title.toLowerCase()} đúng</div><div class="mcq-opts">${st.orders[k].map((o, pos) => {
          const wrong = st.wrong[k].includes(o);
          return `<button class="mcq-opt${wrong ? " wrong" : ""}" data-o="${o}"${wrong ? " disabled" : ""}><kbd>${OPTION_KEYS[pos]}</kbd><span>${escapeHtml(opts[o])}</span>${wrong ? icon("x") : ""}</button>`;
        }).join("")}</div></div>`;
      }).join("");
      return `<div class="mcq-step"><div class="mcq-prompt"><span class="tag">Bước ${step + 1}/${total}</span> ${mcqPrompt(s)}</div>${rows}</div>`;
    }).join("");
    const misses = st.wrong.reduce((n, w) => n + w.length, 0);
    const right = st.wrong.filter((w, k) => k < st.at && !w.length).length;
    const summary = mcqDone(st)
      ? `<div class="mcq-summary">${icon("circle-check")} Đúng ngay lần đầu <b>${right}/${st.qs.length}</b> lựa chọn${misses ? `, chọn sai ${misses} lần` : ""}. Xem lời giải đầy đủ bên dưới.</div>`
      : "";
    return `<div class="mcq">${parts}${summary}</div>`;
  }
  // Wire option buttons; onChange re-renders the owner (practice card or reel).
  function bindMcq(root, card, st, onChange) {
    root.querySelectorAll(".mcq-opt:not([disabled])").forEach((b) => b.addEventListener("click", () => {
      mcqPick(card, st, Number(b.dataset.o));
      onChange();
    }));
  }
  function mcqKey(card, st, key) {
    const pos = OPTION_KEYS.indexOf(key.toUpperCase());
    if (pos < 0 || mcqDone(st)) return false;
    const option = st.orders[st.at][pos];
    if (option === undefined || st.wrong[st.at].includes(option)) return true;
    mcqPick(card, st, option);
    return true;
  }
  function gradeButtons(suggest) {
    return [["Chưa thuộc", 0], ["Tạm", 1], ["Thuộc", 2]].map(([label, g]) =>
      `<button class="btn grade g${g}${suggest === g ? " suggested" : ""}" data-g="${g}">${label} <kbd>${g + 1}</kbd></button>`).join("") +
      (suggest === null || suggest === undefined ? "" : '<span class="muted small">Viền đậm là mức gợi ý theo kết quả trắc nghiệm.</span>');
  }

  // ---------- reel mode: one card per screen, the answer in short points, swipe to grade ----------
  const REEL_SIZE = 10;
  // Share of keywords blanked out in each point, by hiding level. The default level follows the card's box,
  // so the more often a card was answered "Thuộc", the less of the answer is shown.
  const CLOZE = [0, 0.35, 0.6, 0.85, 1];
  const ABBREVIATION_END = /(\b(e\.g|i\.e|vs|etc|approx|cf|incl|no|fig|U\.S)\.|\b[A-Z]\.)$/i;
  let reel = null;

  // Split an answer into points: list items, tables and the sentences of each paragraph.
  function answerChunks(card) {
    const blocks = [];
    let para = [], table = [];
    const flushPara = () => { if (para.length) { blocks.push({ text: para.join(" ") }); para = []; } };
    const flushTable = () => { if (table.length) { blocks.push({ text: table.join("\n"), whole: true }); table = []; } };
    for (const raw of card.answer.split("\n")) {
      const line = raw.trimEnd();
      if (line.startsWith("|")) { flushPara(); table.push(line); continue; }
      flushTable();
      if (!line.trim()) { flushPara(); continue; }
      if (/^\s*([-•]|\d+\.)\s+/.test(line) || line.startsWith(">")) { flushPara(); blocks.push({ text: line.trim(), whole: true }); continue; }
      if (/^\*{1,2}[A-Z][^*]{0,40}:\*{1,2}/.test(line)) flushPara();
      para.push(line.trim());
    }
    flushPara(); flushTable();
    const chunks = [];
    for (const b of blocks) chunks.push(...(b.whole ? [b.text] : sentences(b.text)));
    // Very short pieces ("(Also Q8.)") join the point before them.
    return chunks.reduce((out, c) => {
      if (out.length && c.replace(/[*_`]/g, "").length < 40 && !/^([-•]|\d+\.|\|)/.test(c)) out[out.length - 1] += " " + c;
      else out.push(c);
      return out;
    }, []);
  }
  function sentences(text) {
    const out = [];
    let start = 0;
    for (const m of text.matchAll(/[.!?]["”)]?\s+(?=["“(*]*[A-Z0-9])/g)) {
      const end = m.index + m[0].length;
      const piece = text.slice(start, end).trim();
      const before = text.slice(start, m.index + 1);
      // Do not split after an abbreviation, or inside bold, italics or brackets.
      const open = (piece.match(/\*\*/g) || []).length % 2 || (piece.replace(/\*\*/g, "").match(/\*/g) || []).length % 2 ||
        (piece.match(/\(/g) || []).length > (piece.match(/\)/g) || []).length;
      if (ABBREVIATION_END.test(before) || open) continue;
      out.push(piece);
      start = end;
    }
    if (text.slice(start).trim()) out.push(text.slice(start).trim());
    return out;
  }
  function hashOf(s) {
    let h = 7;
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100003;
    return h;
  }
  // Render one point, blanking a share of its keywords. Words from the question stay visible.
  function clozeHtml(card, text, idx, level, given) {
    const box = el("div", {}, markdown(text));
    const ratio = CLOZE[level];
    if (!ratio) return box.innerHTML;
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let n = 0;
    for (const node of nodes) {
      const frag = document.createDocumentFragment();
      let last = 0;
      for (const m of node.nodeValue.matchAll(WORD)) {
        n += 1;
        if (!isKeyword(m[0]) || given.has(stem(m[0]))) continue;
        if (ratio < 1 && hashOf(`${card.id}|${idx}|${n}|${m[0]}`) % 100 >= ratio * 100) continue;
        frag.appendChild(document.createTextNode(node.nodeValue.slice(last, m.index)));
        frag.appendChild(el("span", { class: "blank", role: "button", tabindex: "0" })).textContent = m[0];
        last = m.index + m[0].length;
      }
      if (!last) continue;
      frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
    return box.innerHTML;
  }

  // queueFn returns the cards to choose from; cards finished in this reel run are skipped.
  function openReel(queueFn) {
    reel = { queueFn, seen: new Set(), runDone: 0, runTally: [0, 0, 0] };
    nextReelBatch();
    document.body.classList.add("reel-open");
    $("#reel").hidden = false;
  }
  function nextReelBatch() {
    reel.queue = reel.queueFn().filter((c) => !reel.seen.has(c.id)).slice(0, REEL_SIZE);
    Object.assign(reel, { index: 0, again: [], tally: [0, 0, 0], done: 0 });
    resetReelCard();
    renderReel();
  }
  function resetReelCard() {
    Object.assign(reel, { shown: 0, mcq: null, level: null });
  }
  function closeReel() {
    reel = null;
    $("#reel").hidden = true;
    $("#reel").innerHTML = "";
    document.body.classList.remove("reel-open");
    if (currentView === "today") renderToday();
  }
  function reelCard() {
    if (reel.index >= reel.queue.length && reel.again.length) reel.queue.push(...reel.again.splice(0));
    return reel.queue[reel.index];
  }
  function reelComplete(card, chunks) {
    return card.mcq ? mcqDone(reel.mcq) : reel.shown >= chunks.length;
  }

  function renderReel() {
    const root = $("#reel");
    const card = reelCard();
    if (!card) {
      const [a, h, g] = reel.tally;
      const more = reel.queueFn().some((c) => !reel.seen.has(c.id));
      root.innerHTML = `
        <div class="reel-top"><span></span><button class="reel-icon" id="reel-close" title="Đóng (Esc)">${icon("x")}</button></div>
        <div class="reel-end">
          <h2>${reel.done ? `Xong ${reel.done} lượt ${icon("party-popper")}` : "Không còn thẻ nào"}</h2>
          ${reel.done ? `<p><b class="g2">${g}</b> thuộc · <b class="g1">${h}</b> tạm · <b class="g0">${a}</b> chưa thuộc</p>` : '<p class="muted">Đổi bộ lọc ở Luyện tập, hoặc chọn chế độ "Ngẫu nhiên tất cả".</p>'}
          ${more ? `<button class="btn btn-primary" id="reel-more">${icon("reels")} Lướt tiếp ${REEL_SIZE} thẻ</button>` : ""}
          <button class="btn btn-ghost" id="reel-done">Xong</button>
        </div>`;
      $("#reel-close").addEventListener("click", closeReel);
      $("#reel-done").addEventListener("click", closeReel);
      if (more) $("#reel-more").addEventListener("click", nextReelBatch);
      return;
    }
    const rec = state.cards[card.id];
    if (reel.level === null) reel.level = Math.min(rec ? rec.box : 0, CLOZE.length - 1);
    const chunks = card.mcq ? [] : answerChunks(card);
    if (card.mcq && !reel.mcq) reel.mcq = newMcq(card);
    const complete = reelComplete(card, chunks);
    const given = stemsOf(card.question);
    const points = chunks.map((c, i) => i < reel.shown
      ? `<div class="point"><span class="point-n">${i + 1}</span><div>${clozeHtml(card, c, i, reel.level, given)}</div></div>`
      : `<button class="point point-hidden" data-i="${i}"><span class="point-n">${i + 1}</span><span>Ý ${i + 1}</span></button>`).join("");
    const viAnswer = hasVi(card) && lang() !== "en" ? `<details class="reel-full"><summary>Bản tiếng Việt</summary><div class="card-vi">${markdown(card.vi.answer)}</div></details>` : "";
    const hint = card.mcq
      ? "Chọn công thức, rồi chọn kết quả cho từng bước."
      : reel.shown === 0
        ? `Câu trả lời có <b>${chunks.length} ý</b>. Nói to ý 1, rồi chạm để kiểm tra.`
        : complete ? "" : `Nói to ý ${reel.shown + 1}, rồi chạm để kiểm tra.`;
    const total = reel.queue.length;
    root.innerHTML = `
      <div class="reel-top">
        <button class="reel-icon" id="reel-close" title="Đóng (Esc)">${icon("x")}</button>
        <div class="goal-bar"><div class="goal-fill" style="width:${(reel.index / total) * 100}%"></div></div>
        <span class="small">${reel.index + 1}/${total}</span>
        ${card.mcq ? "" : `<div class="reel-level" title="Mức che từ khóa">
          <button class="reel-icon" id="reel-less" ${reel.level === 0 ? "disabled" : ""} title="Che ít hơn">${icon("minus")}</button>
          <span class="small">Che ${Math.round(CLOZE[reel.level] * 100)}%</span>
          <button class="reel-icon" id="reel-more-hide" ${reel.level === CLOZE.length - 1 ? "disabled" : ""} title="Che nhiều hơn">${icon("plus")}</button>
        </div>`}
      </div>
      <div class="reel-stage">
        <article class="reel-card" id="reel-card">
          <div class="card-meta"><span class="tag">${card.sourceLabel} ${escapeHtml(card.num)}</span>${card.star ? `<span class="tag star">${STAR}</span>` : ""}<span class="muted small">${rec ? `hộp ${rec.box}` : "thẻ mới"}</span></div>
          ${questionHtml(card)}
          ${hint ? `<p class="reel-hint">${hint}</p>` : ""}
          ${card.mcq ? mcqHtml(card, reel.mcq) : `<div class="points">${points}</div>`}
          ${complete && card.mcq ? answerHtml(card, false) : ""}
          ${complete && !card.mcq ? viAnswer : ""}
          ${glossaryHtml(card, complete)}
        </article>
        <div class="reel-stamp" id="reel-stamp"></div>
      </div>
      <div class="reel-bottom">
        ${!complete && !card.mcq ? `<div class="reel-reveal"><button class="btn btn-primary" id="reel-next">${icon("eye")} Xem ý ${reel.shown + 1}/${chunks.length} <kbd>Space</kbd></button><button class="btn btn-ghost" id="reel-all">Hiện hết</button></div>` : ""}
        <div class="reel-grades">
          <button class="btn grade g0${complete && card.mcq && mcqSuggest(reel.mcq) === 0 ? " suggested" : ""}" data-g="0">${icon("chevron-left")} Chưa thuộc</button>
          <button class="btn grade g1${complete && card.mcq && mcqSuggest(reel.mcq) === 1 ? " suggested" : ""}" data-g="1">${icon("chevron-up")} Tạm</button>
          <button class="btn grade g2${complete && card.mcq && mcqSuggest(reel.mcq) === 2 ? " suggested" : ""}" data-g="2">Thuộc ${icon("chevron-right")}</button>
        </div>
        <p class="reel-legend muted">Vuốt trái: chưa thuộc · vuốt lên: tạm · vuốt phải: thuộc${card.mcq ? "" : ". Chạm ô tô màu để xem từ bị che"}.</p>
      </div>`;

    const cardEl = $("#reel-card");
    $("#reel-close").addEventListener("click", closeReel);
    root.querySelectorAll(".reel-grades .grade").forEach((b) => b.addEventListener("click", () => flyOut(Number(b.dataset.g))));
    const less = $("#reel-less"), moreHide = $("#reel-more-hide");
    if (less) less.addEventListener("click", () => { reel.level -= 1; renderReel(); });
    if (moreHide) moreHide.addEventListener("click", () => { reel.level += 1; renderReel(); });
    const next = $("#reel-next");
    if (next) next.addEventListener("click", () => revealPoint(chunks.length));
    const all = $("#reel-all");
    if (all) all.addEventListener("click", () => { reel.shown = chunks.length; renderReel(); });
    cardEl.querySelectorAll(".point-hidden").forEach((b) => b.addEventListener("click", () => { reel.shown = Number(b.dataset.i) + 1; renderReel(); }));
    cardEl.querySelectorAll(".blank").forEach((b) => {
      const show = () => b.classList.add("shown");
      b.addEventListener("click", show);
      b.addEventListener("keydown", (e) => { if (e.key === "Enter") show(); });
    });
    if (card.mcq) bindMcq(cardEl, card, reel.mcq, renderReel);
    // Keep the newest point, or the open multiple-choice question, in view.
    const lastPoint = cardEl.querySelectorAll(".point:not(.point-hidden)");
    const focus = card.mcq ? cardEl.querySelector(".mcq-q") || (complete && cardEl.querySelector(".mcq-summary")) : reel.shown && lastPoint[lastPoint.length - 1];
    if (focus && (reel.shown || (reel.mcq && reel.mcq.at))) focus.scrollIntoView({ block: "nearest" });
    bindSwipe(cardEl);
  }
  function revealPoint(count) {
    if (reel.shown < count) { reel.shown += 1; renderReel(); }
  }

  // Touch swipes: left = Chưa thuộc, right = Thuộc, up = Tạm (only once the card is scrolled to its end).
  const SWIPE = 90;
  function bindSwipe(cardEl) {
    const stamp = $("#reel-stamp");
    let s = null;
    const atEnd = () => cardEl.scrollTop + cardEl.clientHeight >= cardEl.scrollHeight - 4;
    const gradeOf = (dx, dy) => {
      if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 2 : 0;
      if (s.end && dy < -SWIPE && Math.abs(dy) > Math.abs(dx)) return 1;
      return null;
    };
    cardEl.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) { s = null; return; }
      s = { x: e.touches[0].clientX, y: e.touches[0].clientY, end: atEnd() };
    }, { passive: true });
    cardEl.addEventListener("touchmove", (e) => {
      if (!s) return;
      const dx = e.touches[0].clientX - s.x, dy = e.touches[0].clientY - s.y;
      const horizontal = Math.abs(dx) > Math.abs(dy);
      if (!horizontal && !(s.end && dy < 0)) return;
      cardEl.style.transition = "none";
      cardEl.style.transform = horizontal ? `translateX(${dx}px) rotate(${dx / 25}deg)` : `translateY(${dy / 2}px)`;
      showStamp(stamp, gradeOf(dx, dy));
    }, { passive: true });
    const end = (e) => {
      if (!s) return;
      const t = e.changedTouches[0];
      const g = gradeOf(t.clientX - s.x, t.clientY - s.y);
      s = null;
      if (g !== null) { flyOut(g); return; }
      cardEl.style.transition = "";
      cardEl.style.transform = "";
      showStamp(stamp, null);
    };
    cardEl.addEventListener("touchend", end);
    cardEl.addEventListener("touchcancel", end);
  }
  function showStamp(stamp, g) {
    stamp.className = `reel-stamp${g === null ? "" : ` on g${g}`}`;
    stamp.textContent = g === null ? "" : ["Chưa thuộc", "Tạm", "Thuộc"][g];
  }
  function flyOut(g) {
    const cardEl = $("#reel-card");
    if (!cardEl || cardEl.classList.contains("leaving")) return;
    showStamp($("#reel-stamp"), g);
    cardEl.classList.add("leaving");
    cardEl.style.transition = "";
    cardEl.style.transform = g === 1 ? "translateY(-120%)" : `translateX(${g === 2 ? 130 : -130}%) rotate(${g === 2 ? 12 : -12}deg)`;
    setTimeout(() => reelGrade(g), 220);
  }
  function reelGrade(g) {
    if (!reel) return;
    const card = reelCard();
    gradeCard(card.id, g);
    reel.tally[g] += 1;
    reel.done += 1;
    reel.seen.add(card.id);
    if (g === 0) reel.again.push(card);
    reel.index += 1;
    resetReelCard();
    renderReel();
  }
  function reelKey(e) {
    if (e.key === "Escape") { closeReel(); return; }
    const card = reelCard();
    if (!card) return;
    if (reel.mcq && /^[a-d]$/i.test(e.key) && mcqKey(card, reel.mcq, e.key)) { renderReel(); return; }
    if (e.code === "Space" || e.key === "Enter") {
      e.preventDefault();
      if (!card.mcq) revealPoint(answerChunks(card).length);
      return;
    }
    const g = { "1": 0, "2": 1, "3": 2, ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2 }[e.key];
    if (g !== undefined) { e.preventDefault(); flyOut(g); }
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
        <p class="muted small">Câu hỏi lấy ngẫu nhiên, ưu tiên câu ${STAR} và câu từ các bài review thật (Section 12).</p>
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
            <textarea data-i="${i}" rows="7" placeholder="Câu trả lời của bạn…">${escapeHtml(mock.answers[i])}</textarea>
            ${glossaryHtml(c, false)}
          </article>`).join("")}
        <div class="card-actions"><button class="btn btn-primary" id="btn-submit-written">Nộp bài viết, sang phần nói ${icon("arrow-right")}</button></div>`;
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
          ${answerHtml(c, !mock.revealed)}
          <div class="card-actions">
            ${mock.revealed
              ? `<button class="btn grade g0" data-g="0">Chưa thuộc <kbd>1</kbd></button><button class="btn grade g1" data-g="1">Tạm <kbd>2</kbd></button><button class="btn grade g2" data-g="2">Thuộc <kbd>3</kbd></button>`
              : `<button class="btn btn-primary" id="btn-mock-reveal">Đã trả lời xong, xem đáp án <kbd>Space</kbd></button>`}
          </div>
          ${glossaryHtml(c, mock.revealed)}
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
          <div class="compare">
            <div><h4>Bài của bạn</h4><div class="mine">${mock.answers[i] ? escapeHtml(mock.answers[i]).replace(/\n/g, "<br>") : '<span class="muted">(bỏ trống)</span>'}</div></div>
            <div><h4>Đáp án mẫu</h4>${answerHtml(c, false)}</div>
          </div>
          <div class="feedback"></div>
          <div class="card-actions" data-wi="${i}">
            ${mock.graded[c.id] === undefined
              ? `<button class="btn grade g0" data-g="0">Chưa đạt</button><button class="btn grade g1" data-g="1">Tạm</button><button class="btn grade g2" data-g="2">Tốt</button>`
              : `<span class="muted">${icon("check")} Đã chấm</span>`}
          </div>
          ${glossaryHtml(c, true)}
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
  $("#btn-reel-today").addEventListener("click", () => openReel(todayQueue));
  $("#btn-reel").addEventListener("click", () => {
    const filters = { source: $("#f-source").value, section: $("#f-section").value, mode: $("#f-mode").value, starOnly: $("#f-star").checked };
    // Random mode is drawn once, so "Lướt tiếp" continues through the same shuffled order.
    const fixed = filters.mode === "random" ? buildQueue(filters) : null;
    openReel(() => fixed || buildQueue(filters));
  });
  $("#btn-weak-all").addEventListener("click", () => {
    showView("practice");
    $("#f-source").value = "all"; fillSections(); $("#f-mode").value = "weak"; $("#f-star").checked = false;
    startPractice();
  });
  $("#f-source").addEventListener("change", fillSections);
  const THEMES = { auto: ["sun-moon", "Tự động"], light: ["sun", "Sáng"], dark: ["moon", "Tối"] };
  function applyTheme() {
    const theme = state.settings.theme || "auto";
    if (theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    $("#btn-theme").innerHTML = `${icon(THEMES[theme][0])} ${THEMES[theme][1]}`;
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
    if (reel) { reelKey(e); return; }
    if (currentView === "practice" && session) {
      const card = session.queue[session.index];
      if (card && session.mcq && !session.revealed && /^[a-d]$/i.test(e.key) && mcqKey(card, session.mcq, e.key)) { renderCard(); return; }
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
  document.querySelectorAll("i[data-icon]").forEach((i) => (i.outerHTML = icon(i.dataset.icon, i.dataset.class || "")));
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
