/* Finds calculations written as plain text ("Net margin = 90 / 1,800 = **5%**", "EOQ = √(2DS / H)", "FV = 100 × 1.08⁵") in a text and gives
   each one as LaTeX (for KaTeX) and as words (for the podcast). It is a small parser, not a pattern: numbers, variables, brackets,
   powers, roots, fractions. A text that is not clearly a calculation is left alone. Used by app.js (window.ApsFormula) and by the
   tests of the testkit (module.exports). */
(function (root) {
  "use strict";

  const SUPER = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
  const SUPER_RUN = /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/y;
  const GREEK = { Δ: ["\\Delta ", "delta"], σ: ["\\sigma ", "sigma"], μ: ["\\mu ", "mu"], π: ["\\pi ", "pi"], λ: ["\\lambda ", "lambda"], θ: ["\\theta ", "theta"], ρ: ["\\rho ", "rho"], α: ["\\alpha ", "alpha"], β: ["\\beta ", "beta"], γ: ["\\gamma ", "gamma"] };
  const NUMBER = /\d+(?:,\d{3})*(?:\.\d+)?/y;
  const UNIT = /(?:units?|đơn vị|million|billion|thousand|triệu|tỷ|nghìn|VND|USD|EUR|years?|năm|months?|tháng|days?|ngày|points?|điểm)(?![\p{L}])/iuy;
  const LABEL_SKIP = /^(?:so|thus|then|hence|therefore|where|with|here|now|also|and|but|if|when|at|in|for|since|because|assume|suppose|given|using|as|note|that|nên|vậy|tại|khi|nếu|với|và|còn)$/i;
  const NOT_VARIABLE = /^(?:The|And|But|For|Not|Its|If|At|In|Is|It|As|An|On|Or|So|To|We|My|Of|Be|By|Do|No|Go|He|Up|Us)$/;
  const CURRENCIES = /^(?:VND|USD|EUR|JPY|CNY|RMB|GBP|KRW|THB|AUD|CAD|CHF|SGD|INR|MYR|IDR)$/;
  const COMMON_WORD = /^(?:and|the|for|are|but|not|was|has|had|you|all|any|can|per|one|two|its|our|who|how|why|may|did|get|got|let|put|say|see|set|try|yes|via|if|in|is|it|of|on|or|to|as|at|be|by|do|go|he|me|my|no|so|up|us|we|an|am|each|from|with|over|out|off|new|old|day|vs)$/;
  const RELATIONS = { "=": ["=", "equals"], "≈": ["\\approx", "approx"], "≠": ["\\neq", "notEqual"], "≤": ["\\leq", "atMost"], "≥": ["\\geq", "atLeast"], "±": ["\\pm", "plusMinus"] };

  const node = (tex, say, kind = "atom", extra = {}) => ({ tex, say, kind, ...extra });
  const spell = (word) => word.split("").join(" ");

  function parse(s, W) {
    let i = 0;
    const sticky = (re) => { re.lastIndex = i; const m = re.exec(s); return m && m.index === i ? m : null; };
    const spaces = () => { while (s[i] === " ") i += 1; };
    const word = (key) => W[key] || key;

    // ----- atoms -----
    function number() {
      const m = sticky(NUMBER);
      if (!m) return null;
      i += m[0].length;
      let tex = m[0].replace(/,/g, "{,}");
      let say = m[0];
      const suffix = /[MKB](?![\p{L}\d])/uy;
      suffix.lastIndex = i;
      const sm = suffix.exec(s);
      if (sm && sm.index === i) {
        i += 1;
        tex += `\\text{${sm[0]}}`;
        say += ` ${sm[0] === "M" ? word("million") : sm[0] === "K" ? word("thousand") : word("billion")}`;
      }
      if (s[i] === "%") { i += 1; tex += "\\%"; say += ` ${word("percent")}`; }
      let n = node(tex, say, "num", { simple: true });
      n = superscripts(n);
      const sci = sticky(/ × 10(?=[⁰¹²³⁴⁵⁶⁷⁸⁹^])/uy);
      if (sci) {
        i += sci[0].length;
        const ten = superscripts(node("10", "10", "num", { simple: true }));
        n = node(`${n.tex} \\times ${ten.tex}`, `${n.say} ${word("times")} ${ten.say}`, "num", { simple: true });
      }
      // a unit after the number: "800 units", "2.0 billion VND"
      for (;;) {
        const save = i;
        if (s[i] !== " ") break;
        i += 1;
        const um = sticky(UNIT);
        if (!um) { i = save; break; }
        i += um[0].length;
        n = node(`${n.tex}\\text{ ${um[0]}}`, `${n.say} ${um[0]}`, "num", { simple: true });
      }
      return n;
    }
    function superscripts(base) {
      const m = sticky(SUPER_RUN);
      if (m) {
        i += m[0].length;
        return power(base, node(m[0].split("").map((c) => SUPER[c]).join(""), m[0].split("").map((c) => SUPER[c]).join(""), "num", { simple: true }));
      }
      if (s[i] === "^") {
        const save = i;
        i += 1;
        let exp = null;
        if (s[i] === "(") exp = group();
        else exp = number() || variable(false);
        if (!exp) { i = save; return base; }
        return superscripts(power(base, exp));
      }
      return base;
    }
    function power(base, exp) {
      const e = exp.kind === "group" ? exp.inner : exp;
      const say = e.say === "2" ? word("squared") : e.say === "3" ? word("cubed") : `${word("power")} ${e.say}`;
      const baseTex = base.kind === "group" || base.kind === "atom" || base.kind === "num" ? base.tex : `{${base.tex}}`;
      return node(`${baseTex}^{${e.tex}}`, `${base.say} ${say}`, "power", { simple: false });
    }
    function variable(allowAcronym) {
      let m;
      // currency pair: EUR/VND
      if (allowAcronym && (m = sticky(/[A-Z]{3}\/[A-Z]{3}(?![\p{L}])/uy)) && m[0].split("/").every((code) => CURRENCIES.test(code))) {
        i += m[0].length;
        return superscripts(node(`\\mathrm{${m[0]}}`, m[0].split("/").map(spell).join(` ${word("per")} `), "atom", { simple: true }));
      }
      // %ΔQ, ΔGDP, ΔP: a change
      if ((m = sticky(/(%?)Δ([A-Z]{1,5})(?![\p{L}])/uy))) {
        i += m[0].length;
        const name = m[2].length > 1 ? `\\mathrm{${m[2]}}` : m[2];
        return superscripts(node(`${m[1] ? "\\%" : ""}\\Delta ${name}`, `${m[1] ? `${word("pctChange")} ` : `${GREEK["Δ"][1]} `}${m[2].length > 1 ? spell(m[2]) : m[2]}`, "atom", { simple: true }));
      }
      if ((m = sticky(/[σμπλθραβγ]/uy))) {
        i += 1;
        const g = GREEK[m[0]];
        return superscripts(node(g[0], g[1], "atom", { simple: true }));
      }
      if (allowAcronym && (m = sticky(/[A-Z]{2,6}\d?(?![\p{L}])/uy))) {
        i += m[0].length;
        const sub = /\d$/.test(m[0]) ? m[0].slice(-1) : "";
        const name = sub ? m[0].slice(0, -1) : m[0];
        return superscripts(node(`\\mathrm{${name}}${sub ? `_{${sub}}` : ""}`, spell(name) + (sub ? ` ${sub}` : ""), "atom", { simple: true }));
      }
      // Qd, Qs, CFt: a letter (or two) with a lowercase index
      if (allowAcronym && (m = sticky(/([A-Z]{1,2})([a-z]{1,2})(?![\p{L}])/uy)) && !NOT_VARIABLE.test(m[0])) {
        i += m[0].length;
        return superscripts(node(`${m[1].length > 1 ? `\\mathrm{${m[1]}}` : m[1]}_{${m[2]}}`, `${spell(m[1])} ${m[2]}`, "atom", { simple: true }));
      }
      // b in "bx", x in "xy": a product of variables written without signs, unless the letters are an English word
      if (allowAcronym && sticky(/[a-z](?=[a-z]{1,2}(?![\p{L}]))/uy) && !COMMON_WORD.test(/^[a-z]+/.exec(s.slice(i))[0])) {
        i += 1;
        return superscripts(node(s[i - 1], s[i - 1], "atom", { simple: true }));
      }
      // one letter, with an optional digit index: x, P, H0
      if ((m = sticky(/([A-Za-z])(\d?)(?![\p{L}\d])/uy)) || (!allowAcronym && (m = sticky(/([A-Za-z])(?![\p{L}])/uy)))) {
        i += m[0].length;
        return superscripts(node(`${m[1]}${m[2] ? `_{${m[2]}}` : ""}`, `${m[1]}${m[2] ? ` ${m[2]}` : ""}`, "atom", { simple: true }));
      }
      return null;
    }
    // letters written straight after a number are a product of variables: 2DS, 0.6x, 80Q
    function product() {
      let m;
      if ((m = sticky(/[A-Za-z]{1,3}(?![\p{L}])/uy))) {
        i += m[0].length;
        return superscripts(node(m[0], m[0].split("").join(" "), "atom", { simple: true }));
      }
      return variable(false);
    }
    function group() {
      if (s[i] !== "(") return null;
      const save = i;
      i += 1;
      spaces();
      const inner = expression();
      spaces();
      if (!inner || s[i] !== ")") { i = save; return null; }
      i += 1;
      const single = inner.kind !== "sum" && inner.simple;
      const g = node(`\\left(${inner.tex}\\right)`, single ? inner.say : `${word("quantity")} ${inner.say},`, "group", { inner, simple: single });
      return superscripts(g);
    }
    // P(A|B), π(Q): a name with a bracket straight after it
    function call(name) {
      if (s[i] !== "(") return name;
      const save = i;
      let depth = 0;
      let j = i;
      for (; j < s.length; j += 1) {
        if (s[j] === "(") depth += 1;
        else if (s[j] === ")") { depth -= 1; if (!depth) break; }
      }
      if (depth) { i = save; return name; }
      const inner = s.slice(i + 1, j);
      if (!inner || inner.length > 50 || /=/.test(inner)) { i = save; return name; }
      const parts = inner.split("|").map((part) => {
        const sub = parse(part.trim(), W).expressionAll();
        return sub ? { tex: sub.tex, say: sub.say } : { tex: `\\text{${part.trim().replace(/[{}\\%$&#_^~]/g, "")}}`, say: part.trim() };
      });
      i = j + 1;
      return node(`${name.tex}\\left(${parts.map((p) => p.tex).join(" \\mid ")}\\right)`, `${name.say} ${word("of")} ${parts.map((p) => p.say).join(` ${word("given")} `)},`, "call", { simple: false });
    }
    function atom() {
      // bold: **150** (the marks belong to the number; a lone ** is left to the markdown)
      if (s.startsWith("**", i)) {
        const save = i;
        i += 2;
        const inner = atom();
        if (inner && s.startsWith("**", i)) { i += 2; return node(`\\mathbf{${inner.tex}}`, inner.say, inner.kind, { simple: inner.simple }); }
        i = save;
        return null;
      }
      let a = number();
      if (a) return a;
      if (s[i] === "(") return group();
      if (s[i] === "√") {
        i += 1;
        spaces();
        const inner = group() || number() || variable(true);
        if (!inner) return null;
        const body = inner.kind === "group" ? inner.inner : inner;
        return node(`\\sqrt{${body.tex}}`, `${word("sqrt")} ${body.say},`, "sqrt", { simple: false });
      }
      if (s[i] === "Σ") {
        i += 1;
        spaces();
        const inner = factor();
        if (!inner) return null;
        return node(`\\sum ${inner.tex}`, `${word("sum")} ${inner.say}`, "sum", { simple: false });
      }
      a = variable(true);
      if (a) return call(a);
      return null;
    }
    function factor() {
      // a sign straight before a number or a name: −150, +10%
      let sign = null;
      if ((s[i] === "−" || s[i] === "+") && /[\d\p{L}(]/u.test(s[i + 1] || "")) { sign = s[i]; i += 1; }
      const a = atom();
      if (!a) return null;
      return sign ? node(`${sign === "−" ? "-" : "+"}${a.tex}`, `${word(sign === "−" ? "minus" : "plus")} ${a.say}`, a.kind, { simple: false }) : a;
    }

    // ----- terms and expressions -----
    function fraction(a, b) {
      const top = a.kind === "group" ? a.inner : a;
      const bottom = b.kind === "group" ? b.inner : b;
      const say = `${top.say}${top.simple ? "" : ","} ${word("over")} ${bottom.say}${bottom.simple ? "" : ","}`;
      return node(`\\frac{${top.tex}}{${bottom.tex}}`, say, "frac", { simple: false });
    }
    function term() {
      let acc = factor();
      if (!acc) return null;
      for (;;) {
        const save = i;
        const before = i;
        spaces();
        const spaced = i > before;
        const op = s[i];
        let next = null;
        if (op === "×" || op === "÷" || op === "/") {
          i += 1;
          spaces();
          next = factor();
          if (next) acc = op === "×" ? node(`${acc.tex} \\times ${next.tex}`, `${acc.say} ${word("times")} ${next.say}`, "product", { simple: false }) : op === "÷" ? node(`${acc.tex} \\div ${next.tex}`, `${acc.say} ${word("over")} ${next.say}`, "product", { simple: false }) : fraction(acc, next);
        } else if (!spaced && (acc.kind === "num" || acc.kind === "atom" || acc.kind === "group") && /[A-Za-z(σμπλθραβγΔ]/u.test(op || "") && !(acc.kind === "group" && op !== "(")) {
          // 2DS, 3x², 2(…): a product without a sign
          next = op === "(" ? group() : product();
          if (next) acc = node(`${acc.tex}${next.tex}`, `${acc.say} ${next.say}`, "product", { simple: false });
        }
        if (!next) { i = save; break; }
      }
      return acc;
    }
    function expression() {
      let acc = term();
      if (!acc) return null;
      for (;;) {
        const save = i;
        spaces();
        const spacedBefore = i > save;
        let op = s[i];
        let tex;
        let say;
        if (RELATIONS[op]) { tex = RELATIONS[op][0]; say = word(RELATIONS[op][1]); }
        else if (op === "+" || op === "−") { tex = op === "+" ? "+" : "-"; say = word(op === "+" ? "plus" : "minus"); }
        else if (op === "-" && spacedBefore && s[i + 1] === " ") { tex = "-"; say = word("minus"); op = "−"; }
        else { i = save; break; }
        i += 1;
        spaces();
        const next = term();
        if (!next) { i = save; break; }
        acc = node(`${acc.tex} ${tex} ${next.tex}`, `${acc.say} ${say} ${next.say}`, "sum", { simple: false });
      }
      return acc;
    }
    return {
      at: (n) => { i = n; },
      pos: () => i,
      expression,
      expressionAll() { const e = expression(); return e && i === s.length ? e : null; },
    };
  }

  // ----- the text -----
  const isLetter = (c) => /[\p{L}\d_]/u.test(c || "");
  const isIdentLike = (w) => /^[A-Za-zΔ]$/.test(w) || /^%?Δ[A-Z]{1,5}$/.test(w) || /^[A-Z]{2,6}\d?$/.test(w) || /^[A-Z]{1,2}[a-z]{1,2}$/.test(w) || /^[σμπλθραβγ]$/u.test(w);
  const LABEL = /\p{L}[\p{L}'’]*(?: \p{L}[\p{L}'’]*){0,3}(?= (?:=|≈) )/uy;

  function clauseStart(s, i) {
    if (i === 0) return true;
    if (s.slice(Math.max(0, i - 2), i) === "**") return clauseStart(s, i - 2);
    if (/["“‘'(\[]/.test(s[i - 1])) return clauseStart(s, i - 1);
    let j = i - 1;
    while (j >= 0 && s[j] === " ") j -= 1;
    if (j === i - 1 && j >= 0) return false; // a start needs a space or a mark before it
    return j < 0 || /[:;.)\]\n]/.test(s[j]) || (s[j] === "-" && (j === 0 || s[j - 1] === " "));
  }
  function acceptable(span) {
    const hasDigit = /\d/.test(span);
    const relation = /[=≈≠≤≥±]/.test(span);
    const shape = /[×÷√Σ^⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(span) || (/\s\/\s/.test(span) && hasDigit);
    if (!(relation || shape)) return false;
    if (hasDigit) return true;
    return /[A-Za-zσμπΔ].*[=≈≠≤≥].*[A-Za-zσμπΔ]/u.test(span) || /[A-Za-zσμπΔ].*[√Σ^²³]|[√Σ].*[A-Za-zσμπΔ]/u.test(span);
  }

  // Every calculation of `text`: [{ start, end, tex, say }]. `W` holds the words of the language of the text.
  function find(text, W) {
    const found = [];
    let i = 0;
    while (i < text.length) {
      const c = text[i];
      const prev = text[i - 1];
      if (!/[\p{L}\d(√Σ%*]/u.test(c) || (isLetter(prev) && c !== "*") || prev === "." || (prev === "," && /\d/.test(text[i - 2] || ""))) { i += 1; continue; }
      let hit = null;
      if (clauseStart(text, i)) {
        LABEL.lastIndex = i;
        const lm = LABEL.exec(text);
        if (lm && lm.index === i) {
          let words = lm[0].split(" ");
          let skipped = 0;
          while (words.length && LABEL_SKIP.test(words[0])) { skipped += words[0].length + 1; words = words.slice(1); }
          const label = words.join(" ");
          if (label && !isIdentLike(words[words.length - 1])) {
            const p = parse(text, W);
            p.at(i + lm[0].length + 1);
            const rel = text[p.pos()];
            p.at(p.pos() + 2);
            const e = p.expression();
            if (e) {
              const end = p.pos();
              const span = text.slice(i + skipped, end);
              if (acceptable(span)) hit = { start: i + skipped, end, tex: `\\text{${label}} ${RELATIONS[rel][0]} ${e.tex}`, say: `${label} ${W[RELATIONS[rel][1]]} ${e.say}` };
            }
          }
        }
      }
      if (!hit) {
        const p = parse(text, W);
        p.at(i);
        const e = p.expression();
        if (e) {
          const end = p.pos();
          if (end > i && acceptable(text.slice(i, end))) hit = { start: i, end, tex: e.tex, say: e.say };
        }
      }
      if (hit) { found.push(hit); i = hit.end; } else i += 1;
    }
    return found;
  }
  // A code span that is wholly a formula (`NPV = Σ (CFt / (1 + r)^t) − I0`); null for anything else, such as a file name.
  function wholeFormula(text, W) {
    const span = text.trim();
    if (/\.\w{2,4}$/.test(span) || !/[=≈]/.test(span)) return null;
    const p = parse(span, W);
    const e = p.expressionAll();
    return e ? { tex: e.tex, say: e.say } : null;
  }
  // The words, in the order of the text, with every calculation replaced by its spoken form.
  function speak(text, W) {
    let out = text;
    const spans = find(text, W);
    for (let k = spans.length - 1; k >= 0; k -= 1) out = `${out.slice(0, spans[k].start)} ${spans[k].say.replace(/,(\s*,)+/g, ",")} ${out.slice(spans[k].end)}`;
    return out;
  }

  const api = { find, wholeFormula, speak };
  root.ApsFormula = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
