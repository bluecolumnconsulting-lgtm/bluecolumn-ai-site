/* ===============================================================
   BlueColumn Avatar Catalog — UNIFIED FACE REGISTRY (v3)
   Added 2026-09-26, owner directive: one gallery of faces, all
   presented as BlueColumn's own. Clients/users pick a face; they
   never see (and must never infer) which engine drives it.

   Architecture:
     • Every face — in-house sprite rig, BlueColumn Originals
       (generated portraits), or provider-backed (Simli, Anam,
       LiveAvatar/HeyGen, D-ID) — resolves through this catalog.
     • The PUBLIC surface (list()) exposes only:
         id, name, description, tags, thumb, available
       No provider names, no vendor ids, no routing hints.
     • The INTERNAL entry (resolve()) carries provider routing
       consumed only by session-orchestrator / directors.
     • Adding a face from a new provider = add one entry here.
       The picker UI never changes.

   Face statuses:
     ready            -> selectable today (sprite rig renders it)
     pending-key      -> entry exists; needs a provider credential
     retired          -> kept for history, never listed

   NOTE: provider activation still flows through outloud.config.js
   feature flags. A face only becomes available when its provider
   director is both credentialed and enabled.
   =============================================================== */
(function () {
  'use strict';

  /* ---------- INTERNAL registry (never shipped to the picker) --- */
  var FACES = [
    /* --- In-house rig (always available, no external deps) --- */
    {
      id: 'classic',
      name: 'Classic',
      description: 'The original BlueColumn animated avatar.',
      tags: ['signature', 'illustrated'],
      provider: { engine: 'sprite', sprite: 'mascot-sprites.png', cols: 4, rows: 3 },
      status: 'ready'
    },

    /* --- BlueColumn Originals: generated portraits (2026-09-26) ---
       Image-to-video drivers: D-ID /talks (primary, credits),
       Simli (trained face), Anam / HeyGen (uploaded persona).
       status reflects DRIVERS, not the portraits: portraits are
       final; a face flips to 'ready' when a credentialed video
       engine can drive it. Until then they render via the sprite
       path only if a rig is built (not planned). */
    {
      id: 'ava',
      name: 'Ava',
      description: 'Warm and direct. Early 30s.',
      tags: ['professional', 'warm', 'female'],
      provider: { engine: 'portrait', file: 'avatar-faces/ava.jpg', drivers: ['did', 'anam', 'liveavatar', 'simli'] },
      status: 'pending-key'
    },
    {
      id: 'marcus',
      name: 'Marcus',
      description: 'Approachable and steady. Late 30s.',
      tags: ['professional', 'friendly', 'male'],
      provider: { engine: 'portrait', file: 'avatar-faces/marcus.jpg', drivers: ['did', 'anam', 'liveavatar', 'simli'] },
      status: 'pending-key'
    },
    {
      id: 'elena',
      name: 'Elena',
      description: 'Poised and experienced. Late 40s.',
      tags: ['executive', 'polished', 'female'],
      provider: { engine: 'portrait', file: 'avatar-faces/elena.jpg', drivers: ['did', 'anam', 'liveavatar', 'simli'] },
      status: 'pending-key'
    },
    {
      id: 'kai',
      name: 'Kai',
      description: 'Calm and modern. Late 20s.',
      tags: ['tech', 'friendly', 'male'],
      provider: { engine: 'portrait', file: 'avatar-faces/kai.jpg', drivers: ['did', 'anam', 'liveavatar', 'simli'] },
      status: 'pending-key'
    },

    /* --- Provider stock faces (provisioned, awaiting credentials) --- */
    {
      id: 'wayne',
      name: 'Wayne',
      description: 'Bright presenter style.',
      tags: ['presenter', 'male'],
      provider: { engine: 'liveavatar', avatarId: 'dd73ea75-1218-4ef3-92ce-606d5f7fbc0a', mode: 'sandbox' },
      status: 'pending-key'
    },
    {
      id: 'anam-stock',
      name: 'Jordan',
      description: 'Clean conversational style.',
      tags: ['presenter', 'neutral'],
      provider: { engine: 'anam', avatarId: '', avatarModel: 'cara-4' },
      status: 'pending-key'
    },
    {
      id: 'did-agent',
      name: 'Reyes',
      description: 'Broadcast polish.',
      tags: ['executive', 'neutral'],
      provider: { engine: 'did', agentId: '' },
      status: 'pending-key'
    },

    /* --- Retired --- */
    {
      id: 'joe',
      name: 'Joe',
      description: 'Founder face (retired from live path).',
      tags: [],
      provider: { engine: 'simli', faceId: '7e74d6e7-d559-4394-bd56-4923a3ab75ad' },
      status: 'retired'
    }
  ];

  /* ---------- public surface: provider-stripped ---------- */
  function toPublic(f) {
    var dir = f.provider && f.provider.file ? f.provider.file.replace(/^.*\//, '') : null;
    return {
      id: f.id,
      name: f.name,
      description: f.description,
      tags: f.tags.slice(0),
      thumb: dir,                       // picker renders from /outloud-v3/avatar-faces|assets
      available: f.status === 'ready'
    };
  }

  /* list(): what pickers and client code ever see */
  function list(opts) {
    opts = opts || {};
    var out = [];
    for (var i = 0; i < FACES.length; i++) {
      var f = FACES[i];
      if (f.status === 'retired' && !opts.includeRetired) continue;
      out.push(toPublic(f));
    }
    return out;
  }

  /* get(): public-shaped single face */
  function get(id) {
    for (var i = 0; i < FACES.length; i++) {
      if (FACES[i].id === id) return toPublic(FACES[i]);
    }
    return null;
  }

  /* resolve(): INTERNAL — returns the full routing entry.
     Only session-orchestrator / director code may consume this.
     Never log, never serialize into client-facing payloads. */
  function resolve(id) {
    for (var i = 0; i < FACES.length; i++) {
      if (FACES[i].id === id) return FACES[i];
    }
    return null;
  }

  /* defaultFace(): first available, else classic sprite */
  function defaultFace() {
    for (var i = 0; i < FACES.length; i++) {
      if (FACES[i].status === 'ready') return toPublic(FACES[i]);
    }
    return toPublic(FACES[0]);
  }

  /* addFace(): register a new face at runtime (admin/console use).
     Guards the public surface the same as static entries. */
  function addFace(entry) {
    if (!entry || !entry.id || !entry.name || !entry.provider) return false;
    for (var i = 0; i < FACES.length; i++) {
      if (FACES[i].id === entry.id) return false;   // no duplicate ids
    }
    FACES.push({
      id: entry.id,
      name: entry.name,
      description: entry.description || '',
      tags: entry.tags || [],
      provider: entry.provider,
      status: entry.status || 'pending-key'
    });
    return true;
  }

  window.BlueColumnAvatarCatalog = {
    list: list,
    get: get,
    resolve: resolve,
    defaultFace: defaultFace,
    addFace: addFace
  };
})();
