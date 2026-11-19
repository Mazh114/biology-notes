/* 生物必背知识点 · 交互版 逻辑 */
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const KEY = "bio_interactive_v2";

/* ---------- 用户数据存储 ---------- */
let store = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch(e){ return null; } })() || { users:{}, current:null };
function saveStore(){ localStorage.setItem(KEY, JSON.stringify(store)); }
function defUser(){ return { created:Date.now(), visited:{}, mastery:{}, cloze:{revealed:0,secs:{}},
  quiz:{}, cards:{known:{},seen:0}, theme:"light", clozeMode:"off", side:true, last:{} }; }
function curUser(){
  if (!store.current || !store.users[store.current]) store.current = Object.keys(store.users)[0] || null;
  if (!store.current) { store.users["默认用户"] = defUser(); store.current = "默认用户"; saveStore(); }
  return store.users[store.current];
}
const U = () => curUser();

/* ---------- 主题 ---------- */
function applyTheme(){ document.documentElement.dataset.theme = U().theme || "light"; }
function toggleTheme(){ const u=U(); u.theme = (u.theme==="dark") ? "light" : "dark"; saveStore(); applyTheme(); }

/* ---------- 章节结构（书籍页） ---------- */
let SECS = [];      // {id, el, chIdx, chT, title}
let CHS  = [];      // {i, n, t, el, secEls:[h2]}
function buildStructure(){
  const chaps = $$(".chapter");
  chaps.forEach((el, i) => {
    el.id = "c" + i;
    const meta = (BOOK && BOOK.chapters[i]) || { n:String(i+1), t: el.querySelector(".ch-head h1")?.textContent || "" };
    const h2s = [...el.querySelectorAll("h2")];
    h2s.forEach((h, j) => { h.id = "c" + i + "s" + j; });
    CHS.push({ i, n: meta.n, t: meta.t, el, secEls: h2s });
    if (h2s.length === 0) SECS.push({ id: el.id, el, chIdx: i, chT: meta.t, title: meta.t });
    h2s.forEach((h, j) => {
      SECS.push({ id: h.id, el: h, chIdx: i, chT: meta.t, title: h.textContent });
    });
  });
}

/* ---------- 侧边目录 ---------- */
function buildTOC(){
  const toc = $("#toc"); if (!toc) return;
  toc.innerHTML = CHS.map(ch => {
    const secs = ch.secEls.length ? ch.secEls.map(h =>
      `<button class="toc-sec" data-jump="${h.id}" data-sid="${h.id}"><span class="st">${esc(h.textContent)}</span><span class="m-dot" title="掌握度"></span></button>`
    ).join("") : `<button class="toc-sec" data-jump="${ch.el.id}" data-sid="${ch.el.id}"><span class="st">本章速览</span><span class="m-dot" title="掌握度"></span></button>`;
    return `<div class="toc-ch" data-ch="${ch.i}">
      <button class="toc-ch-head" data-jump="${ch.el.id}" data-sid="${ch.el.id}">
        <span class="n" style="background:var(--ac, var(--pri))">${esc(ch.n)}</span><span class="t">${esc(ch.t)}</span>
        <span class="prog"></span><span class="arr">▶</span>
      </button><div class="toc-secs">${secs}</div></div>`;
  }).join("");
  $$(".toc-sec .m-dot, .toc-ch-head .m-dot").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); cycleMastery(b.closest("[data-sid]").dataset.sid, b);
  }));
  $$(".toc-ch-head").forEach(b => b.addEventListener("click", e => {
    const box = b.parentElement;
    box.classList.toggle("open");
    if (e.target.closest(".m-dot")) return;
    if (window.innerWidth > 900) { puppyRun(); jumpTo(b.dataset.jump, {}); }
  }));
  $$(".toc-sec").forEach(b => b.addEventListener("click", e => {
    if (e.target.closest(".m-dot")) return;
    puppyRun();
    jumpTo(b.dataset.jump, {});
  }));
  refreshSidebarState();
}
function refreshSidebarState(){
  $$(".toc-ch").forEach(box => {
    const ch = CHS[+box.dataset.ch];
    const sids = ch.secEls.length ? ch.secEls.map(h => h.id) : [ch.el.id];
    const read = sids.filter(s => (U().visited[DATA.id]||[]).includes(s)).length;
    const done = sids.filter(s => U().mastery[s] === 2).length;
    box.querySelector(".prog").textContent = done === sids.length ? "已掌握" : `${read}/${sids.length}`;
  });
}
function cycleMastery(sid, dot){
  const u = U(); const cur = u.mastery[sid] || 0;
  u.mastery[sid] = (cur + 1) % 3; saveStore();
  syncDots();
}
function syncDots(){
  $$("[data-sid]").forEach(el => {
    const d = el.querySelector(".m-dot"); if (!d) return;
    const m = U().mastery[el.dataset.sid] || 0;
    d.className = "m-dot" + (m === 1 ? " m1" : m === 2 ? " m2" : "");
    d.title = ["标记：学习中", "标记：已掌握", "清除标记"][m];
  });
  refreshSidebarState();
}

/* ---------- 跳转 / 滚动 ---------- */
let BACK = [];   // 页内互链返回栈 {id, y, label}
function jumpTo(id, opts){
  const el = document.getElementById(id); if (!el) return;
  el.scrollIntoView({ behavior: opts.instant ? "auto" : "smooth", block: opts.block || "start" });
  if (opts.flash !== false) {
    const box = el.closest(".chapter") || el;
    box.classList.remove("ch-flash"); void box.offsetWidth; box.classList.add("ch-flash");
    setTimeout(() => box.classList.remove("ch-flash"), 1700);
  }
  if (window.innerWidth <= 900) document.body.classList.add("side-collapsed");
  if (opts.afterScroll) setTimeout(opts.afterScroll, 450);
}
function showBack(){
  const pill = $("#xback"); if (!pill) return;
  const top = BACK[BACK.length - 1];
  if (top) { pill.querySelector("span").textContent = "返回：" + top.label; pill.classList.add("show"); }
  else pill.classList.remove("show");
}
/* ---------- 互链 ---------- */
function buildXrefs(){
  if (typeof XREFS === "undefined" || !XREFS.length) return;
  const sidOf = (bk, c, s) => (bk === DATA.id ? "" : bk + ".html") + "#c" + c + (s == null ? "" : "s" + s);
  const entries = XREFS.slice().sort((a, b) => (b.t || "").length - (a.t || "").length);
  $$(".chapter").forEach(chEl => {
    const chIdx = +chEl.id.slice(1);
    const headText = chEl.querySelector(".ch-head")?.textContent || "";
    const used = new Set();
    const walker = document.createTreeWalker(chEl, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || p.closest("a, .k, h1, h2, h3, .bx-tag, script, style, .ch-head")) return NodeFilter.FILTER_REJECT;
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      let text = node.nodeValue, hits = [];
      entries.forEach(en => {
        const key = en.t;
        if (used.has(key)) return;
        const terms = en.v ? [en.t, ...en.v] : [en.t];
        if (headText.includes(en.t)) return;
        for (const t of terms) {
          const pos = text.indexOf(t);
          if (pos >= 0) { hits.push({ pos, t, en }); break; }
        }
      });
      if (!hits.length) return;
      hits.sort((a, b) => a.pos - b.pos);
      const frag = document.createDocumentFragment();
      let last = 0;
      hits.forEach(h => {
        if (h.pos < last) return;
        frag.appendChild(document.createTextNode(text.slice(last, h.pos)));
        const a = document.createElement("a");
        a.className = "xref"; a.href = sidOf(h.en.b, h.en.c, h.en.s); a.textContent = h.t;
        a.dataset.b = h.en.b; a.dataset.c = h.en.c; a.dataset.s = h.en.s == null ? "" : h.en.s;
        used.add(h.en.t);
        frag.appendChild(a);
        last = h.pos + h.t.length;
      });
      frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  });
}
document.addEventListener("click", e => {
  const a = e.target.closest("a.xref"); if (!a) return;
  const label = a.textContent + " → " + (a.dataset.b === DATA.id ? "本书" : (BOOK.altLabel)) ;
  if (a.dataset.b === DATA.id) {
    e.preventDefault();
    const cur = activeSec();
    BACK.push({ id: cur ? cur.id : CHS[0].el.id, y: scrollY, label: label });
    const sid = "c" + a.dataset.c + (a.dataset.s ? "s" + a.dataset.s : "");
    puppyRun();
    jumpTo(sid, {});
    showBack();
  } else {
    e.preventDefault();
    const cur = activeSec();
    try { sessionStorage.setItem("bio_back", JSON.stringify({ url: location.pathname.split("/").pop(), sid: cur ? cur.id : "", y: scrollY, label: "返回：" + cur?.title })); } catch(err){}
    puppyRun();
    setTimeout(() => { location.href = a.dataset.b + ".html#c" + a.dataset.c + (a.dataset.s ? "s" + a.dataset.s : ""); }, 750);
  }
});
$("#xback") && $("#xback").addEventListener("click", () => {
  puppyRun();
  const top = BACK.pop();
  if (top) { jumpTo(top.id, { afterScroll: () => window.scrollTo({ top: top.y, behavior: "smooth" }) }); showBack(); }
});

/* ---------- 小狗彩蛋 ---------- */
function injectDogEnds(){
  if (typeof DOG_END === "undefined" || !DOG_END) return;
  $$(".chapter").forEach(ch => {
    if (ch.querySelector(".dog-stage")) return;
    const d = document.createElement("div");
    d.className = "ch-end";
    d.innerHTML = `<div class="dog-stage">
      <svg class="dog-chain" viewBox="0 0 230 180" aria-hidden="true">
        <path class="chain-strap" d=""/><g class="chain-links"></g><circle class="chain-clasp" r="4.5"/><circle class="chain-anchor" r="5"/><circle class="chain-ring" r="6"/>
      </svg>
      <div class="dog-body"><img class="ch-dog" alt="戴着项圈的小狗" draggable="false">
        <div class="dog-head"><img class="head-img" alt="" draggable="false"><span class="blush bl"></span><span class="blush br"></span></div>
      </div>
      <span class="dog-hint">拉一拉狗绳</span>
    </div>`;
    ch.appendChild(d);
  });
  $$(".ch-end .ch-dog, .ch-end .head-img").forEach(i => { i.src = DOG_END; });
  bindDogPull();
}
function bindDogPull(){
  $$(".dog-stage").forEach(stage => {
    const body = stage.querySelector(".dog-body");
    const head = stage.querySelector(".dog-head");
    const blushes = stage.querySelectorAll(".blush");
    const strap = stage.querySelector(".chain-strap");
    const links = stage.querySelector(".chain-links");
    const clasp = stage.querySelector(".chain-clasp");
    const anchor = stage.querySelector(".chain-anchor");
    const ring = stage.querySelector(".chain-ring");
    const hint = stage.querySelector(".dog-hint");
    const R = 52, K = 130, DAMP = 9;
    const DOG_X = 41, DOG_Y = 16, DOG_S = 148;
    const PIVOT = { x: DOG_X + 0.47 * DOG_S, y: DOG_Y + 0.66 * DOG_S };
    const RING = { x: DOG_X + 0.455 * DOG_S, y: DOG_Y + 0.655 * DOG_S };
    const A = { x: 18, y: 18 };
    const st = { ax:0, ay:0, vx:0, vy:0, tx:0, ty:0, drag:null, raf:0 };
    const settled = () => !st.drag && Math.hypot(st.ax, st.ay) < .4 && Math.hypot(st.vx, st.vy) < .4;
    function render(){
      const fx = st.ax / R, fy = st.ay / R;
      const hx = fx * 10, hy = fy * 8, rot = fx * 14;
      head.style.transform = `translate(${hx.toFixed(2)}px, ${hy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`;
      const p = Math.min(1, Math.hypot(st.ax, st.ay) / R);
      blushes.forEach(b => { b.style.opacity = (p * .95).toFixed(3); });
      const rad = rot * Math.PI / 180;
      const ox = RING.x - PIVOT.x, oy = RING.y - PIVOT.y;
      const rx = PIVOT.x + ox * Math.cos(rad) - oy * Math.sin(rad) + hx;
      const ry = PIVOT.y + ox * Math.sin(rad) + oy * Math.cos(rad) + hy;
      ring.setAttribute("cx", rx.toFixed(1)); ring.setAttribute("cy", ry.toFixed(1));
      clasp.setAttribute("cx", rx.toFixed(1)); clasp.setAttribute("cy", ry.toFixed(1));
      const ax = A.x + st.ax, ay = A.y + st.ay;
      anchor.setAttribute("cx", ax.toFixed(1)); anchor.setAttribute("cy", ay.toFixed(1));
      const dist = Math.hypot(rx - ax, ry - ay);
      const sag = Math.max(4, Math.min(40, 58 - dist * 0.3));
      const mx = (ax + rx) / 2, my = (ay + ry) / 2 + sag;
      const B = t => ({ x: (1-t)*(1-t)*ax + 2*(1-t)*t*mx + t*t*rx, y: (1-t)*(1-t)*ay + 2*(1-t)*t*my + t*t*ry });
      const j = B(0.86);
      strap.setAttribute("d", `M ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${j.x.toFixed(1)} ${j.y.toFixed(1)}`);
      let lk = "";
      for (let i = 1; i <= 4; i++) {
        const q = B(0.86 + 0.14 * i / 4);
        lk += `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="3.2"/>`;
      }
      links.innerHTML = lk;
    }
    function start(){
      const raf = cb => document.hidden ? setTimeout(cb, 16) : requestAnimationFrame(cb);
      const loop = () => {
        if (st.drag) {
          st.ax += (st.tx - st.ax) * .35; st.ay += (st.ty - st.ay) * .35;
        } else {
          const dt = 1 / 60;
          st.vx += (-K * st.ax - DAMP * st.vx) * dt; st.vy += (-K * st.ay - DAMP * st.vy) * dt;
          st.ax += st.vx * dt; st.ay += st.vy * dt;
        }
        render();
        if (settled()) { st.ax = st.ay = st.vx = st.vy = 0; render(); st.raf = 0; return; }
        st.raf = raf(loop);
      };
      st.raf = raf(loop);
    }
    body.addEventListener("pointerdown", e => {
      e.preventDefault();
      try { body.setPointerCapture(e.pointerId); } catch(err) {}
      const r = stage.getBoundingClientRect();
      st.drag = { w: r.width, h: r.height };
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const dx = px - A.x, dy = py - A.y;
      const d = Math.hypot(dx, dy);
      const eff = d > R ? R + (d - R) * .2 : d;
      const k = d ? eff / d : 0;
      st.tx = dx * k; st.ty = dy * k;
      st.raf || start();
      stage.classList.add("grabbing");
      hint.classList.add("off");
    });
    body.addEventListener("pointermove", e => {
      if (!st.drag) return;
      const r = stage.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const dx = px - A.x, dy = py - A.y;
      const d = Math.hypot(dx, dy);
      const eff = d > R ? R + (d - R) * .2 : d;
      const k = d ? eff / d : 0;
      st.tx = dx * k; st.ty = dy * k;
    });
    const end = () => {
      if (!st.drag) return;
      st.drag = null; st.tx = st.ty = 0;
      stage.classList.remove("grabbing");
    };
    body.addEventListener("pointerup", end);
    body.addEventListener("pointercancel", end);
  });
}
let PUP_T = null, PUP_F = null;
const RUN_FRAMES = ["5% 10%", "95.3% 11.1%", "94.3% 90.7%", "2.9% 86.8%"];
function puppyRun(){
  const el = $("#puppy-run"); if (!el || typeof DOG_RUN === "undefined" || !DOG_RUN) return;
  const sp = el.querySelector(".run-sprite");
  sp.style.backgroundImage = `url("${DOG_RUN}")`;
  el.classList.remove("run"); void el.offsetWidth; el.classList.add("run");
  let f = 0;
  const tick = () => { sp.style.backgroundPosition = RUN_FRAMES[f % 4]; f++; };
  tick();
  clearInterval(PUP_F); PUP_F = setInterval(tick, 110);
  clearTimeout(PUP_T);
  PUP_T = setTimeout(() => { el.classList.remove("run"); clearInterval(PUP_F); }, 1400);
}

/* ---------- 挖空 ---------- */
function setupCloze(){
  const ks = $$(".content .k");
  ks.forEach((k, i) => k.dataset.ci = i);
  applyClozeMode();
}
function applyClozeMode(){
  const mode = U().clozeMode || "off";
  $$(".content .k").forEach(k => {
    const on = mode === "all" || (mode === "half" && (+k.dataset.ci % 2 === 0));
    k.classList.remove("cz", "open");
    if (on) k.classList.add("cz");
  });
  $$(".cloze-group .tbtn").forEach(b => b.classList.toggle("on", b.dataset.mode === mode));
}
document.addEventListener("click", e => {
  const k = e.target.closest(".k.cz"); if (!k) return;
  if (!k.classList.contains("open")) {
    k.classList.add("open");
    const u = U(); u.cloze.revealed = (u.cloze.revealed || 0) + 1;
    const sid = k.closest("h2") ? k.closest("h2").id : k.closest(".chapter")?.id;
    if (sid) { u.cloze.secs[sid] = (u.cloze.secs[sid] || 0) + 1; }
    saveStore(); refreshSidebarState();
  } else { k.classList.remove("open"); }
});
/* ---------- 判断快测 ---------- */
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let QZ = null;
function openQuiz(chKey){
  const bank = (typeof BOOK !== "undefined" && BOOK ? BOOK.quiz : HOME.quiz).map(q => ({ ...q }));
  const list = shuffle(chKey === "all" ? bank : bank.filter(q => "c" + q.ch === chKey)).slice(0, 10);
  if (!list.length) { alert("该章节暂无判断题"); return; }
  QZ = { list, i: 0, score: 0, key: chKey, answered: false };
  openModal("#m-quiz");
  renderQuiz();
}
function renderQuiz(){
  const q = QZ.list[QZ.i];
  $("#qz-meta").textContent = `第 ${QZ.i + 1} / ${QZ.list.length} 题 · 当前得分 ${QZ.score}`;
  $("#qz-stem").textContent = q.q;
  $("#qz-fb").className = "qz-fb"; $("#qz-fb").innerHTML = "";
  $("#qz-next").classList.remove("show");
  $("#qz-btns").style.display = "flex";
}
function answerQuiz(v){
  if (QZ.answered) return;
  const q = QZ.list[QZ.i]; QZ.answered = true;
  const ok = (v === q.a);
  if (ok) QZ.score++;
  const fb = $("#qz-fb");
  fb.className = "qz-fb show " + (ok ? "ok" : "no");
  fb.innerHTML = `<b>${ok ? "回答正确" : "回答错误"}。</b>正确答案：${q.a ? "√ 对" : "× 错"}${q.e ? "<br>" + esc(q.e) : ""}`;
  $("#qz-btns").style.display = "none";
  const isLast = QZ.i === QZ.list.length - 1;
  $("#qz-next").textContent = isLast ? "查看成绩" : "下一题";
  $("#qz-next").classList.add("show");
}
function quizNext(){
  if (QZ.ended) { QZ.ended = false; openQuiz(QZ.key); return; }
  if (QZ.i < QZ.list.length - 1) { QZ.i++; QZ.answered = false; renderQuiz(); return; }
  const u = U(); const rec = u.quiz[QZ.key] || { best: 0, attempts: 0 };
  rec.attempts++; rec.best = Math.max(rec.best, QZ.score); rec.last = Date.now();
  u.quiz[QZ.key] = rec; saveStore();
  $("#qz-meta").textContent = `本轮成绩`;
  $("#qz-stem").innerHTML = `<span style="font-size:34px;font-weight:800;color:var(--pri)">${QZ.score} / ${QZ.list.length}</span>
    <div style="margin-top:8px;font-size:13.5px;color:var(--mut)">历史最佳 ${rec.best} / ${QZ.list.length} · 已练习 ${rec.attempts} 轮</div>`;
  $("#qz-fb").className = "qz-fb"; $("#qz-next").textContent = "再来一轮";
  QZ.answered = false;
  QZ.ended = true;
  QZ.score = 0;
}

/* ---------- 闪卡 ---------- */
let FC = null;
function openCards(chKey){
  const bank = (typeof BOOK !== "undefined" && BOOK ? BOOK.cards : HOME.cards).map(c => ({ ...c }));
  let list = shuffle(chKey === "all" ? bank : bank.filter(c => "c" + c.ch === chKey));
  if (!list.length) { alert("暂无闪卡"); return; }
  FC = { list, i: 0, yes: 0, no: 0 };
  openModal("#m-cards"); renderCard();
}
function renderCard(){
  const c = FC.list[FC.i];
  const box = $("#fc-box");
  box.innerHTML = `<div class="fc-card" id="fc-card">
    <div class="fc-face"><div class="fc-term">${esc(c.t)}</div><div class="fc-hint">点击卡片查看释义</div></div>
    <div class="fc-face back"><div>${esc(c.c)}</div></div></div>`;
  const card = $("#fc-card");
  card.addEventListener("click", () => card.classList.toggle("flip"));
  $("#fc-meta").textContent = `第 ${FC.i + 1} / ${FC.list.length} 张 · 记住 ${FC.yes} · 没记住 ${FC.no}`;
  $("#fc-btns").style.display = "flex";
}
function rateCard(yes){
  const c = FC.list[FC.i]; const u = U();
  u.cards.known[c.t] = yes ? 1 : 0; u.cards.seen = (u.cards.seen || 0) + 1;
  yes ? FC.yes++ : FC.no++; saveStore();
  if (FC.i < FC.list.length - 1) { FC.i++; renderCard(); return; }
  $("#fc-meta").textContent = "本轮完成";
  $("#fc-box").innerHTML = `<div class="fc-card"><div class="fc-face"><div class="fc-term">记住 ${FC.yes} / ${FC.list.length}</div>
    <div class="fc-hint">没记住 ${FC.no} 张 · 再来一轮巩固</div></div></div>`;
  $("#fc-btns").style.display = "none";
}

/* ---------- 搜索 ---------- */
function searchAll(qs){
  const q = qs.trim().toLowerCase(); if (!q) return [];
  const idx = typeof BOOK !== "undefined" && BOOK ? DATA.search : HOME.search;
  const out = [];
  idx.forEach(it => {
    const hay = (it.t + " " + it.chT + " " + (it.terms || "") + " " + it.x).toLowerCase();
    if (!hay.includes(q)) return;
    let score = 0;
    if (it.t.toLowerCase().includes(q)) score += 6;
    if ((it.terms || "").toLowerCase().includes(q)) score += 4;
    if (it.chT.toLowerCase().includes(q)) score += 2;
    out.push({ ...it, score });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, 20);
}
function openSearch(prefill){
  openModal("#m-search");
  const inp = $("#sp-input"); inp.value = prefill || ""; inp.focus();
  renderSearch(inp.value);
}
function renderSearch(qs){
  const res = searchAll(qs);
  const box = $("#sp-list");
  box.innerHTML = res.length ? res.map((r, i) =>
    `<button class="sp-item${i === 0 ? " cur" : ""}" data-jump="${r.id}">
      <div class="sp-t">${esc(r.chT)} · ${esc(r.t)}</div><div class="sp-c">${hl(r.x, qs)}</div></button>`).join("")
    : `<div class="sp-empty">没有找到相关知识点</div>`;
  box.querySelectorAll(".sp-item").forEach(b => b.addEventListener("click", () => {
    closeModal(); jumpTo(b.dataset.jump, {});
  }));
}
function hl(text, q){
  const t = esc(text.slice(0, 90)); if (!q) return t;
  const i = t.toLowerCase().indexOf(q.toLowerCase());
  return i < 0 ? t : t.slice(0, i) + "<mark>" + t.slice(i, i + q.length) + "</mark>" + t.slice(i + q.length);
}
/* ---------- 弹窗 ---------- */
function openModal(sel){ $$(".modal").forEach(m => m.classList.remove("show")); $(sel).classList.add("show"); $("#mask").classList.add("show"); }
function closeModal(){ $$(".modal").forEach(m => m.classList.remove("show")); $("#mask").classList.remove("show"); }

/* ---------- 用户菜单 ---------- */
function openUserMenu(anchor){
  closeFloat();
  const m = document.createElement("div"); m.className = "float-menu"; m.id = "float-user";
  const names = Object.keys(store.users);
  m.innerHTML = names.map(n =>
    `<button class="fm-item${n === store.current ? " cur" : ""}" data-u="${esc(n)}">● ${esc(n)}${n === store.current ? "（当前）" : ""}</button>`).join("")
    + `<div class="fm-sep"></div><button class="fm-item" id="fm-add">＋ 新建用户</button>`
    + (names.length > 1 ? `<button class="fm-item danger" id="fm-del">删除当前用户数据</button>` : "")
    + `<div class="fm-sep"></div><div style="padding:6px 12px;font-size:11.5px;color:var(--mut);line-height:1.6">学习数据保存在本机浏览器，<br>不同用户互不影响。</div>`;
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  m.style.top = (r.bottom + 8) + "px";
  m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 10) + "px";
  m.querySelectorAll("[data-u]").forEach(b => b.addEventListener("click", () => {
    store.current = b.dataset.u; saveStore(); location.reload();
  }));
  $("#fm-add").addEventListener("click", () => {
    const name = (prompt("新用户名称：") || "").trim();
    if (!name) return;
    if (store.users[name]) { alert("该用户已存在"); return; }
    store.users[name] = defUser(); store.current = name; saveStore(); location.reload();
  });
  const del = $("#fm-del");
  if (del) del.addEventListener("click", () => {
    if (!confirm(`删除「${store.current}」的全部学习数据？不可恢复。`)) return;
    delete store.users[store.current];
    store.current = Object.keys(store.users)[0] || null; saveStore(); location.reload();
  });
  setTimeout(() => document.addEventListener("click", closeFloatOnce), 0);
}
function closeFloatOnce(e){ if (!e.target.closest("#float-user")) closeFloat(); }
function closeFloat(){ const m = $("#float-user"); if (m) m.remove(); document.removeEventListener("click", closeFloatOnce); }
function bindUserChip(){
  const chip = $("#user-chip"); if (!chip) return;
  const render = () => { $("#u-name").textContent = store.current; $("#u-dot").textContent = (store.current || "客").slice(0, 1); };
  render();
  chip.addEventListener("click", e => { e.stopPropagation(); if ($("#float-user")) { closeFloat(); return; } openUserMenu(chip); });
}

/* ---------- 滚动监听 ---------- */
let NAV = [], activeId = null, saveTimer = null;
function activeSec(){ return NAV.find(s => s.id === activeId); }
function markVisited(nav){
  const u = U(); const arr = u.visited[DATA.id] = u.visited[DATA.id] || [];
  const track = nav.isSec || nav.solo;
  if (track && !arr.includes(nav.id)) { arr.push(nav.id); saveStore(); refreshSidebarState(); }
}
function onScroll(){
  const st = scrollY + 140;
  let cur = NAV[0];
  for (const s of NAV) { if (s.top <= st) cur = s; else break; }
  if (cur && cur.id !== activeId) {
    activeId = cur.id; markVisited(cur);
    $$(".toc-sec").forEach(b => b.classList.toggle("active", b.dataset.jump === cur.id));
    if (cur.chIdx != null) {
      const box = $(`.toc-ch[data-ch="${cur.chIdx}"]`);
      if (box) box.classList.add("open");
      $("#crumb").innerHTML = `<b>${esc(BOOK.label)}</b> · ${esc(cur.chT)} · ${esc(cur.title)}`;
    }
  }
  const h = document.documentElement.scrollHeight - innerHeight;
  const bar = $("#readbar i"); if (bar) bar.style.width = (h > 0 ? Math.min(100, scrollY / h * 100) : 0) + "%";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(savePos, 900);
}
function measureNav(){ NAV.forEach(s => { s.top = s.el.getBoundingClientRect().top + scrollY; }); }
function savePos(){
  if (!activeId) return;
  U().last[DATA.id] = { sid: activeId, y: Math.round(scrollY), ts: Date.now() }; saveStore();
}
function savePositionNow(){ savePos(); }

/* ---------- 初始化（书籍页） ---------- */
function bootBook(){
  applyTheme();
  const chaps = $$(".chapter");
  chaps.forEach((el, i) => {
    el.id = "c" + i;
    const meta = BOOK.chapters[i] || { n: String(i + 1), t: el.querySelector(".ch-head h1")?.textContent || "" };
    const h2s = [...el.querySelectorAll("h2")];
    h2s.forEach((h, j) => { h.id = "c" + i + "s" + j; });
    CHS.push({ i, n: meta.n, t: meta.t, el, secEls: h2s });
    NAV.push({ id: el.id, el, chIdx: i, chT: meta.t, title: meta.t, isSec: false, solo: h2s.length === 0 });
    h2s.forEach(h => NAV.push({ id: h.id, el: h, chIdx: i, chT: meta.t, title: h.textContent, isSec: true }));
  });
  buildTOC();
  buildXrefs();
  injectDogEnds();
  setupCloze();
  syncDots();
  bindToolbar();
  bindUserChip();
  bindQuizChips(); bindCardChips();
  measureNav();
  // 跨册返回按钮
  try {
    const b = sessionStorage.getItem("bio_back");
    if (b) { const pill = $("#xback"); pill.querySelector("span").textContent = JSON.parse(b).label; pill.classList.add("show"); }
  } catch(e){}
  // 目标定位：hash > 上次位置
  const restore = () => {
    const ret = sessionStorage.getItem("bio_return");
    if (ret) { try { const { y } = JSON.parse(ret); window.scrollTo(0, y); } catch(e){} sessionStorage.removeItem("bio_return"); measureNav(); onScroll(); return; }
    const h = location.hash.slice(1);
    if (h && document.getElementById(h)) { activeId = h; jumpTo(h, { instant: true, flash: false }); measureNav(); onScroll(); return; }
    const last = U().last[DATA.id];
    if (last && document.getElementById(last.sid)) {
      jumpTo(last.sid, { instant: true, flash: false, afterScroll: () => window.scrollTo(0, last.y) });
    }
    measureNav(); onScroll();
  };
  setTimeout(restore, 250);
  window.addEventListener("scroll", () => requestAnimationFrame(onScroll), { passive: true });
  window.addEventListener("beforeunload", savePositionNow);
  onScroll();
}
/* ---------- 工具栏绑定 ---------- */
function bindToolbar(){
  $("#btn-menu").addEventListener("click", () => document.body.classList.toggle("side-collapsed"));
  $("#side-collapse").addEventListener("click", () => { document.body.classList.add("side-collapsed"); U().side = false; saveStore(); });
  $("#side-expand").addEventListener("click", () => { document.body.classList.remove("side-collapsed"); U().side = true; saveStore(); });
  if (U().side === false && window.innerWidth > 900) document.body.classList.add("side-collapsed");
  $$(".cloze-group .tbtn").forEach(b => b.addEventListener("click", () => { U().clozeMode = b.dataset.mode; saveStore(); applyClozeMode(); }));
  $("#btn-quiz").addEventListener("click", () => openModal("#m-quiz"));
  $("#btn-cards").addEventListener("click", () => openModal("#m-cards"));
  $("#btn-dice").addEventListener("click", openDice);
  $("#btn-theme").addEventListener("click", toggleTheme);
  $("#btn-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  $("#search-in").addEventListener("click", () => openSearch());
  $("#sp-input").addEventListener("input", e => renderSearch(e.target.value));
  $("#dice-again").addEventListener("click", openDice);
  $("#qz-yes").addEventListener("click", () => answerQuiz(true));
  $("#qz-no").addEventListener("click", () => answerQuiz(false));
  $("#qz-next").addEventListener("click", quizNext);
  $("#fc-yes").addEventListener("click", () => rateCard(true));
  $("#fc-no").addEventListener("click", () => rateCard(false));
  $$(".m-close").forEach(b => b.addEventListener("click", closeModal));
  $("#mask").addEventListener("click", closeModal);
  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
    if (e.key === "Escape") closeModal();
  });
}
function bindQuizChips(){
  const box = $("#qz-chips"); if (!box) return;
  box.innerHTML = `<button class="sel-chip on" data-k="all">全部</button>`
    + BOOK.chapters.map((c, i) => `<button class="sel-chip" data-k="c${i}">${esc(c.n)} ${esc(c.t)}</button>`).join("");
  box.querySelectorAll(".sel-chip").forEach(b => b.addEventListener("click", () => {
    box.querySelectorAll(".sel-chip").forEach(x => x.classList.toggle("on", x === b));
    openQuiz(b.dataset.k);
  }));
}
function bindCardChips(){
  const box = $("#fc-chips"); if (!box) return;
  box.innerHTML = `<button class="sel-chip on" data-k="all">全部</button>`
    + BOOK.chapters.map((c, i) => `<button class="sel-chip" data-k="c${i}">${esc(c.n)} ${esc(c.t)}</button>`).join("");
  box.querySelectorAll(".sel-chip").forEach(b => b.addEventListener("click", () => {
    box.querySelectorAll(".sel-chip").forEach(x => x.classList.toggle("on", x === b));
    openCards(b.dataset.k);
  }));
}
function openDice(){
  const bank = typeof BOOK !== "undefined" && BOOK ? BOOK.cards : HOME.cards;
  const c = bank[Math.floor(Math.random() * bank.length)];
  openModal("#m-dice");
  $("#dice-term").textContent = c.t;
  $("#dice-ctx").textContent = c.c;
}

/* ---------- 落地页 ---------- */
function bootHome(){
  applyTheme(); bindUserChip();
  $("#hs-user").textContent = store.current || "";
  const u = U();
  $("#home-books").innerHTML = HOME.books.map(b => {
    const read = (u.visited[b.id] || []).length;
    const pct = Math.min(100, Math.round(read / b.secs * 100));
    return `<a class="book-card" href="${b.file}">
      <h2>${esc(b.label)}</h2><div class="bc-sub">${esc(b.sub)}</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="bc-meta"><span>已读 ${read} / ${b.secs} 节</span><span>${b.chN} 章</span><span>判断题 ${b.quizN} 条</span><span>闪卡 ${b.cardN} 张</span></div></a>`;
  }).join("");
  $("#home-books").addEventListener("click", e => {
    const a = e.target.closest("a.book-card"); if (!a) return;
    e.preventDefault(); puppyRun();
    setTimeout(() => { location.href = a.getAttribute("href"); }, 750);
  });
  const qzBest = Math.max(0, ...Object.values(u.quiz).map(r => r.best || 0));
  $("#home-stats").innerHTML = `
    <div class="stat"><b>${(u.visited.m1 || []).length + (u.visited.m2 || []).length}</b><span>累计已读节数</span></div>
    <div class="stat"><b>${u.cloze.revealed || 0}</b><span>挖空已回忆次数</span></div>
    <div class="stat"><b>${u.cards.seen || 0}</b><span>闪卡练习张数</span></div>
    <div class="stat"><b>${qzBest}</b><span>判断题单轮最佳（满分10）</span></div>`;
  $("#btn-dice2").addEventListener("click", openDice);
  $("#btn-theme2").addEventListener("click", toggleTheme);
  $$(".m-close").forEach(b => b.addEventListener("click", closeModal));
  $("#mask").addEventListener("click", closeModal);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
}

/* ---------- 启动 ---------- */
if (document.body.dataset.book === "home") bootHome(); else bootBook();

