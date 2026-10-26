/* Published build only: decrypts questions.enc.js with the user's password, then loads app.js. */
(function () {
  "use strict";
  const PASS_KEY = "aps-prep-pass";
  const enc = window.ENCRYPTED;
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function decrypt(password) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: fromB64(enc.salt), iterations: enc.iterations, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(enc.iv) }, key, fromB64(enc.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function start(cards) {
    window.QUESTIONS = cards;
    const gate = document.getElementById("gate");
    if (gate) gate.remove();
    const s = document.createElement("script");
    s.src = "app.js?v=27d9b6bb53";
    document.body.appendChild(s);
  }

  function showGate(message) {
    const gate = document.createElement("div");
    gate.id = "gate";
    gate.innerHTML = `
      <form class="panel gate-box">
        <h2>APS Prep</h2>
        <p class="muted">Nhập mật khẩu để mở bộ câu hỏi. Mật khẩu chỉ cần nhập một lần trên mỗi thiết bị.</p>
        <input type="password" id="gate-pass" autocomplete="current-password" placeholder="Mật khẩu" required>
        <p class="gate-error">${message || ""}</p>
        <button class="btn btn-primary" type="submit">Mở</button>
      </form>`;
    document.body.prepend(gate);
    gate.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = gate.querySelector("#gate-pass").value;
      try {
        const cards = await decrypt(password);
        localStorage.setItem(PASS_KEY, password);
        start(cards);
      } catch (err) {
        gate.querySelector(".gate-error").textContent = "Sai mật khẩu, thử lại.";
      }
    });
  }

  const saved = localStorage.getItem(PASS_KEY);
  if (saved) {
    decrypt(saved).then(start).catch(() => { localStorage.removeItem(PASS_KEY); showGate("Mật khẩu đã đổi, nhập lại."); });
  } else {
    showGate();
  }
})();
