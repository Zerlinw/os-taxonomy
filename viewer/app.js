/* ==========================================================================
 * Marble Skill Taxonomy — Node Graph Viewer
 * Self-contained: vanilla JS + Canvas 2D, no external dependencies.
 * Data comes from window.TAXONOMY (viewer/data.js).
 * ========================================================================== */
(() => {
  'use strict';

  const T = window.TAXONOMY;

  /* ---------------------------------------------------------- palette ---- */
  const SUBJECT_COLORS = {
    Science: '#38bdf8',
    Mathematics: '#f472b6',
    English: '#fbbf24',
    History: '#a78bfa',
    'Personal & Social Development': '#34d399',
    'Life Skills': '#fb923c',
    Computing: '#22d3ee',
    'Learning to Learn': '#e879f9',
  };
  const SUBJECT_ZH = {
    Science: '科学',
    Mathematics: '数学',
    English: '英语',
    History: '历史',
    'Personal & Social Development': '个人与社会发展',
    'Life Skills': '生活技能',
    Computing: '计算思维',
    'Learning to Learn': '学会学习',
  };
  const TYPE_ZH = {
    CONCEPTUAL: '概念',
    PROCEDURAL: '程序性',
    REPRESENTATIONAL: '表征',
    LANGUAGE: '语言',
    META: '元认知',
  };
  const BG = '#0b1020';

  /* --------------------------------------------- static zh glossaries --- */
  const DOMAIN_ZH = {
    'Artificial Intelligence': '人工智能',
    'English Thinking': '英语思维',
    'Grammar & Punctuation': '语法与标点',
    'Handwriting & Transcription': '书写与抄写',
    'Phonics & Word Reading': '自然拼读与词汇阅读',
    'Reading Comprehension': '阅读理解',
    'Speaking & Listening': '口语与听力',
    'Spelling & Word Study': '拼写与词汇学习',
    'Vocabulary': '词汇',
    'Writing Composition': '写作',
    'Ancient Egypt': '古埃及',
    'Ancient Greece & Rome': '古希腊与古罗马',
    'Historical Thinking': '历史思维',
    'Medieval Times': '中世纪',
    'Learning to Learn': '学会学习',
    'Entrepreneurship': '创业精神',
    'Money & Finance': '金钱与理财',
    'Addition & Subtraction': '加减法',
    'Algebra': '代数',
    'Counting & Cardinality': '计数与基数',
    'Data & Statistics': '数据与统计',
    'Fractions': '分数',
    'Geometry': '几何',
    'Mathematical Thinking': '数学思维',
    'Measurement': '测量',
    'Multiplication & Division': '乘除法',
    'Number Representation & Place Value': '数的表示与位值',
    'Probability': '概率',
    'Ratio & Proportion': '比与比例',
    'Emotional Literacy': '情绪素养',
    'Empathy & Social Awareness': '共情与社会意识',
    'Friendship & Cooperation': '友谊与合作',
    'Responsible Decision-Making': '负责任的决策',
    'Self-Awareness': '自我认知',
    'Self-Regulation & Resilience': '自我调节与心理韧性',
    'Animals of the World': '世界动物',
    'Dinosaurs & Paleontology': '恐龙与古生物学',
    "Earth's Systems": '地球系统',
    'Ecosystems & Habitats': '生态系统与栖息地',
    'Energy': '能量',
    'Forces & Motion': '力与运动',
    'Insects & Minibeasts': '昆虫与小生物',
    'Matter & Materials': '物质与材料',
    'Ocean Life': '海洋生物',
    'Organisms & Life Processes': '生物与生命过程',
    'Polar Regions': '极地',
    'Rainforests': '雨林',
    'Scientific Inquiry': '科学探究',
    'Space Exploration': '太空探索',
    "Space Systems & Earth's History": '太空系统与地球历史',
    'The Human Body': '人体',
    'Volcanoes & Earthquakes': '火山与地震',
    'Waves, Light & Sound': '波、光与声',
    'Weather & Climate': '天气与气候',
  };

  const CURRICULUM_ZH = {
    'uk-nc-2013': '英国国家课程标准（KS1–2）',
    'ib-pyp-pspe': 'IB 小学项目（PYP）· 个人/社会/体育',
    'c3-social-studies': 'C3 社会研究框架',
    'ccss-ela': '共同核心标准 · 英语语言艺术',
    'ccss-math': '共同核心标准 · 数学',
    'ngss-k5': '新一代科学标准（K–5）',
    'ngss-ms': '新一代科学标准（中学）',
  };

  /* -------------------------------------------- runtime translation ----- */
  // Long-form content (names, descriptions, evidence, …) is translated on
  // demand via Google's free endpoint, cached in localStorage, with a
  // MyMemory fallback. If offline, the panel silently stays English-only.
  const LS_KEY = 'mst-zh-cache-v1';
  let zhEnabled = localStorage.getItem('mst-zh-on') !== '0';
  const memCache = new Map();
  try {
    const stored = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    for (const k of Object.keys(stored)) memCache.set(k, stored[k]);
  } catch { /* ignore corrupt cache */ }

  function persistCache() {
    try {
      const obj = {};
      let n = 0;
      for (const [k, v] of memCache) { obj[k] = v; if (++n >= 4000) break; }
      localStorage.setItem(LS_KEY, JSON.stringify(obj));
    } catch { /* over quota — keep memory-only */ }
  }

  const inflight = new Map();
  let active = 0;
  const queue = [];
  function pumpQueue() {
    while (active < 6 && queue.length) {
      const run = queue.shift();
      active++;
      run().finally(() => { active--; pumpQueue(); });
    }
  }

  function fetchGoogle(text) {
    const url =
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=' +
      encodeURIComponent(text);
    return fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const seg = d && d[0];
        const zh = seg && seg.length ? seg.map((s) => s[0]).join('') : '';
        return saneZh(zh, text);
      })
      .catch(() => null);
  }

  function fetchMyMemory(text) {
    const url =
      'https://api.mymemory.translated.net/get?q=' +
      encodeURIComponent(text) + '&langpair=en|zh-CN';
    return fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const out = d && d.responseData && d.responseData.translatedText;
        if (typeof out !== 'string') return null;
        // quota / limit notices come back inside translatedText
        if (/MYMEMORY WARNING|QUOTA|LIMIT EXCEEDED/i.test(out)) return null;
        return saneZh(out, text);
      })
      .catch(() => null);
  }

  // Reject results that are empty or just echo the source text.
  function saneZh(zh, text) {
    if (!zh) return null;
    const a = zh.trim().toLowerCase();
    const b = (text || '').trim().toLowerCase();
    return a && a !== b ? zh.trim() : null;
  }

  // Returns a Promise resolving to the Chinese text, or null if unavailable.
  function t(text) {
    text = (text || '').trim();
    if (!text || !zhEnabled) return Promise.resolve(null);
    if (memCache.has(text)) return Promise.resolve(memCache.get(text));
    if (inflight.has(text)) return inflight.get(text);
    const p = new Promise((resolve) => {
      queue.push(() =>
        fetchMyMemory(text)
          .then((zh) => zh || fetchGoogle(text))
          .then((zh) => {
            if (zh) { memCache.set(text, zh); persistCache(); }
            inflight.delete(text);
            resolve(zh || null);
          })
      );
    });
    inflight.set(text, p);
    pumpQueue();
    return p;
  }

  /* ------------------------------------------------------------- setup --- */
  const canvas = document.getElementById('graph');
  const ctx = canvas.getContext('2d');
  const tooltip = document.getElementById('tooltip');
  const detailPanel = document.getElementById('detail');
  const statusCounts = document.getElementById('status-counts');
  const searchInput = document.getElementById('search');
  const searchResults = document.getElementById('search-results');

  // Build simulation nodes
  const maxCentrality = Math.max(...T.nodes.map((n) => n.centrality), 1e-9);
  const nodes = T.nodes.map((n) => ({
    ...n,
    x: 0, y: 0, vx: 0, vy: 0, fx: null, fy: null,
    degree: 0,
    radius: 3 + 5 * Math.sqrt(n.centrality / maxCentrality),
    active: true,
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Edges as node references (from = prerequisite, to = topic)
  const edges = T.edges
    .map((e) => ({ s: byId.get(e.from), t: byId.get(e.to), strength: e.strength, reason: e.reason }))
    .filter((e) => e.s && e.t);
  for (const e of edges) { e.s.degree++; e.t.degree++; }

  // Adjacency: prerequisites of a topic / topics unlocked by a topic
  const prereqOf = new Map(); // id -> [{node, strength, reason}]
  const unlocksOf = new Map();
  for (const n of nodes) { prereqOf.set(n.id, []); unlocksOf.set(n.id, []); }
  for (const e of edges) {
    prereqOf.get(e.t.id).push({ node: e.s, strength: e.strength, reason: e.reason });
    unlocksOf.get(e.s.id).push({ node: e.t, strength: e.strength, reason: e.reason });
  }
  // All ancestors (transitive prerequisites) for highlighting
  const ancestorCache = new Map();
  function ancestorsOf(id) {
    if (ancestorCache.has(id)) return ancestorCache.get(id);
    const seen = new Set([id]);
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      for (const p of prereqOf.get(cur)) {
        if (!seen.has(p.node.id)) { seen.add(p.node.id); stack.push(p.node.id); }
      }
    }
    ancestorCache.set(id, seen);
    return seen;
  }

  /* ------------------------------------------------------------- state --- */
  const state = {
    subjects: new Set(T.subjects),           // visible subjects
    types: new Set(Object.keys(TYPE_ZH)),    // visible topic types
    selected: null,
    hover: null,
    physics: true,
    ageLayers: false,
    showSoft: true,
  };

  const camera = { x: 0, y: 0, k: 0.55 };
  let W = 0, H = 0, DPR = 1;

  /* ------------------------------------------------------ force engine --- */
  // Barnes-Hut quadtree for O(n log n) repulsion.
  function qtNew(x0, y0, x1, y1) {
    return { x0, y0, x1, y1, cx: 0, cy: 0, mass: 0, kids: null, body: null };
  }
  function qtInsert(root, n) {
    let node = root;
    for (;;) {
      if (node.kids === null && node.body === null) {
        node.body = n;
        node.cx = n.x; node.cy = n.y; node.mass = 1;
        return;
      }
      if (node.kids === null) {
        // subdivide, re-insert existing body
        const b = node.body;
        node.body = null;
        node.kids = [null, null, null, null];
        const mx = (node.x0 + node.x1) / 2, my = (node.y0 + node.y1) / 2;
        const qi = (b.x >= mx ? 2 : 0) + (b.y >= my ? 1 : 0);
        const q = node.kids[qi];
        node.kids[qi] = qtNew(
          qi & 2 ? mx : node.x0, qi & 1 ? my : node.y0,
          qi & 2 ? node.x1 : mx, qi & 1 ? node.y1 : my
        );
        node.kids[qi].body = b; node.kids[qi].cx = b.x; node.kids[qi].cy = b.y; node.kids[qi].mass = 1;
      }
      const mx = (node.x0 + node.x1) / 2, my = (node.y0 + node.y1) / 2;
      const qi = (n.x >= mx ? 2 : 0) + (n.y >= my ? 1 : 0);
      if (node.kids[qi] === null) {
        node.kids[qi] = qtNew(
          qi & 2 ? mx : node.x0, qi & 1 ? my : node.y0,
          qi & 2 ? node.x1 : mx, qi & 1 ? node.y1 : my
        );
      }
      node = node.kids[qi];
    }
  }
  function qtAccumulate(node) {
    if (!node) return;
    if (node.body) { node.cx = node.body.x; node.cy = node.body.y; node.mass = 1; return; }
    let cx = 0, cy = 0, m = 0;
    for (const k of node.kids) {
      if (k) { qtAccumulate(k); cx += k.cx * k.mass; cy += k.cy * k.mass; m += k.mass; }
    }
    node.mass = m;
    if (m > 0) { node.cx = cx / m; node.cy = cy / m; }
  }
  const THETA2 = 0.81; // theta^2
  function qtForce(node, n, out) {
    if (!node || node.mass === 0) return;
    const dx = node.cx - n.x, dy = node.cy - n.y;
    const d2 = dx * dx + dy * dy;
    if (node.body) {
      if (node.body === n) return;
      if (d2 > 0) {
        const d = Math.sqrt(d2);
        const f = (CHARGE * (1 + Math.min(node.body.degree, 12) * 0.04)) / d2;
        out.fx -= (dx / d) * f; out.fy -= (dy / d) * f;
      }
      return;
    }
    const w = node.x1 - node.x0;
    if (w * w < THETA2 * d2) {
      if (d2 > 0) {
        const d = Math.sqrt(d2);
        const f = (CHARGE * node.mass) / d2;
        out.fx -= (dx / d) * f; out.fy -= (dy / d) * f;
      }
      return;
    }
    for (const k of node.kids) qtForce(k, n, out);
  }

  const CHARGE = -70;          // repulsion strength (negative = repel)
  const LINK_DIST = { hard: 42, soft: 64 };
  const VEL_DECAY = 0.55;      // velocity damping (higher = calmer)
  const SPEED = 0.45;          // global animation speed (< 1 = slower)
  const CENTER_PULL = 0.028;
  let alpha = 1;

  function tick() {
    if (!state.physics && alpha < 0.02) return;
    alpha = Math.max(0.012, alpha * 0.993 + 0.0002);

    // repulsion (Barnes-Hut)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
    }
    const pad = 60;
    const root = qtNew(minX - pad, minY - pad, maxX + pad, maxY + pad);
    for (const n of nodes) if (n.active) qtInsert(root, n);
    qtAccumulate(root);
    for (const n of nodes) {
      if (!n.active) continue;
      const out = { fx: 0, fy: 0 };
      qtForce(root, n, out);
      n.vx += out.fx * alpha;
      n.vy += out.fy * alpha;
    }

    // link springs
    for (const e of edges) {
      if (!e.s.active || !e.t.active) continue;
      const dx = e.t.x - e.s.x, dy = e.t.y - e.s.y;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.01) { d = 0.01; }
      const target = LINK_DIST[e.strength];
      const k = (d - target) / d * alpha * (e.strength === 'hard' ? 0.55 : 0.22);
      const bias = 1 / Math.min(e.s.degree, e.t.degree);
      const w = k * bias;
      e.s.vx += dx * w; e.s.vy += dy * w;
      e.t.vx -= dx * w; e.t.vy -= dy * w;
    }

    // centering + optional age layers
    for (const n of nodes) {
      if (!n.active) continue;
      n.vx += (0 - n.x) * CENTER_PULL * alpha * 6;
      n.vy += (0 - n.y) * CENTER_PULL * alpha * 6;
      if (state.ageLayers) {
        const ty = (n.ageStart - 4) * 52;
        n.vy += (ty - n.y) * 0.09 * alpha * 6;
      }
      if (n.fx !== null) { n.x = n.fx; n.y = n.fy; n.vx = 0; n.vy = 0; continue; }
      n.vx *= VEL_DECAY; n.vy *= VEL_DECAY;
      n.x += n.vx * SPEED; n.y += n.vy * SPEED;
    }
  }

  /* ------------------------------------------------------------ render --- */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
  }
  window.addEventListener('resize', resize);

  function screenWorld(sx, sy) {
    return { x: (sx - W / 2 - camera.x) / camera.k, y: (sy - H / 2 - camera.y) / camera.k };
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const sel = state.selected;
    const hl = sel ? highlightSet(sel) : null;

    ctx.save();
    ctx.translate(W / 2 + camera.x, H / 2 + camera.y);
    ctx.scale(camera.k, camera.k);

    // ---- edges
    const showEdges = camera.k > 0.12;
    if (showEdges) {
      ctx.lineWidth = Math.max(0.4, 0.7 / camera.k);
      // hard edges
      ctx.beginPath();
      for (const e of edges) {
        if (!e.s.active || !e.t.active) continue;
        if (e.strength !== 'hard') continue;
        if (hl && !(hl.has(e.s.id) && hl.has(e.t.id))) continue;
        ctx.moveTo(e.s.x, e.s.y);
        ctx.lineTo(e.t.x, e.t.y);
      }
      ctx.strokeStyle = sel ? 'rgba(148,197,255,0.34)' : 'rgba(148,197,255,0.26)';
      ctx.stroke();
      // soft edges (dashed)
      if (state.showSoft) {
        ctx.setLineDash([2.5, 3]);
        ctx.beginPath();
        for (const e of edges) {
          if (!e.s.active || !e.t.active) continue;
          if (e.strength !== 'soft') continue;
          if (hl && !(hl.has(e.s.id) && hl.has(e.t.id))) continue;
          ctx.moveTo(e.s.x, e.s.y);
          ctx.lineTo(e.t.x, e.t.y);
        }
        ctx.strokeStyle = sel ? 'rgba(148,163,184,0.14)' : 'rgba(148,163,184,0.10)';
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ---- nodes, batched by subject color
    const rScale = Math.max(0.55, Math.min(1.6, camera.k));
    for (const subject of T.subjects) {
      if (!state.subjects.has(subject)) continue;
      ctx.beginPath();
      for (const n of nodes) {
        if (n.subject !== subject || !n.active) continue;
        if (hl && !hl.has(n.id)) continue;
        ctx.moveTo(n.x + n.radius * rScale, n.y);
        ctx.arc(n.x, n.y, n.radius * rScale, 0, Math.PI * 2);
      }
      ctx.globalAlpha = sel ? 0.5 : 0.92;
      ctx.fillStyle = SUBJECT_COLORS[subject];
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ---- highlight rings
    if (hl) {
      ctx.lineWidth = 1.6 / camera.k;
      for (const n of nodes) {
        if (!n.active || !hl.has(n.id)) continue;
        const kind = n.id === sel.id ? 'sel' : hl.kindOf(n.id);
        if (kind === 'far') continue;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * rScale + 2.4 / camera.k, 0, Math.PI * 2);
        ctx.strokeStyle = kind === 'sel' ? '#ffffff'
          : kind === 'near' ? 'rgba(255,255,255,0.85)'
            : 'rgba(255,255,255,0.28)';
        ctx.stroke();
      }
    }

    // ---- hovered emphasis
    const emph = state.hover && (!sel || state.hover.id !== sel.id) ? state.hover : null;
    if (emph) {
      ctx.beginPath();
      ctx.arc(emph.x, emph.y, emph.radius * rScale + 3 / camera.k, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.8 / camera.k;
      ctx.stroke();
    }

    // ---- labels
    const labelZoom = camera.k >= 1.05 || !!sel || !!emph;
    if (labelZoom) {
      ctx.font = `${12 / camera.k}px "Segoe UI", "PingFang SC", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const maxLabels = 140;
      let drawn = 0;
      for (const n of nodes) {
        if (!n.active) continue;
        if (hl && !hl.has(n.id)) continue;
        const isKey = sel ? n.id === sel.id : false;
        if (!isKey && drawn >= maxLabels) break;
        if (!isKey && n.degree < 6 && camera.k < 1.6) continue;
        if (!isKey && camera.k < 1.05 && n.degree < 10) continue;
        ctx.fillStyle = 'rgba(226,232,240,0.92)';
        ctx.fillText(n.name, n.x, n.y + n.radius * rScale + 3 / camera.k);
        drawn++;
      }
    }

    ctx.restore();
  }

  // Highlight set for a selection: selected + direct neighbours + all ancestors.
  function highlightSet(sel) {
    const near = new Set([sel.id]);
    for (const p of prereqOf.get(sel.id)) near.add(p.node.id);
    for (const u of unlocksOf.get(sel.id)) near.add(u.node.id);
    const set = new Set(near);
    for (const id of ancestorsOf(sel.id)) set.add(id);
    set.kindOf = (id) => (near.has(id) ? 'near' : 'far');
    return set;
  }

  /* ------------------------------------------------------- interaction --- */
  let pointer = null; // {mode: 'pan'|'drag', ...}

  function nodeAt(sx, sy) {
    const w = screenWorld(sx, sy);
    let best = null, bestD = Infinity;
    const hitR = 14 / camera.k;
    for (const n of nodes) {
      if (!n.active) continue;
      const dx = n.x - w.x, dy = n.y - w.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < Math.max(n.radius + 4 / camera.k, hitR) && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  canvas.addEventListener('pointerdown', (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    const n = nodeAt(ev.offsetX, ev.offsetY);
    if (n) {
      pointer = { mode: 'drag', node: n };
      n.fx = n.x; n.fy = n.y;
      alpha = Math.max(alpha, 0.4);
    } else {
      pointer = { mode: 'pan', sx: ev.offsetX, sy: ev.offsetY, cx: camera.x, cy: camera.y };
    }
  });

  canvas.addEventListener('pointermove', (ev) => {
    if (pointer) {
      if (pointer.mode === 'pan') {
        camera.x = pointer.cx + (ev.offsetX - pointer.sx);
        camera.y = pointer.cy + (ev.offsetY - pointer.sy);
      } else {
        const w = screenWorld(ev.offsetX, ev.offsetY);
        pointer.node.fx = w.x; pointer.node.fy = w.y;
        alpha = Math.max(alpha, 0.35);
      }
      return;
    }
    const n = nodeAt(ev.offsetX, ev.offsetY);
    state.hover = n;
    if (n) {
      tooltip.style.display = 'block';
      tooltip.innerHTML =
        `<b>${esc(n.name)}</b><br><span style="color:${SUBJECT_COLORS[n.subject]}">${esc(SUBJECT_ZH[n.subject] || n.subject)}</span>` +
        ` · ${esc(n.domain)} · ${TYPE_ZH[n.type] || n.type} · ${n.ageStart}–${n.ageEnd} 岁` +
        (prereqOf.get(n.id).length ? `<br>先修 ${prereqOf.get(n.id).length} · 解锁 ${unlocksOf.get(n.id).length}` : '');
      const pad = 14;
      let tx = ev.clientX + pad, ty = ev.clientY + pad;
      const rect = tooltip.getBoundingClientRect();
      if (tx + rect.width > window.innerWidth - 8) tx = ev.clientX - rect.width - pad;
      if (ty + rect.height > window.innerHeight - 8) ty = ev.clientY - rect.height - pad;
      tooltip.style.left = tx + 'px';
      tooltip.style.top = ty + 'px';
      canvas.style.cursor = 'pointer';
    } else {
      tooltip.style.display = 'none';
      canvas.style.cursor = 'grab';
    }
  });

  function endPointer() {
    if (pointer && pointer.mode === 'drag') {
      pointer.node.fx = null; pointer.node.fy = null;
      alpha = Math.max(alpha, 0.3);
    }
    pointer = null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener('click', (ev) => {
    const n = nodeAt(ev.offsetX, ev.offsetY);
    if (n) select(n, false);
    else select(null);
  });

  canvas.addEventListener('dblclick', (ev) => {
    const n = nodeAt(ev.offsetX, ev.offsetY);
    if (n) select(n, true);
  });

  canvas.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      const factor = Math.pow(1.0015, -ev.deltaY);
      const k2 = Math.max(0.08, Math.min(6, camera.k * factor));
      const wx = (ev.offsetX - W / 2 - camera.x) / camera.k;
      const wy = (ev.offsetY - H / 2 - camera.y) / camera.k;
      camera.x = ev.offsetX - W / 2 - wx * k2;
      camera.y = ev.offsetY - H / 2 - wy * k2;
      camera.k = k2;
      camAnim = null;
    },
    { passive: false }
  );

  /* ------------------------------------------------------- selection ---- */
  function select(node, focus) {
    state.selected = node;
    renderDetail(node);
    if (node && focus) focusOn(node);
    if (node) alpha = Math.max(alpha, 0.25);
  }

  let camAnim = null;
  function focusOn(n) {
    const k2 = Math.max(1.3, camera.k);
    camAnim = {
      t0: performance.now(), dur: 450,
      from: { x: camera.x, y: camera.y, k: camera.k },
      to: { x: -n.x * k2, y: -n.y * k2, k: k2 },
    };
  }

  /* ------------------------------------------------------ detail panel --- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  function chip(node, strength) {
    const dot = strength ? `<span class="dot ${strength}"></span>` : '';
    return `<button class="chip" data-id="${node.id}" title="${esc(node.subject)} · ${esc(node.domain)}">${dot}${esc(node.name)}</button>`;
  }

  function renderDetail(n) {
    if (!n) {
      detailPanel.classList.remove('open');
      detailPanel.innerHTML = '';
      return;
    }
    const color = SUBJECT_COLORS[n.subject] || '#94a3b8';
    const pres = prereqOf.get(n.id);
    const unl = unlocksOf.get(n.id);

    const stdRows = n.standards.map((key) => {
      const s = T.standards[key];
      if (!s) return '';
      const cur = T.curricula[s.curriculum];
      const curZh = CURRICULUM_ZH[s.curriculum];
      const curLabel = (curZh ? esc(curZh) + ' · ' : '') + esc(cur ? cur.name : s.curriculum);
      const body = s.textIncluded && s.title
        ? `<div class="std-title">${esc(s.title)}</div><div class="zh" data-src=".std-title"></div>` +
          (s.description ? `<div class="std-desc">${esc(s.description)}</div><div class="zh" data-src=".std-desc"></div>` : '')
        : `<div class="std-desc">（该来源仅提供标准代码）</div>`;
      return `<div class="std"><span class="std-code">${esc(s.code)}</span><span class="std-cur">${curLabel}</span>${body}</div>`;
    }).join('');

    const cluster =
      T.clusters.find((c) => c.subject === n.subject && c.domain === n.domain && c.ageStart === n.ageStart) ||
      T.clusters.filter((c) => c.subject === n.subject && c.domain === n.domain)
        .sort((a, b) => Math.abs(a.ageStart - n.ageStart) - Math.abs(b.ageStart - n.ageStart))[0];

    const assess = n.assessmentPrompt.replace(/\{\{name\}\}/g, '孩子');

    detailPanel.innerHTML = `
      <div class="d-head">
        <div>
          <div class="d-title">${esc(n.name)}</div>
          <div class="zh t-zh" data-src=".d-title"></div>
          <div class="d-chips">
            <span class="tag" style="--c:${color}">${esc(SUBJECT_ZH[n.subject] || n.subject)}<span class="en-inline">${esc(n.subject)}</span></span>
            <span class="tag ghost">${esc(DOMAIN_ZH[n.domain] || n.domain)}<span class="en-inline">${esc(n.domain)}</span></span>
            <span class="tag ghost">${esc(TYPE_ZH[n.type] || n.type)}<span class="en-inline">${esc(n.type)}</span></span>
            <span class="tag ghost">${n.ageStart}–${n.ageEnd} 岁</span>
          </div>
        </div>
        <button class="d-close" id="d-close" title="关闭">×</button>
      </div>
      <div class="d-body">
        <p class="d-desc">${esc(n.description)}</p>
        <div class="zh" data-src=".d-desc"></div>

        <h4>掌握证据</h4>
        <ul class="evi">${n.evidence.map((e) => `<li><span class="en">${esc(e)}</span><div class="zh" data-src=".en"></div></li>`).join('')}</ul>

        <h4>评估问题</h4>
        <p class="assess">“${esc(assess)}”</p>
        <div class="zh" data-src=".assess"></div>

        <h4>先修基础 <span class="count">${pres.length}</span></h4>
        <div class="chips">${pres.length ? pres.map((p) => chip(p.node, p.strength)).join('') : '<span class="muted">无 — 可直接入门</span>'}</div>

        <h4>可解锁 <span class="count">${unl.length}</span></h4>
        <div class="chips">${unl.length ? unl.map((u) => chip(u.node, u.strength)).join('') : '<span class="muted">暂无下游主题</span>'}</div>

        <h4>对齐标准 <span class="count">${n.standards.length}</span></h4>
        <div class="stds">${stdRows || '<span class="muted">无对齐标准</span>'}</div>

        ${cluster ? `<h4>学段总结</h4><p class="cluster">${esc(cluster.summary)}</p><div class="zh" data-src=".cluster"></div>` : ''}
      </div>`;
    detailPanel.classList.add('open');
    detailPanel.querySelector('#d-close').addEventListener('click', () => select(null));
    detailPanel.querySelectorAll('.chip').forEach((btn) =>
      btn.addEventListener('click', () => {
        const target = byId.get(btn.dataset.id);
        if (target) select(target, true);
      })
    );

    // ---- bilingual: fill the Chinese lines under each English block
    if (zhEnabled) {
      detailPanel.querySelectorAll('.zh[data-src]').forEach((el) => {
        const src = el.parentElement.querySelector(el.dataset.src);
        const text = src ? src.textContent.trim() : '';
        if (!text) return;
        el.classList.add('pending');
        t(text).then((zh) => {
          el.classList.remove('pending');
          if (zh) el.textContent = zh;
        });
      });
      // prerequisite / unlock chips: show Chinese name in the tooltip
      detailPanel.querySelectorAll('.chip[data-id]').forEach((btn) => {
        const target = byId.get(btn.dataset.id);
        if (!target) return;
        t(target.name).then((zh) => {
          if (zh) btn.title = zh + '\n' + btn.title;
        });
      });
    }
  }

  /* ---------------------------------------------------------- filters --- */
  function applyFilters() {
    for (const n of nodes) {
      n.active = state.subjects.has(n.subject) && state.types.has(n.type);
    }
    updateCounts();
    alpha = Math.max(alpha, 0.3);
  }

  function updateCounts() {
    const act = nodes.filter((n) => n.active).length;
    let ae = 0;
    for (const e of edges) if (e.s.active && e.t.active) ae++;
    statusCounts.textContent = `${act} 个结点 · ${ae} 条依赖边`;
  }

  function buildSidebar() {
    const subjBox = document.getElementById('subject-filters');
    subjBox.innerHTML =
      `<div class="f-head">
         <span>科目</span>
         <span class="f-acts">
           <a href="#" id="subj-all">全选</a><a href="#" id="subj-none">清空</a>
         </span>
       </div>` +
      T.subjects.map((s) => {
        const count = nodes.filter((n) => n.subject === s).length;
        return `<label class="f-item">
          <input type="checkbox" checked value="${esc(s)}">
          <span class="sw" style="background:${SUBJECT_COLORS[s]}"></span>
          <span class="f-name">${esc(SUBJECT_ZH[s] || s)}</span>
          <span class="f-count">${count}</span>
        </label>`;
      }).join('');
    subjBox.querySelectorAll('input').forEach((cb) =>
      cb.addEventListener('change', () => {
        cb.checked ? state.subjects.add(cb.value) : state.subjects.delete(cb.value);
        applyFilters();
      })
    );
    document.getElementById('subj-all').addEventListener('click', (e) => {
      e.preventDefault();
      state.subjects = new Set(T.subjects);
      subjBox.querySelectorAll('input').forEach((cb) => (cb.checked = true));
      applyFilters();
    });
    document.getElementById('subj-none').addEventListener('click', (e) => {
      e.preventDefault();
      state.subjects = new Set();
      subjBox.querySelectorAll('input').forEach((cb) => (cb.checked = false));
      applyFilters();
    });

    const typeBox = document.getElementById('type-filters');
    const typeCounts = {};
    for (const n of nodes) typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    typeBox.innerHTML = `<div class="f-head"><span>结点类型</span></div>` +
      Object.keys(TYPE_ZH).map((t) =>
        `<label class="f-item">
           <input type="checkbox" checked value="${t}">
           <span class="f-name">${TYPE_ZH[t]}</span>
           <span class="f-count">${typeCounts[t] || 0}</span>
         </label>`).join('');
    typeBox.querySelectorAll('input').forEach((cb) =>
      cb.addEventListener('change', () => {
        cb.checked ? state.types.add(cb.value) : state.types.delete(cb.value);
        applyFilters();
      })
    );
  }

  /* ----------------------------------------------------------- search --- */
  function runSearch(q) {
    q = q.trim().toLowerCase();
    if (!q) { searchResults.classList.remove('open'); searchResults.innerHTML = ''; return; }
    const hits = [];
    for (const n of nodes) {
      const hay = (n.name + ' ' + n.domain + ' ' + n.subject + ' ' + n.description).toLowerCase();
      if (hay.includes(q)) hits.push(n);
      if (hits.length >= 40) break;
    }
    hits.sort((a, b) => b.degree - a.degree);
    searchResults.innerHTML = hits.length
      ? hits.map((n) =>
          `<button class="sr" data-id="${n.id}">
             <span class="sw" style="background:${SUBJECT_COLORS[n.subject]}"></span>
             <span class="sr-name">${esc(n.name)}</span>
             <span class="sr-meta">${esc(SUBJECT_ZH[n.subject] || n.subject)} · ${n.ageStart}–${n.ageEnd}</span>
           </button>`).join('')
      : '<div class="sr-none">未找到匹配主题</div>';
    searchResults.classList.add('open');
    searchResults.querySelectorAll('.sr').forEach((btn) =>
      btn.addEventListener('click', () => {
        const n = byId.get(btn.dataset.id);
        if (n) { select(n, true); searchResults.classList.remove('open'); searchInput.value = ''; }
      })
    );
  }
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(searchInput.value), 120);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = searchResults.querySelector('.sr');
      if (first) first.click();
    } else if (e.key === 'Escape') {
      searchResults.classList.remove('open');
      searchInput.blur();
    }
  });
  document.addEventListener('click', (e) => {
    if (!searchResults.contains(e.target) && e.target !== searchInput) {
      searchResults.classList.remove('open');
    }
  });

  /* --------------------------------------------------------- toolbar ---- */
  document.getElementById('btn-reset').addEventListener('click', () => {
    camAnim = { t0: performance.now(), dur: 400, from: { ...camera }, to: { x: 0, y: 0, k: 0.55 } };
  });
  const btnPhysics = document.getElementById('btn-physics');
  btnPhysics.addEventListener('click', () => {
    state.physics = !state.physics;
    btnPhysics.classList.toggle('off', !state.physics);
    btnPhysics.textContent = state.physics ? '力导引：开' : '力导引：关';
    if (state.physics) alpha = 0.4;
  });
  const btnAge = document.getElementById('btn-age');
  btnAge.addEventListener('click', () => {
    state.ageLayers = !state.ageLayers;
    btnAge.classList.toggle('on', state.ageLayers);
    btnAge.textContent = state.ageLayers ? '年龄分层：开' : '年龄分层：关';
    alpha = 0.5;
  });
  document.getElementById('btn-soft').addEventListener('click', (e) => {
    state.showSoft = !state.showSoft;
    e.currentTarget.classList.toggle('off', !state.showSoft);
    e.currentTarget.textContent = state.showSoft ? '软依赖：显示' : '软依赖：隐藏';
  });

  const btnZh = document.getElementById('btn-zh');
  function syncZhBtn() {
    btnZh.classList.toggle('off', !zhEnabled);
    btnZh.classList.toggle('on', zhEnabled);
    btnZh.textContent = zhEnabled ? '中文翻译：开' : '中文翻译：关';
  }
  btnZh.addEventListener('click', () => {
    zhEnabled = !zhEnabled;
    try { localStorage.setItem('mst-zh-on', zhEnabled ? '1' : '0'); } catch {}
    syncZhBtn();
    if (state.selected) renderDetail(state.selected);
  });
  syncZhBtn();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') select(null);
  });

  /* ------------------------------------------------------------- boot --- */
  function seedPositions() {
    const R = 12 * Math.sqrt(nodes.length);
    for (const n of nodes) {
      const a = Math.random() * Math.PI * 2;
      const r = R * Math.sqrt(Math.random());
      n.x = Math.cos(a) * r;
      n.y = Math.sin(a) * r;
    }
  }

  function frame(t) {
    if (camAnim) {
      const p = Math.min(1, (t - camAnim.t0) / camAnim.dur);
      const e = 1 - Math.pow(1 - p, 3);
      camera.x = camAnim.from.x + (camAnim.to.x - camAnim.from.x) * e;
      camera.y = camAnim.from.y + (camAnim.to.y - camAnim.from.y) * e;
      camera.k = camAnim.from.k + (camAnim.to.k - camAnim.from.k) * e;
      if (p >= 1) camAnim = null;
    }
    tick();
    render();
    requestAnimationFrame(frame);
  }

  seedPositions();
  buildSidebar();
  applyFilters();
  resize();
  document.getElementById('stat-meta').textContent =
    `${T.meta.counts.topics} 主题 · ${T.meta.counts.dependencies} 先修边 · ${T.meta.counts.curriculumStandards} 标准 · ${T.meta.counts.clusters} 学段总结 · v${T.meta.version}`;
  requestAnimationFrame(frame);
})();
