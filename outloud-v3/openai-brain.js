/* ===============================================================
   OutLoud 2.0 — OPENAI BRAIN (owner directive 2026-09-25)
   "OpenAI runs the avatars — it is the brain, not the face."
   Joe 2026-09-25 16:10 MST: OpenAI must be the brains of the
   avatars, especially for signed-up users.

   Division of labor (locked):
     • OpenAI  = the reasoning brain: writes every non-catalog answer.
     • BlueColumn = memory/grounding: /recall context feeds the prompt.
     • Catalog = instant offline fallback ONLY when OpenAI is
       unavailable (no key / quota / network).

   Latency policy: recall is fired in parallel and capped at 2.5s;
   the OpenAI call never waits longer than that for grounding.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var SECRETS = window.OUTLOUD.SECRETS;
  var B = CONFIG.brain || {};
  var MODEL = B.model || 'gpt-4o-mini';
  var TIMEOUT = B.timeoutMs || 9000;
  var MAX_TOKENS = B.maxTokens || 220;

  function available() {
    return !!SECRETS.openaiKey;
  }

  /* Base persona + standing rules + the published fact sheet. The
     catalog texts double as the fact block so the brain never
     contradicts the instant-answer layer. */
  function systemPrompt(contextText) {
    var lines = [
      'You are Ari, the voice of OutLoud by BlueColumn, talking out loud on a business website.',
      'Rules: answer in spoken-word sentences, warm and direct, no markdown, no lists, no emoji, 1-3 short sentences.',
      'Never invent facts. If something is not covered below or in the reference notes, say you will have a strategist follow up.',
      'Pricing is: Personal $19/mo, Starter $49/mo, Pro $149/mo (200 video minutes, $0.50/min after), Team $349/mo (5 seats, 600 pooled minutes), Enterprise custom, $500 optional white-glove onboarding, 14-day trial on Starter.',
      'OutLoud is BlueColumn\'s AlwaysOn conversational website layer: the site talks with every visitor, answers questions in voice, and captures leads. The voice is ElevenLabs, the memory is BlueColumn, and the brain is OpenAI.',
      'Booking a live calendar is not enabled yet: for demos or walkthroughs, invite the visitor to leave their name and number so a strategist follows up.'
    ];
    if (contextText) {
      lines.push('Reference notes from the company knowledge base (ground truth when present): ' + contextText);
    }
    return lines.join('\n');
  }

  function callOpenAI(query, contextText) {
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, TIMEOUT);
    return fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SECRETS.openaiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt(contextText) },
          { role: 'user', content: String(query || '') }
        ]
      }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) {
        var err = new Error('openai-http-' + res.status);
        err.status = res.status;
        throw err;
      }
      return res.json();
    }).then(function (d) {
      var t = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      t = (t || '').trim();
      if (!t) { throw new Error('openai-empty'); }
      return t;
    }).catch(function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  /* answer(query, groundPromise) — groundPromise resolves to the
     BlueColumn recall result (or null). Always resolves with an
     answer string or rejects; caller owns the fallback chain. */
  function answer(query, groundPromise) {
    if (!available()) { return Promise.reject(new Error('no-openai-key')); }
    var ground = groundPromise ? groundPromise : Promise.resolve(null);
    return ground.then(function (r) {
      var ctx = r && r.text ? r.text : '';
      return callOpenAI(query, ctx);
    });
  }

  window.OUTLOUD.openaiBrain = {
    answer: answer,
    available: available,
    model: MODEL
  };
})();