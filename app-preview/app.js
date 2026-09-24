/* OutLoud Platform MVP — app.js (v1)
   Static, no build step. Supabase auth + BlueColumn namespaces as the database.
   Routes: #/login #/signup #/onboarding #/dashboard #/leads #/type #/success */

(function () {
  'use strict';

  /* ---------- Constants ---------- */
  var SUPABASE_URL = 'https://jfeoiwmqmbqejjloxvcs.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZW9pd21xbWJxZWpqbG94dmNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4Mjg1ODUsImV4cCI6MjA3OTQwNDU4NX0._BDHGcqERxNaS2EZNlHAM7mgV0wM_DjTM3COBPq1aqk';
  var BC_BASE = 'https://api.bluecolumn.ai';
  var REGISTRY_NS = 'ol_registry';
  var PUBLIC_BASE = 'https://bluecolumn.ai/a/';
  var LS_LAST = 'ol_last_config_';
  var LS_SESSION_CACHE = 'ol_session_cache';

  // Plan flags — stored as labels only, no billing in this build.
  var PLANS = {
    starter: { name: 'Starter', price: '$49' },
    pro: { name: 'Pro', price: '$149' },
    team: { name: 'Team', price: '$349' },
    personal: { name: 'Personal', price: '$19' }
  };

  // Stock ElevenLabs premade voices (no audio preview this build).
  var VOICES = [
    { id: 'iLVmqjzCGGvqtMCk6vVQ', name: 'Antonio', sub: 'The OutLoud signature voice — warm and confident, male' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', sub: 'Calm and friendly, female' },
    { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', sub: 'Young and easygoing, male' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', sub: 'Bright and expressive, female' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', sub: 'Well-rounded and relaxed, male' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', sub: 'Deep and steady, male' },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', sub: 'Strong and assertive, male' }
  ];

  // Stock Simli video faces (verified against Simli's published default-face list;
  // the first two are also used live in this repo: Sabour in outloud-v3, Madison in OttoMedic).
  // The animated mascot uses outloud/mascot-sprites.png (copied into this folder).
  var FACES = [
    { kind: 'mascot', faceId: '', name: 'OutLoud mascot', sub: 'Animated character, included with every plan', img: 'mascot-sprites.png?v=1' },
    { kind: 'simli', faceId: '5fc23ea5-8175-4a82-aaaf-cdd8c88543dc', name: 'Professional A', sub: 'Video face — polished and approachable', img: 'https://mintcdn.com/simli/NELbEX-teJCHwcnx/images/madison.png?fit=max&auto=format&n=NELbEX-teJCHwcnx&q=85&s=8f3119eddb776e0afec44ecf8da6c3d9' },
    { kind: 'simli', faceId: '804c347a-26c9-4dcf-bb49-13df4bed61e8', name: 'Professional B', sub: 'Video face — calm and steady', img: 'https://mintcdn.com/simli/NELbEX-teJCHwcnx/images/black_programmer.png?fit=max&auto=format&n=NELbEX-teJCHwcnx&q=85&s=94213f32e0d39464bbf4d645430c29d8' },
    { kind: 'simli', faceId: 'cace3ef7-a4c4-425d-a8cf-a5358eb0c427', name: 'Friendly A', sub: 'Video face — warm and welcoming', img: 'https://mintcdn.com/simli/NELbEX-teJCHwcnx/images/asian_woman.png?fit=max&auto=format&n=NELbEX-teJCHwcnx&q=85&s=e02235fa52f1327b4cfb060ab364ec63' },
    { kind: 'simli', faceId: '1c6aa65c-d858-4721-a4d9-bda9fde03141', name: 'Friendly B', sub: 'Video face — open and easygoing', img: 'https://mintcdn.com/simli/NELbEX-teJCHwcnx/images/black_man.png?fit=max&auto=format&n=NELbEX-teJCHwcnx&q=85&s=353c99d375639a3513d5b4f14560e467' },
    { kind: 'simli', faceId: 'dd10cb5a-d31d-4f12-b69f-6db3383c006e', name: 'Casual A', sub: 'Video face — laid-back and familiar', img: 'https://mintcdn.com/simli/NELbEX-teJCHwcnx/images/hank.png?fit=max&auto=format&n=NELbEX-teJCHwcnx&q=85&s=5864d0148bb709abead34a191313c155' }
  ];

  var CSV_COLUMNS = [
    { key: 'name', label: 'Item or service name', help: 'What customers call it — “Driveway sealing”, “Haircut”, “Oil change”.' },
    { key: 'description', label: 'Description', help: 'One or two lines describing it the way you would say it out loud.' },
    { key: 'price', label: 'Price', help: 'This is what customers hear when they ask what something costs.' },
    { key: 'category', label: 'Category', help: 'Optional grouping, like “Repairs” or “Packages”.' },
    { key: 'serviceArea', label: 'Service area', help: 'Where you offer it — a town, a radius, or “everywhere”.' },
    { key: 'notes', label: 'Notes', help: 'Anything else worth mentioning — timing, fine print, seasonal details.' }
  ];

  /* ---------- State ---------- */
  var sb = null;
  var session = null;
  var keysLoaded = false;
  var acct = null;          // { slug, account_type, plan, config (parsed acct-config), stale }
  var wizard = null;        // onboarding wizard state
  var pendingTypeChoice = null;

  /* ---------- Tiny DOM helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(id) { return document.getElementById(id); }
  function setView(html, cls) {
    var v = el('view');
    v.className = cls || 'shell';
    v.innerHTML = html;
    window.scrollTo(0, 0);
  }
  function toast(msg) {
    var n = document.createElement('div');
    n.textContent = msg;
    n.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#172d32;color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;z-index:99;box-shadow:0 8px 24px rgba(0,0,0,.25)';
    document.body.appendChild(n);
    setTimeout(function () { n.remove(); }, 2200);
  }

  /* ---------- Keys (interim — loaded only after auth) ---------- */
  function loadKeys() {
    if (keysLoaded || !window.OL_KEYS) return false;
    keysLoaded = true;
    return true;
  }
  function injectKeys() {
    return new Promise(function (resolve) {
      if (window.OL_KEYS) { keysLoaded = true; return resolve(true); }
      var s = document.createElement('script');
      s.src = 'keys.js?v=1';
      s.onload = function () { keysLoaded = true; resolve(true); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  /* ---------- BlueColumn helpers ---------- */
  function bcRemember(namespace, text, metaType, title) {
    // Schema verified 2026-09-24: POST /agent-remember { text, namespace, metadata:{type,title} }
    // The `content` field is also accepted as an alias for `text`.
    var body = { text: String(text || ''), namespace: namespace, metadata: { type: metaType } };
    if (title) body.metadata.title = title;
    return fetch(BC_BASE + '/agent-remember', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + window.OL_KEYS.blueColumnKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('BlueColumn remember failed: ' + r.status + ' ' + t.slice(0, 200)); });
      return r.json();
    });
  }

  function bcRecall(namespace, query, topK) {
    // Schema verified 2026-09-24: POST /agent-recall { namespace, q, top_k }
    // `q` and `query` are both accepted; top_k max is 20.
    var body = { namespace: namespace, q: String(query || ''), top_k: Math.min(topK || 10, 20) };
    return fetch(BC_BASE + '/agent-recall', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + window.OL_KEYS.blueColumnKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('BlueColumn recall failed: ' + r.status + ' ' + t.slice(0, 200)); });
      return r.json();
    });
  }

  // Fetch docs of a given metadata type from an account namespace.
  // Tolerates both {answer,sources} recall shape and a raw array.
  function bcGetDocs(namespace, query, type) {
    return bcRecall(namespace, query, 20).then(function (data) {
      var sources = (data && data.sources) || (Array.isArray(data) ? data : []) || [];
      // Prefer exact type matches; fall back to parsing every source.
      var typed = [], loose = [];
      sources.forEach(function (s) {
        var parsed = tryParseJson(s.excerpt || '');
        if (!parsed) return;
        if (s.doc_type === 'text' || s.session_id || s.doc_id) {
          if (type && (s.title || '').toLowerCase().indexOf(type) !== -1) typed.push(parsed);
          loose.push(parsed);
        }
      });
      return { typed: typed, loose: loose, all: typed.length ? typed : loose };
    });
  }

  function tryParseJson(s) {
    if (!s) return null;
    var t = String(s).trim();
    // excerpt may be truncated; attempt progressive trim to last balanced brace
    if (t[0] === '{' || t[0] === '[') {
      var candidates = [t];
      var lastBrace = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
      if (lastBrace > 0 && lastBrace < t.length - 1) candidates.push(t.slice(0, lastBrace + 1));
      for (var i = 0; i < candidates.length; i++) {
        try { return JSON.parse(candidates[i]); } catch (e) { /* next */ }
      }
      // still unparsed → tail-repair pass (handles truncated JSON excerpts)
      var inStr = false, esc = false, ob = 0, ab = 0;
      for (var m = 0; m < t.length; m++) {
        var c = t[m];
        if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
        if (c === '"') inStr = true;
        else if (c === '{') ob++;
        else if (c === '[') ab++;
        else if (c === '}') ob = Math.max(0, ob - 1);
        else if (c === ']') ab = Math.max(0, ab - 1);
      }
      var fixed = t;
      if (inStr) fixed += '"';
      // strip a dangling partial key or trailing comma left by truncation
      fixed = fixed.replace(/,\s*"[^"]*"?\s*:?\s*$/, '');
      fixed = fixed.replace(/,\s*$/, '');
      // an unclosed object inside an array needs its '}' BEFORE the array's ']'
      if (ab > 0 && ob > 0) {
        fixed += '}';
        ob--;
      }
      for (var q = 0; q < ab; q++) fixed += ']';
      for (var r = 0; r < ob; r++) fixed += '}';
      try { return JSON.parse(fixed); } catch (e) { return null; }
    }
    return null;
  }

  /* ---------- Registry (ol_namespace = ol_registry) ---------- */
  function readRegistry() {
    return bcRecall(REGISTRY_NS, 'account registry entries with user_id slug business_name', 20).then(function (data) {
      var sources = (data && data.sources) || [];
      for (var i = 0; i < sources.length; i++) {
        var parsed = tryParseJson(sources[i].excerpt || '');
        if (Array.isArray(parsed) && parsed.length && parsed[0].user_id !== undefined) return parsed;
        if (parsed && parsed.accounts && Array.isArray(parsed.accounts)) return parsed.accounts;
      }
      // Fallback: scan all sources for an array-looking doc
      for (var j = 0; j < sources.length; j++) {
        var p2 = tryParseJson(sources[j].excerpt || '');
        if (Array.isArray(p2)) return p2;
      }
      return null; // no registry yet
    });
  }

  function writeRegistry(accounts) {
    return bcRemember(REGISTRY_NS,
      JSON.stringify(accounts),
      'acct-registry',
      'OutLoud Account Registry');
  }

  /* ---------- Slug helpers ---------- */
  function slugify(name) {
    return String(name || '').toLowerCase().replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'my-outloud';
  }
  function baseSlug(slug) {
    var m = slug.match(/^(.*?)-\d+$/);
    return m ? m[1] : slug;
  }

  /* ---------- Auth ---------- */
  function initSupabase() {
    if (!window.supabase || !window.supabase.createClient) throw new Error('supabase-js failed to load');
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
  }

  function cachedSession() {
    try {
      var raw = localStorage.getItem(LS_SESSION_CACHE);
      if (!raw) return null;
      var c = JSON.parse(raw);
      // only trust a cache that is at most 14 days old and has user metadata
      if (c && c.email && c.ts && (Date.now() - c.ts < 14 * 864e5)) return c;
    } catch (e) { /* ignore */ }
    return null;
  }

  function cacheSession(sess) {
    try {
      if (sess && sess.user) {
        localStorage.setItem(LS_SESSION_CACHE, JSON.stringify({
          email: sess.user.email, user_id: sess.user.id, ts: Date.now()
        }));
      } else {
        localStorage.removeItem(LS_SESSION_CACHE);
      }
    } catch (e) { /* ignore */ }
  }

  function requireKeys() {
    if (loadKeys()) return Promise.resolve(true);
    return injectKeys();
  }

  /* ---------- CSV parser (hand-rolled, handles quoted fields) ---------- */
  // Test case: 'a,"b,c",d' → ['a','b,c','d'];  '"say ""hi""",x' → ['say "hi"', 'x']
  function parseCSV(text) {
    var rows = [], row = [], field = '', inQ = false, i = 0;
    var t = String(text || '').replace(/\r\n?/g, '\n');
    while (i < t.length) {
      var c = t[i];
      if (inQ) {
        if (c === '"') {
          if (t[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    // drop fully-empty rows (e.g. blank lines / trailing newline)
    return rows.filter(function (r) { return r.some(function (f) { return String(f).trim() !== ''; }); });
  }

  function autoMap(headers) {
    var map = {};
    var patterns = {
      name: /name|item|service|product|title/i,
      description: /desc|about|detail|blurb/i,
      price: /price|cost|rate|\$/i,
      category: /categ|group|type|section/i,
      serviceArea: /area|region|zone|location|serv.*area|where/i,
      notes: /note|comment|extra|fine/i
    };
    var used = {};
    headers.forEach(function (h, idx) {
      for (var key in patterns) {
        if (!used[key] && patterns[key].test(h || '')) { map[key] = idx; used[key] = true; return; }
      }
    });
    return map;
  }

  /* ---------- Account session bootstrap ---------- */
  function findAccountForUser(userId) {
    return requireKeys().then(function (ok) {
      if (!ok) return null;
      return readRegistry().then(function (reg) {
        if (!reg) return null;
        return reg.filter(function (a) { return a.user_id === userId; })[0] || null;
      });
    });
  }

  function loadAccountConfig(slug, userId) {
    var ns = 'ol_acct_' + slug;
    return bcRecall(ns, 'account configuration for this business', 10).then(function (data) {
      var sources = (data && data.sources) || [];
      for (var i = 0; i < sources.length; i++) {
        var parsed = tryParseJson(sources[i].excerpt || '');
        if (parsed && parsed.version === 1 && parsed.slug && parsed.business) {
          try { localStorage.setItem(LS_LAST + slug, JSON.stringify({ config: parsed, ts: Date.now() })); } catch (e) { /* ignore */ }
          return { config: parsed, stale: false };
        }
      }
      // nothing recalled — fall back to lastKnown localStorage copy
      try {
        var raw = localStorage.getItem(LS_LAST + slug);
        if (raw) { var c = JSON.parse(raw); if (c && c.config) return { config: c.config, stale: true }; }
      } catch (e) { /* ignore */ }
      return null;
    });
  }

  function loadCatalogCount(slug) {
    return bcRecall('ol_acct_' + slug, 'catalog of products and services', 5).then(function (data) {
      var sources = (data && data.sources) || [];
      for (var i = 0; i < sources.length; i++) {
        var parsed = tryParseJson(sources[i].excerpt || '');
        if (parsed && parsed.items && Array.isArray(parsed.items)) return parsed.items.length;
      }
      return 0;
    }).catch(function () { return 0; });
  }

  function saveAccountConfig(config) {
    config.updated_at = new Date().toISOString();
    var p = bcRemember('ol_acct_' + config.slug, JSON.stringify(config), 'acct-config',
      (config.business && config.business.name ? config.business.name : config.slug) + ' Configuration');
    try { localStorage.setItem(LS_LAST + config.slug, JSON.stringify({ config: config, ts: Date.now() })); } catch (e) { /* ignore */ }
    return p;
  }

  /* ---------- Router ---------- */
  function route() {
    var h = location.hash || '#/login';
    if (h.indexOf('#/signup') === 0) return renderSignup();
    if (h.indexOf('#/login') === 0) return renderLogin();
    if (h.indexOf('#/type') === 0) return renderTypeChoice();
    if (h.indexOf('#/onboarding') === 0) return renderOnboarding();
    if (h.indexOf('#/dashboard') === 0) return renderDashboard();
    if (h.indexOf('#/leads') === 0) return renderLeads();
    if (h.indexOf('#/success') === 0) return renderSuccess();
    // default: authed → dashboard, else login
    if (session) { location.hash = '#/dashboard'; return; }
    location.hash = '#/login';
  }

  function gate(needKeys, fn) {
    // Session check happens before any privileged data or keys load.
    if (!session) { location.hash = '#/login'; return; }
    var pre = needKeys ? requireKeys() : Promise.resolve(false);
    pre.then(function () { fn(); })
      .catch(function (err) { renderError(err); });
  }

  function renderError(err) {
    console.error(err);
    setView(
      '<div class="card auth-card center"><h1 class="page-title">Something went sideways</h1>' +
      '<p class="page-sub">' + esc((err && err.message) || 'Unexpected error') + '</p>' +
      '<div class="btn-row" style="justify-content:center"><button class="btn" onclick="location.reload()">Try again</button>' +
      '<button class="btn ghost" onclick="location.hash=\'#/login\'">Back to sign in</button></div></div>'
    );
  }

  function headerFor(title, sub) {
    return '<h1 class="page-title">' + esc(title) + '</h1>' + (sub ? '<p class="page-sub">' + esc(sub) + '</p>' : '');
  }

  /* ---------- Auth screens ---------- */
  function renderLogin(err) {
    setView(
      '<div class="card auth-card">' +
      '<h1 class="page-title">Welcome back</h1>' +
      '<p class="page-sub">Sign in to manage your OutLoud.</p>' +
      '<div class="auth-tabs"><a href="#/login" class="active" aria-current="page">Sign in</a><a href="#/signup">Create account</a></div>' +
      (err ? '<div class="notice err">' + esc(err) + '</div>' : '') +
      '<form id="f-login">' +
      '<label class="field"><span class="lab">Email</span><input type="email" name="email" required autocomplete="email" placeholder="you@yourbusiness.com"></label>' +
      '<label class="field"><span class="lab">Password</span><input type="password" name="password" required autocomplete="current-password" placeholder="Your password"></label>' +
      '<button class="btn" type="submit" style="width:100%">Sign in</button>' +
      '</form>' +
      '<p class="mini-note">New here? <a href="#/signup">Create an account</a> — it takes a few minutes.</p>' +
      '</div>'
    );
    $('#f-login').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      doLogin(fd.get('email'), fd.get('password'));
    });
  }

  function renderSignup(err) {
    setView(
      '<div class="card auth-card">' +
      '<h1 class="page-title">Create your OutLoud</h1>' +
      '<p class="page-sub">An email and a password gets you started.</p>' +
      '<div class="auth-tabs"><a href="#/login">Sign in</a><a href="#/signup" class="active" aria-current="page">Create account</a></div>' +
      (err ? '<div class="notice err">' + esc(err) + '</div>' : '') +
      '<form id="f-signup">' +
      '<label class="field"><span class="lab">Email</span><input type="email" name="email" required autocomplete="email" placeholder="you@yourbusiness.com"></label>' +
      '<label class="field"><span class="lab">Password</span><span class="help">At least 8 characters.</span><input type="password" name="password" required minlength="8" autocomplete="new-password" placeholder="Pick a password"></label>' +
      '<button class="btn" type="submit" style="width:100%">Create account</button>' +
      '</form>' +
      '<p class="mini-note">Already have one? <a href="#/login">Sign in</a>.</p>' +
      '</div>'
    );
    $('#f-signup').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      doSignup(fd.get('email'), fd.get('password'));
    });
  }

  function doSignup(email, password) {
    var btn = $('#f-signup button[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
    sb.auth.signUp({ email: email, password: password }).then(function (res) {
      if (res.error) throw res.error;
      session = res.data.session || null;
      cacheSession(session);
      if (session) {
        // Email confirmation off → straight to business-name step.
        renderAskBusiness();
      } else {
        renderSignup('Account created. Check your email to confirm, then sign in.');
      }
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Create account'; }
      renderSignup(err.message || 'Could not create the account.');
    });
  }

  function doLogin(email, password) {
    var btn = $('#f-login button[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }
    sb.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) throw res.error;
      session = res.data.session;
      cacheSession(session);
      return afterAuth();
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Sign in'; }
      renderLogin(err.message || 'Could not sign in.');
    });
  }

  function afterAuth() {
    // Session exists → now (and only now) load keys.js.
    return requireKeys().then(function () {
      return findAccountForUser(session.user.id);
    }).then(function (found) {
      if (found) {
        acct = found;
        location.hash = '#/dashboard';
      } else {
        renderAskBusiness();
      }
    }).catch(function (err) { renderError(err); });
  }

  /* ---------- Post-signup: business name → slug → type choice ---------- */
  function renderAskBusiness(prefillErr) {
    setView(
      '<div class="card auth-card">' +
      '<h1 class="page-title">What is your business called?</h1>' +
      '<p class="page-sub">This becomes the public name of your OutLoud, and a short web address for your page.</p>' +
      (prefillErr ? '<div class="notice err">' + esc(prefillErr) + '</div>' : '') +
      '<form id="f-biz">' +
      '<label class="field"><span class="lab">Business name</span><input type="text" name="biz" required placeholder="Arcadia Fence Co." maxlength="80"></label>' +
      '<label class="field"><span class="lab">Plan</span><span class="help">Just a flag for now — you will not be billed in this preview.</span>' +
      '<select name="plan">' +
      '<option value="starter">Starter — $49/mo</option>' +
      '<option value="pro">Pro — $149/mo</option>' +
      '<option value="team">Team — $349/mo</option>' +
      '<option value="personal">Personal — $19/mo</option>' +
      '</select></label>' +
      '<button class="btn" type="submit" style="width:100%">Continue</button>' +
      '</form></div>'
    );
    $('#f-biz').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var name = String(fd.get('biz') || '').trim();
      var plan = String(fd.get('plan') || 'starter');
      if (!name) return;
      reserveSlug(name, plan);
    });
  }

  function reserveSlug(name, plan) {
    var desired = slugify(name);
    requireKeys().then(function () {
      return readRegistry();
    }).then(function (reg) {
      reg = reg || [];
      var taken = {};
      reg.forEach(function (a) { taken[a.slug] = true; });
      var slug = desired, n = 2;
      while (taken[slug]) { slug = baseSlug(desired) + '-' + n; n++; }
      pendingTypeChoice = {
        business_name: name,
        slug: slug,
        plan: plan,
        user_id: session.user.id,
        email: session.user.email,
        registry: reg
      };
      location.hash = '#/type';
    }).catch(function (err) { renderError(err); });
  }

  function renderTypeChoice(err) {
    if (!pendingTypeChoice) { location.hash = '#/dashboard'; return; }
    var p = pendingTypeChoice;
    setView(
      '<div class="card auth-card" style="max-width:640px">' +
      '<h1 class="page-title">Who is this OutLoud for?</h1>' +
      '<p class="page-sub">Pick one now — you can change the words later.</p>' +
      (err ? '<div class="notice err">' + esc(err) + '</div>' : '') +
      '<div class="choice-grid">' +
      '<button type="button" class="choice-card" id="pick-business">' +
      '<span class="c-title">Business</span>' +
      '<span class="c-sub">A talking front desk for your company — it knows your services, prices, and hours.</span>' +
      '</button>' +
      '<button type="button" class="choice-card" id="pick-personal">' +
      '<span class="c-title">Personal</span>' +
      '<span class="c-sub">A talking page about you — for portfolios, schedules, or as a gift.</span>' +
      '</button>' +
      '</div>' +
      '<p class="mini-note">Your web address will be <strong>' + esc(PUBLIC_BASE + p.slug + '/') + '</strong></p>' +
      '</div>'
    );
    function pick(type) {
      createAccount(type).catch(function (err) {
        renderTypeChoice(err.message || 'Could not create the account.');
      });
    }
    el('pick-business').addEventListener('click', function () { pick('business'); });
    el('pick-personal').addEventListener('click', function () { pick('personal'); });
  }

  function createAccount(accountType) {
    var p = pendingTypeChoice;
    var now = new Date().toISOString();
    var entry = {
      user_id: p.user_id,
      slug: p.slug,
      business_name: p.business_name,
      account_type: accountType,
      plan: p.plan,
      status: 'draft',
      created_at: now
    };
    var config = {
      version: 1,
      slug: p.slug,
      user_id: p.user_id,
      account_type: accountType,
      plan: p.plan,
      business: {
        name: p.business_name,
        whatYouDo: '',
        serviceArea: '',
        hours: '',
        pricingStyle: '',
        commonQuestions: ''
      },
      avatar: { kind: 'mascot', faceId: '', name: 'OutLoud mascot' },
      voice: { voiceId: 'iLVmqjzCGGvqtMCk6vVQ', name: 'Antonio' },
      publicUrl: PUBLIC_BASE + p.slug + '/',
      status: 'draft',
      created_at: now,
      updated_at: now
    };
    var registry = (p.registry || []).slice();
    registry.push(entry);
    return writeRegistry(registry).then(function () {
      return saveAccountConfig(config);
    }).then(function () {
      acct = entry;
      acct.config = config;
      pendingTypeChoice = null;
      startWizard(config, true);
      location.hash = '#/onboarding';
    });
  }

  /* ---------- Onboarding wizard ---------- */
  function startWizard(config, fresh) {
    wizard = {
      step: 1,
      config: JSON.parse(JSON.stringify(config || acct.config || defaultConfig())),
      fresh: !!fresh,
      catalog: null,        // parsed items before save
      csvMap: null,
      csvHeaders: []
    };
    if (!fresh) wizard.step = 1;
  }

  function defaultConfig() {
    return {
      version: 1, slug: acct.slug, user_id: session.user.id, account_type: acct.account_type || 'business',
      plan: acct.plan || 'starter',
      business: { name: acct.business_name || 'My OutLoud', whatYouDo: '', serviceArea: '', hours: '', pricingStyle: '', commonQuestions: '' },
      avatar: { kind: 'mascot', faceId: '', name: 'OutLoud mascot' },
      voice: { voiceId: 'iLVmqjzCGGvqtMCk6vVQ', name: 'Antonio' },
      publicUrl: PUBLIC_BASE + acct.slug + '/',
      status: 'draft', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
  }

  function renderOnboarding(stepArg) {
    gate(true, function () {
      if (!wizard) {
        var base = (acct && acct.config) ? acct.config : null;
        startWizard(base, false);
        if (stepArg) wizard.step = stepArg;
      }
      if (stepArg) wizard.step = stepArg;
      var steps = ['Tell us about your business', 'Load your products & services', 'Pick your avatar & voice', 'Review & go live'];
      var s = wizard.step;
      var personal = wizard.config.account_type === 'personal';
      var stepTitle = steps[s - 1];
      if (personal && s === 1) stepTitle = 'Tell us about you';

      var html =
        '<div class="progress-wrap">' +
        '<div class="progress-label"><span class="step-count">Step ' + s + ' of 4</span><span class="step-name">' + esc(stepTitle) + '</span></div>' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + (s * 25) + '%"></div></div>' +
        '</div><div id="step-body"></div>';

      setView(html);
      if (s === 1) renderStep1();
      else if (s === 2) renderStep2();
      else if (s === 3) renderStep3();
      else renderStep4();
    });
  }

  function wizardNav(backLabel, nextLabel, backFn, nextFn) {
    return '<div class="btn-row"><button class="btn ghost" id="w-back">' + esc(backLabel || 'Back') + '</button>' +
      '<span class="spacer"></span>' +
      '<button class="btn" id="w-next">' + esc(nextLabel || 'Next') + '</button></div>';
  }

  /* ----- Step 1: business info ----- */
  function renderStep1() {
    var b = wizard.config.business || {};
    var personal = wizard.config.account_type === 'personal';
    var you = personal ? 'you' : 'your business';
    var body = el('step-body');
    body.innerHTML =
      '<div class="card">' +
      '<form id="f-step1">' +
      '<label class="field"><span class="lab">Name</span><span class="help">What customers see. This is the name of ' + esc(you) + '.</span>' +
      '<input type="text" name="name" required maxlength="80" value="' + esc(b.name || '') + '"></label>' +
      '<label class="field"><span class="lab">' + (personal ? 'What you do' : 'What your business does') + '</span>' +
      '<span class="help">One or two sentences, the way you would tell a neighbor. This is what your OutLoud says when people ask what you offer.</span>' +
      '<textarea name="whatYouDo" placeholder="' + (personal ? 'I design small websites and teach weekend pottery classes.' : 'We install and repair fences across the valley, family-run since 2009.') + '">' + esc(b.whatYouDo || '') + '</textarea></label>' +
      '<div class="grid2">' +
      '<label class="field"><span class="lab">' + (personal ? 'Where you are' : 'Service area') + '</span>' +
      '<span class="help">Towns, neighborhoods, or “online everywhere”.</span>' +
      '<input type="text" name="serviceArea" value="' + esc(b.serviceArea || '') + '" placeholder="Phoenix, Glendale, Peoria"></label>' +
      '<label class="field"><span class="lab">' + (personal ? 'When people can reach you' : 'Hours') + '</span>' +
      '<span class="help">When you are open, or when you answer.</span>' +
      '<input type="text" name="hours" value="' + esc(b.hours || '') + '" placeholder="Mon–Sat 8am–6pm"></label>' +
      '</div>' +
      '<label class="field"><span class="lab">How pricing works</span>' +
      '<span class="help">For example “flat rate per job”, “hourly”, or “quotes by email”. Your OutLoud uses this when people ask what things cost.</span>' +
      '<input type="text" name="pricingStyle" value="' + esc(b.pricingStyle || '') + '" placeholder="Free quotes, flat rate per job"></label>' +
      '<label class="field"><span class="lab">Questions customers ask a lot</span>' +
      '<span class="help">One per line. Your OutLoud will learn these answers from everything you fill in.</span>' +
      '<textarea name="commonQuestions" placeholder="' + (personal ? 'How far do you travel?\nWhat is your schedule like?' : 'Do you offer free estimates?\nHow long does installation take?\nWhat areas do you serve?') + '">' + esc(b.commonQuestions || '') + '</textarea></label>' +
      '<div class="btn-row"><button type="button" class="btn ghost" id="w-back">Back</button><span class="spacer"></span>' +
      '<button type="submit" class="btn">Save & continue</button></div>' +
      '</form></div>';

    $('#f-step1').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var oldSlugOk = wizard.config.slug;
      wizard.config.business = {
        name: String(fd.get('name') || '').trim(),
        whatYouDo: String(fd.get('whatYouDo') || '').trim(),
        serviceArea: String(fd.get('serviceArea') || '').trim(),
        hours: String(fd.get('hours') || '').trim(),
        pricingStyle: String(fd.get('pricingStyle') || '').trim(),
        commonQuestions: String(fd.get('commonQuestions') || '').trim()
      };
      saveAccountConfig(wizard.config).then(function () {
        wizard.step = 2;
        location.hash = '#/onboarding';
        renderOnboarding(2);
      }).catch(function (err) { renderError(err); });
    });
    $('#w-back').addEventListener('click', function () {
      if (wizard.fresh) location.hash = '#/dashboard';
      else { location.hash = '#/dashboard'; }
    });
  }

  /* ----- Step 2: catalog / bulk upload ----- */
  function renderStep2() {
    var body = el('step-body');
    body.innerHTML =
      '<div class="card">' +
      '<p class="page-sub" style="margin-bottom:14px">Add everything you sell or do. Easiest way: download the template, fill it in, drop it here. Everything stays editable.</p>' +
      '<div class="btn-row" style="margin-top:0"><button class="btn ghost" id="dl-template" type="button">Download template (CSV)</button>' +
      '<button class="btn subtle" id="toggle-manual" type="button">Just add items by hand</button></div>' +
      '<div id="upload-area" style="margin-top:16px">' +
      '<div class="drop-zone" id="drop-zone" role="button" tabindex="0" aria-label="Choose or drop a CSV file">' +
      '<span class="dz-icon" aria-hidden="true">⇪</span>' +
      '<strong>Drop your CSV here</strong><br>or click to pick a file<br>' +
      '<span class="help" style="margin-top:6px">Works with the template or any spreadsheet saved as CSV.</span>' +
      '</div>' +
      '<input type="file" id="csv-file" accept=".csv,text/csv" hidden>' +
      '</div>' +
      '<div id="manual-area" hidden style="margin-top:16px"></div>' +
      '<div id="preview-area"></div>' +
      '</div>';

    // Template download
    el('dl-template').addEventListener('click', function () {
      var header = CSV_COLUMNS.map(function (c) { return c.label; });
      var sample = [
        ['Driveway sealing', 'Full seal and coat, includes crack fill', '$249', 'Driveway', 'Maricopa County', 'Best in spring or fall'],
        ['Weekly lawn care', 'Mow, trim, and blow-off every week', '$45 per visit', 'Lawn', 'Phoenix, Glendale', 'Cancel anytime']
      ];
      var csv = [header].concat(sample).map(function (r) {
        return r.map(function (f) { return '"' + String(f).replace(/"/g, '""') + '"'; }).join(',');
      }).join('\n');
      var blob = new Blob([csv], { type: 'text/csv' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'outloud-items-template.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    // Drop zone
    var dz = el('drop-zone'), fi = el('csv-file');
    dz.addEventListener('click', function () { fi.click(); });
    dz.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
    ['dragover', 'dragenter'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); });
    });
    dz.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleCsvFile(f);
    });
    fi.addEventListener('change', function () {
      if (fi.files && fi.files[0]) handleCsvFile(fi.files[0]);
    });

    // Manual editor toggle
    el('toggle-manual').addEventListener('click', function () {
      var m = el('manual-area');
      if (m.hidden) {
        m.hidden = false;
        if (!wizard.manualItems) wizard.manualItems = [blankItem()];
        renderManualEditor();
        m.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        m.hidden = true;
      }
    });

    // Restore a preview if user navigated back
    if (wizard.catalog && wizard.catalog.length) renderPreviewTable();
  }

  function blankItem() {
    return { name: '', description: '', price: '', category: '', serviceArea: '', notes: '' };
  }

  function handleCsvFile(file) {
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      toast('That does not look like a CSV file — save your sheet as CSV first.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var rows = parseCSV(String(reader.result || ''));
      if (!rows.length) { toast('That file came back empty.'); return; }
      var headers = rows[0].map(function (h) { return String(h || '').trim(); });
      var dataRows = rows.slice(1);
      wizard.csvHeaders = headers;
      wizard.csvMap = autoMap(headers);
      wizard.catalog = dataRows.map(function (r) {
        var item = blankItem();
        CSV_COLUMNS.forEach(function (c) {
          var idx = wizard.csvMap[c.key];
          item[c.key] = (idx != null && r[idx] != null) ? String(r[idx]).trim() : '';
        });
        return item;
      }).filter(function (it) { return it.name !== ''; });
      renderPreviewTable();
      toast(wizard.catalog.length + ' items found');
    };
    reader.readAsText(file);
  }

  function renderManualEditor() {
    var m = el('manual-area');
    if (!m || m.hidden) return;
    var items = wizard.manualItems || [];
    var rowsHtml = items.map(function (it, i) {
      return '<tr data-i="' + i + '">' +
        '<td><input data-f="name" value="' + esc(it.name) + '" placeholder="Fence repair"></td>' +
        '<td><input data-f="description" value="' + esc(it.description) + '" placeholder="What it includes"></td>' +
        '<td><input data-f="price" value="' + esc(it.price) + '" placeholder="$99"></td>' +
        '<td><input data-f="category" value="' + esc(it.category) + '" placeholder="Repairs"></td>' +
        '<td><input data-f="serviceArea" value="' + esc(it.serviceArea) + '" placeholder="Your town"></td>' +
        '<td><input data-f="notes" value="' + esc(it.notes) + '" placeholder=""></td>' +
        '<td><button type="button" class="del-row" title="Remove row" aria-label="Remove row">×</button></td></tr>';
    }).join('');
    m.innerHTML =
      '<h3 style="margin:0 0 4px;font:400 20px var(--serif)">Add items by hand</h3>' +
      '<div class="preview-table-wrap"><table class="preview"><thead><tr>' +
      CSV_COLUMNS.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') +
      '<th></th></tr></thead><tbody>' + (rowsHtml || '<tr><td colspan="7" style="color:#8a9793">No rows yet.</td></tr>') +
      '</tbody></table></div>' +
      '<button class="btn ghost manual-row-btn" id="add-row" type="button">Add a row</button>' +
      '<button class="btn subtle manual-row-btn" id="use-manual" type="button">Use these items below</button>';

    m.querySelectorAll('input[data-f]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var tr = inp.closest('tr');
        var i = parseInt(tr.getAttribute('data-i'), 10);
        wizard.manualItems[i][inp.getAttribute('data-f')] = inp.value;
      });
    });
    m.querySelectorAll('.del-row').forEach(function (b) {
      b.addEventListener('click', function () {
        var tr = b.closest('tr');
        var i = parseInt(tr.getAttribute('data-i'), 10);
        wizard.manualItems.splice(i, 1);
        if (!wizard.manualItems.length) wizard.manualItems = [blankItem()];
        renderManualEditor();
      });
    });
    el('add-row').addEventListener('click', function () {
      wizard.manualItems.push(blankItem());
      renderManualEditor();
    });
    el('use-manual').addEventListener('click', function () {
      var items = wizard.manualItems.filter(function (it) { return String(it.name).trim() !== ''; });
      if (!items.length) { toast('Give at least one row a name first.'); return; }
      wizard.csvHeaders = CSV_COLUMNS.map(function (c) { return c.label; });
      wizard.csvMap = {}; CSV_COLUMNS.forEach(function (c, i) { wizard.csvMap[c.key] = i; });
      wizard.catalog = items.map(function (it) { return Object.assign(blankItem(), it); });
      renderPreviewTable();
      toast(items.length + ' items ready to review');
      el('preview-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function renderPreviewTable() {
    var area = el('preview-area');
    if (!area) return;
    if (!wizard.catalog || !wizard.catalog.length) { area.innerHTML = ''; return; }
    var map = wizard.csvMap || {};
    var options = function (selectedKey) {
      return '<option value="-1">— skip this column —</option>' +
        CSV_COLUMNS.map(function (c) {
          var sel = map[c.key] != null && c.key === selectedKey ? '' : '';
          return '';
        }).join('');
    };
    // Build per-column header selects: for each CSV column index, choose which field it maps to
    function headerSelects() {
      return CSV_COLUMNS.map(function (c, fi2) {
        // find which csv index maps to this field
        var mappedIdx = -1;
        for (var k in map) { if (map[k] === fi2) { mappedIdx = parseInt(k === c.key ? fi2 : map[k], 10); } }
        return '';
      });
    }
    // Simpler: per FIELD header (rows are items; columns are fields). We render fields as columns.
    var fieldSel = function (key, fi3) {
      var opts = CSV_COLUMNS.map(function (c) {
        var cur = map[c.key];
        var isCur = (c.key === key);
        return '<option value="' + c.key + '"' + (isCur ? ' selected' : '') + '>' + esc(c.label) + '</option>';
      }).join('');
      return opts;
    };

    var headCells = CSV_COLUMNS.map(function (c) {
      var mappedIdx = map[c.key];
      var sel = '<select data-mapfor="' + c.key + '" aria-label="Map column">' +
        '<option value="">— not used —</option>' +
        wizard.csvHeaders.map(function (h, hi) {
          var sel = (mappedIdx === hi) ? ' selected' : '';
          return '<option value="' + hi + '"' + sel + '>' + esc(h || ('Column ' + (hi + 1))) + '</option>';
        }).join('') +
        '</select>';
      return '<th>' + sel + '<span class="th-help">' + esc(c.help) + '</span></th>';
    }).join('');

    var bodyRows = wizard.catalog.map(function (it, ri) {
      return '<tr data-r="' + ri + '">' +
        CSV_COLUMNS.map(function (c) {
          return '<td><input data-f="' + c.key + '" value="' + esc(it[c.key] || '') + '"></td>';
        }).join('') +
        '<td><button type="button" class="del-row" title="Remove row" aria-label="Remove row">×</button></td>' +
        '</tr>';
    }).join('');

    area.innerHTML =
      '<div class="preview-table-wrap"><table class="preview"><thead><tr>' + headCells + '<th></th></tr></thead>' +
      '<tbody>' + bodyRows + '</tbody></table></div>' +
      '<p class="bad-count">' + wizard.catalog.length + ' items — edit anything before saving.</p>' +
      '<div class="btn-row"><button class="btn" id="save-catalog">Save items</button></div>';

    // Column remap
    area.querySelectorAll('select[data-mapfor]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var target = sel.getAttribute('data-mapfor');
        var v = sel.value;
        // clear other fields mapped to this index
        for (var k in wizard.csvMap) {
          if (wizard.csvMap[k] === parseInt(v, 10) && k !== target) wizard.csvMap[k] = null;
        }
        wizard.csvMap[target] = v === '' ? null : parseInt(v, 10);
        // rebuild catalog cells from raw CSV rows
        rebuildCatalogFromCsv();
      });
    });
    // Inline edits
    area.querySelectorAll('input[data-f]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var ri = parseInt(inp.closest('tr').getAttribute('data-r'), 10);
        wizard.catalog[ri][inp.getAttribute('data-f')] = inp.value;
      });
    });
    area.querySelectorAll('.del-row').forEach(function (b) {
      b.addEventListener('click', function () {
        var ri = parseInt(b.closest('tr').getAttribute('data-r'), 10);
        wizard.catalog.splice(ri, 1);
        renderPreviewTable();
      });
    });
    el('save-catalog').addEventListener('click', saveCatalog);
  }

  function rebuildCatalogFromCsv() {
    // keeps current inline edits where possible; re-derives from the raw csv rows
    // (raw rows were captured in wizard.rawRows at parse time)
    if (!wizard.rawRows) return;
    var map = wizard.csvMap || {};
    wizard.catalog = wizard.rawRows.map(function (r) {
      var item = blankItem();
      CSV_COLUMNS.forEach(function (c) {
        var idx = map[c.key];
        item[c.key] = (idx != null && r[idx] != null) ? String(r[idx]).trim() : '';
      });
      return item;
    }).filter(function (it) { return it.name !== ''; });
    renderPreviewTable();
  }

  function saveCatalog() {
    var items = (wizard.catalog || []).filter(function (it) { return String(it.name).trim() !== ''; });
    if (!items.length) { toast('Add at least one item first.'); return; }
    var doc = { version: 1, items: items, saved_at: new Date().toISOString() };
    var btn = el('save-catalog');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    bcRemember('ol_acct_' + acct.slug, JSON.stringify(doc), 'catalog', 'Catalog — ' + items.length + ' items').then(function () {
      wizard.catalogSaved = true;
      wizard.step = 3;
      renderOnboarding(3);
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Save items'; }
      renderError(err);
    });
  }

  /* ----- Step 3: avatar & voice ----- */
  function renderStep3() {
    var body = el('step-body');
    var a = wizard.config.avatar || { kind: 'mascot' };
    var v = wizard.config.voice || { voiceId: 'iLVmqjzCGGvqtMCk6vVQ' };
    body.innerHTML =
      '<div class="card">' +
      '<h3 style="margin:0 0 4px;font:400 22px var(--serif)">Pick a face</h3>' +
      '<p class="page-sub" style="margin-bottom:14px">The animated mascot is included with every plan. Video faces are stock options you can switch anytime.</p>' +
      '<div class="avatar-grid" id="avatar-grid">' +
      FACES.map(function (f) {
        var sel = (a.kind === f.kind && (f.kind === 'mascot' || a.faceId === f.faceId)) ? ' selected' : '';
        var thumb = f.img
          ? '<img class="thumb" src="' + esc(f.img) + '" alt="" loading="lazy" onerror="this.outerHTML=\'<div class=&quot;thumb fallback&quot;>' + esc(f.name.charAt(0)) + '</div>\'">'
          : '<div class="thumb fallback">' + esc(f.name.charAt(0)) + '</div>';
        return '<button type="button" class="avatar-card' + sel + '" data-kind="' + f.kind + '" data-face="' + esc(f.faceId) + '" data-name="' + esc(f.name) + '">' +
          thumb + '<span class="a-name">' + esc(f.name) + '</span><span class="a-sub">' + esc(f.sub) + '</span></button>';
      }).join('') +
      '</div>' +
      '<h3 style="margin:26px 0 4px;font:400 22px var(--serif)">Pick a voice</h3>' +
      '<p class="page-sub" style="margin-bottom:14px">How your OutLoud sounds when it answers.</p>' +
      '<div class="voice-list" id="voice-list">' +
      VOICES.map(function (vo) {
        var sel = v.voiceId === vo.id ? ' selected' : '';
        return '<button type="button" class="voice-row' + sel + '" data-voice="' + esc(vo.id) + '" data-vname="' + esc(vo.name) + '">' +
          '<span class="v-name">' + esc(vo.name) + '</span><span class="v-sub">' + esc(vo.sub) + '</span>' +
          '<span class="spacer"></span>' +
          '<span class="v-preview" title="Audio preview needs the launch update">Preview coming with launch</span>' +
          '</button>';
      }).join('') +
      '</div>' +
      '<form id="f-step3"><div class="btn-row">' +
      '<button type="button" class="btn ghost" id="w-back">Back</button><span class="spacer"></span>' +
      '<button type="submit" class="btn">Save & continue</button></div></form>' +
      '</div>';

    body.querySelectorAll('.avatar-card').forEach(function (cardB) {
      cardB.addEventListener('click', function () {
        body.querySelectorAll('.avatar-card').forEach(function (c) { c.classList.remove('selected'); });
        cardB.classList.add('selected');
        wizard.config.avatar = {
          kind: cardB.getAttribute('data-kind'),
          faceId: cardB.getAttribute('data-face'),
          name: cardB.getAttribute('data-name')
        };
      });
    });
    body.querySelectorAll('.voice-row').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.classList.contains('v-preview')) return; // disabled preview chip
        body.querySelectorAll('.voice-row').forEach(function (r) { r.classList.remove('selected'); });
        row.classList.add('selected');
        wizard.config.voice = { voiceId: row.getAttribute('data-voice'), name: row.getAttribute('data-vname') };
      });
    });
    $('#w-back').addEventListener('click', function () { wizard.step = 2; renderOnboarding(2); });

    $('#f-step3').addEventListener('submit', function (e) {
      e.preventDefault();
      saveAccountConfig(wizard.config).then(function () {
        wizard.step = 4;
        renderOnboarding(4);
      }).catch(renderError);
    });
  }

  /* ----- Step 4: review & go live ----- */
  function renderStep4() {
    var b = wizard.config.business;
    var a = wizard.config.avatar || {};
    var v = wizard.config.voice || {};
    var voiceName = v.name || (VOICES.filter(function (x) { return x.id === v.voiceId; })[0] || {}).name || '—';
    var li = function (label, val) {
      return '<li><span class="r-label">' + esc(label) + '</span><span>' + (esc(val) || '<span style="color:#b7bfb7">Not set yet</span>') + '</span></li>';
    };
    setView(
      '<div class="progress-wrap"><div class="progress-label"><span class="step-count">Step 4 of 4</span><span class="step-name">Review & go live</span></div>' +
      '<div class="progress-track"><div class="progress-fill" style="width:100%"></div></div></div>' +
      '<div class="card">' +
      '<ul class="review-list">' +
      li('Name', b.name) +
      li(wizard.config.account_type === 'personal' ? 'About you' : 'What you do', b.whatYouDo) +
      li('Service area', b.serviceArea) +
      li('Hours', b.hours) +
      li('Pricing', b.pricingStyle) +
      li('Face', a.name || '—') +
      li('Voice', voiceName) +
      '</ul>' +
      '<div class="url-row" style="margin-top:16px"><span class="lab" style="font-weight:700;font-size:13px">Your public page</span>' +
      '<span class="url-pill">' + esc(PUBLIC_BASE + wizard.config.slug + '/') + '</span></div>' +
      '<p class="mini-note">Everything stays editable from your dashboard after you go live.</p>' +
      '<div class="btn-row"><button class="btn ghost" id="w-back">Back</button><span class="spacer"></span>' +
      '<button class="btn" id="go-live">Go live</button></div>' +
      '</div>'
    );
    $('#w-back').addEventListener('click', function () { wizard.step = 3; renderOnboarding(3); });
    el('go-live').addEventListener('click', function () {
      var btn = el('go-live');
      btn.disabled = true; btn.textContent = 'Going live…';
      wizard.config.status = 'live';
      saveAccountConfig(wizard.config).then(function () {
        location.hash = '#/success';
      }).catch(function (err) {
        btn.disabled = false; btn.textContent = 'Go live';
        renderError(err);
      });
    });
  }

  function renderSuccess() {
    gate(true, function () {
      var cfg = (wizard && wizard.config) || (acct && acct.config);
      var slug = cfg ? cfg.slug : (acct ? acct.slug : '');
      setView(
        '<div class="card auth-card center">' +
        '<div class="success-check" aria-hidden="true">✓</div>' +
        '<h1 class="page-title">You are live</h1>' +
        '<p class="page-sub">Your OutLoud is on and listening on your page.</p>' +
        '<div class="url-row" style="justify-content:center;margin:18px 0"><span class="url-pill">' + esc(PUBLIC_BASE + slug + '/') + '</span>' +
        '<button class="copy-btn" data-copy="' + esc(PUBLIC_BASE + slug + '/') + '">Copy link</button></div>' +
        '<div class="btn-row" style="justify-content:center">' +
        '<a class="btn ghost" href="' + esc(PUBLIC_BASE + slug + '/') + '" target="_blank" rel="noopener">View my page</a>' +
        '<a class="btn" href="#/dashboard">Open my dashboard</a></div>' +
        '</div>'
      );
    });
  }

  /* ---------- Dashboard ---------- */
  function renderDashboard() {
    gate(true, function () {
      if (!acct) {
        findAccountForUser(session.user.id).then(function (found) {
          if (found) { acct = found; renderDashboard(); }
          else renderAskBusiness();
        }).catch(renderError);
        return;
      }
      setView(
        headerFor('Your dashboard', 'Everything about your OutLoud, in one place.') +
        '<div class="card" id="dash-main"><div class="loading"><span class="spin"></span> Loading your account…</div></div>'
      );
      var ns = 'ol_acct_' + acct.slug;
      Promise.all([
        loadAccountConfig(acct.slug, session.user.id),
        loadCatalogCount(acct.slug)
      ]).then(function (res) {
        var found = res[0];
        var count = res[1];
        var cfg = (found && found.config) || (acct.config) || null;
        if (!cfg) { renderError(new Error('Account config not found. Try reloading.')); return; }
        acct.config = cfg;
        var isLive = cfg.status === 'live';
        var plan = PLANS[cfg.plan] || PLANS.starter;
        var url = cfg.publicUrl || (PUBLIC_BASE + cfg.slug + '/');
        var b = cfg.business || {};
        el('dash-main').outerHTML =
          '<div class="card">' +
          '<div class="btn-row" style="margin-top:0;justify-content:space-between">' +
          '<span class="chip ' + (isLive ? 'live' : 'draft') + '"><span class="dot"></span>' + (isLive ? 'Live' : 'Draft') + '</span>' +
          '<span class="plan-flag"><span class="plan-name">' + esc(plan.name) + ' plan</span>' +
          '<span class="upgrade-teaser">Upgrade options arrive at launch — everything works today.</span></span>' +
          '</div>' +
          '<div class="url-row"><span class="url-pill" id="pub-url">' + esc(url) + '</span>' +
          '<button class="copy-btn" data-copy="' + esc(url) + '">Copy link</button>' +
          '<a class="btn ghost" style="min-height:36px" href="' + esc(url) + '" target="_blank" rel="noopener">View my page</a></div>' +
          '<div class="stat-grid">' +
          '<div class="stat-cell"><div class="s-label">Name</div><div class="s-value">' + esc(b.name || '—') + '</div></div>' +
          '<div class="stat-cell"><div class="s-label">Catalog</div><div class="s-value">' + count + ' item' + (count === 1 ? '' : 's') + '</div></div>' +
          '<div class="stat-cell"><div class="s-label">Face</div><div class="s-value">' + esc((cfg.avatar && cfg.avatar.name) || '—') + '</div></div>' +
          '<div class="stat-cell"><div class="s-label">Voice</div><div class="s-value">' + esc((cfg.voice && cfg.voice.name) || '—') + '</div></div>' +
          '</div>' +
          (found && found.stale ? '<p class="mini-note">Showing your last saved info — live details are loading slowly.</p>' : '') +
          '<div class="action-grid">' +
          '<button class="action-card" id="edit-content"><span class="ac-title">Edit content</span><span class="ac-sub">What you do, hours, prices, and your items.</span></button>' +
          '<button class="action-card" id="edit-avatar"><span class="ac-title">Change avatar & voice</span><span class="ac-sub">Pick a different face or sound.</span></button>' +
          '<button class="action-card" id="view-leads"><span class="ac-title">View leads</span><span class="ac-sub">People who reached out through your page.</span></button>' +
          '</div>' +
          '<div class="btn-row"><button class="btn danger" id="sign-out">Sign out</button></div>' +
          '</div>';

        el('edit-content').addEventListener('click', function () {
          startWizard(cfg, false); wizard.step = 1; location.hash = '#/onboarding'; renderOnboarding(1);
        });
        el('edit-avatar').addEventListener('click', function () {
          startWizard(cfg, false); wizard.step = 3; location.hash = '#/onboarding'; renderOnboarding(3);
        });
        el('view-leads').addEventListener('click', function () { location.hash = '#/leads'; });
        el('sign-out').addEventListener('click', doSignOut);
      }).catch(renderError);
    });
  }

  /* ---------- Leads ---------- */
  function renderLeads() {
    gate(true, function () {
      if (!acct) { location.hash = '#/dashboard'; return; }
      var ns = 'ol_acct_' + acct.slug;
      setView(
        headerFor('Leads', 'People who reached out through your OutLoud page.') +
        '<div class="card" id="leads-main"><div class="loading"><span class="spin"></span> Checking for leads…</div></div>'
      );
      bcGetDocs(ns, 'customer leads messages with contact info', 'lead').then(function (res) {
        var docs = res.all.filter(function (d) {
          return d && (d.name || d.contact || d.message) && !d.items; // lead-shaped docs, exclude catalog
        });
        docs.sort(function (x, y) {
          return String(y.received_at || '').localeCompare(String(x.received_at || ''));
        });
        var listHtml;
        if (!docs.length) {
          listHtml = '<div class="empty-state"><div class="es-big">No leads yet</div>' +
            'Your OutLoud is ready to catch them. When someone leaves a message on your page, it shows up here.</div>';
        } else {
          listHtml = docs.map(function (d) {
            var when = d.received_at ? new Date(d.received_at).toLocaleString() : '';
            return '<div class="lead-item">' +
              '<span class="l-name">' + esc(d.name || 'Anonymous') + '</span>' +
              (d.contact ? ' · <span class="l-contact">' + esc(d.contact) + '</span>' : '') +
              (d.message ? '<p class="l-msg">' + esc(d.message) + '</p>' : '') +
              '<div class="l-meta">' + [d.page, when].filter(Boolean).map(esc).join(' · ') + '</div>' +
              '</div>';
          }).join('');
        }
        var lm = el('leads-main');
        if (lm) lm.outerHTML = '<div class="card">' + listHtml +
          '<div class="btn-row"><a class="btn ghost" href="#/dashboard">Back to dashboard</a></div></div>';
      }).catch(function (err) {
        var lm = el('leads-main');
        if (lm) lm.outerHTML = '<div class="card"><div class="notice err">' + esc(err.message || 'Could not load leads.') +
          '</div><a class="btn ghost" href="#/dashboard">Back to dashboard</a></div>';
      });
    });
  }

  /* ---------- Sign out ---------- */
  function doSignOut() {
    sb.auth.signOut().then(function () {
      session = null;
      cacheSession(null);
      acct = null;
      wizard = null;
      keysLoaded = false;
      location.hash = '#/login';
    });
  }

  /* ---------- Copy buttons ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var text = btn.getAttribute('data-copy');
    var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy link'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  });
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
  }

  /* ---------- Boot ---------- */
  function boot() {
    try { initSupabase(); } catch (e) {
      setView('<div class="card auth-card"><div class="notice err">Could not load sign-in components. Refresh the page.</div></div>');
      return;
    }
    sb.auth.getSession().then(function (res) {
      session = (res && res.data && res.data.session) || null;
      cacheSession(session);
      if (session) {
        return requireKeys().then(function () {
          return findAccountForUser(session.user.id);
        }).then(function (found) {
          if (found) {
            acct = found;
            if (!location.hash || location.hash === '#/login' || location.hash === '#/signup' || location.hash === '#/' || location.hash === '#') {
              location.hash = '#/dashboard';
            } else {
              route();
            }
          } else if (!location.hash || location.hash === '#/' || location.hash === '#' || location.hash === '#/login' || location.hash === '#/signup') {
            renderAskBusiness();
          } else {
            route();
          }
        });
      }
      route();
    }).catch(function (err) {
      console.error(err);
      route();
    });
  }

  window.addEventListener('hashchange', route);
  boot();

  // expose for console sanity tests
  window.__OL_TEST = { parseCSV: parseCSV, slugify: slugify, tryParseJson: tryParseJson };
})();
