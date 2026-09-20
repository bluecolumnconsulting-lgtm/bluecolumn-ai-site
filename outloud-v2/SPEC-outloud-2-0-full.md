# OutLoud 2.0 Spec — synthesized from BlueColumn DB (sess_q6q730f3, note-20260917-144159.txt, 2026-09-17)

The Response Plan schema includes the following structure for avatar gestures and validation:

**Avatar Gestures in Response Plan:**

The `avatar` object in the response plan contains:
- `baseline` state (emotion, energy, posture, initialGaze)
- `constraints` (allowGestures, maxGestureIntensity, avoidPointing, keepEyeContact)

**Body Channel Gesture Format:**
```ts
gesture.play({
  name: "present_right",
  intensity: 0.62,
  entryMs: 260,
  holdMs: 1100,
  releaseMs: 380
});
```

**Validation Requirements:**
The Response Plan Validator must reject or repair plans that:
- Request unsupported gestures, expressions, or gaze targets
- Use overlapping body gestures that cannot be blended
- Exceed maximum gesture intensity constraints
- Reference unavailable content IDs
- Schedule invalid time offsets

**Validator Behavior:**
The validator returns a degraded but usable plan whenever possible. For example, it replaces an unavailable `point_right` gesture with `present_right`, or omits missing content while preserving the spoken answer.

**Animation Blending Rules:**
- Body gestures require entry, hold, and release phases and must be blendable and cancellable
- Body gestures can coexist with head movement only if the renderer adapter supports blending
- High-priority interruption behavior overrides all scheduled gestures

---

The **three-context rule** requires every response to use three separate context sources:

1. **RAG** — What does this business know?
   - Service descriptions, product catalogs, pricing, policies, FAQs, warranties, case studies

2. **BlueColumn** — What do we know about this customer?
   - Consented customer/session facts, preferences, lead state, project details, outcomes

3. **OpenClaw** — What should happen next?
   - Experience planning, intent reasoning, response choreography, tool selection, content sequencing

This separation enforces clear boundaries:

- **Do not** store business documentation or product catalogs as customer memory
- **Do not** treat chat transcript as permanent customer memory
- **Do not** let UI state become the only source of truth for lead or session state
- **Do not** allow OpenClaw to directly persist long-term memory without validation, user consent, and audit records

OpenClaw acts as the experience planner—it receives the user message, conversation context, approved RAG knowledge, policy-filtered BlueColumn memory, and available tools, then produces a valid response plan. It must answer accurately using approved knowledge, use customer memory only when relevant, choose helpful content, and propose memory facts only when supported by explicit user input or high-confidence interaction data.

---

# OutLoud 2.0 Runtime Event Flow & Session Lifecycle

## Event Flow Architecture

The core flow is:
1. **Customer speech / click / form action** → Realtime input layer
2. **Transcription + intent + context** → RAG + BlueColumn Memory + business tools
3. **OpenClaw** → generates structured Multimodal Response Plan
4. **Response Plan execution** splits across three parallel directors:
   - Speech (TTS)
   - Avatar Director (visemes/gestures)
   - UI/Content Director (panels/actions/forms)

## Versioned WebSocket Protocol

Every event uses a common envelope:
```ts
export interface OutLoudEvent<T = unknown> {
  protocolVersion: "2.0";
  id: string;
  type: string;
  timestamp: string;
  sessionId: string;
  turnId?: string;
  responseId?: string;
  payload: T;
}
```

### Client-to-Server Events
- `session.start` — Creates or resumes an OutLoud session
- `session.ready` — Client capability report after boot
- `audio.start` — Begins audio capture
- `audio.chunk` — Sends encoded microphone audio
- `audio.end` — Signals capture completion
- `transcript.partial` — Optional local/edge partial transcript

## Session Lifecycle State Machine

The Session Orchestrator owns session state transitions, cancellation, and event routing across:
- **IDLE** → **LISTENING** (VAD active, customer speaking)
- **LISTENING** → **PROCESSING** (transcription sent, awaiting response plan)
- **PROCESSING** → **RESPONDING** (avatar speaks, gestures, shows content)
- **RESPONDING** → **LISTENING** (customer can interrupt mid-response)
- **Any state** → **CANCELLED** (barge-in triggers immediate cancellation of speech, lip-sync, timeline events, and gestures)

## Booking & Business Actions (Phase 6)

The Response Plan can direct the Content Director to display and handle:
- Appointment booking tools
- CRM lead capture
- Confirmation steps
- Action audit trail

All response-plan, tool, memory, and content actions are **validated server-side**.

---

Based on the context provided, OutLoud 2.0 has the following implementation requirements for rendering layer content panel updates:

**Content Panel Display Requirements:**
The page must be able to display and receive events from:
- Product selections
- Galleries
- Comparisons
- Estimate inputs
- Forms
- Scheduling controls
- CTAs

**Content Director Responsibilities:**
The Content Director manages interactive content through:
- A Content Registry for component management
- An Action Registry for handling component events
- Support for interactive content events that feed back into the agent response cycle

**Validation Requirement:**
All content actions must be validated server-side before execution.

**SDK Configuration:**
Content panels are mounted and controlled via SDK configuration:
```ts
content: { 
  host: "#outloud-content-panel", 
  allowTakeover: true 
}
```

**Avatar-Content Coordination:**
The avatar must be able to:
- Look at a content panel
- Present or point at visible content
- Return gaze to the visitor

**Context Flow:**
Selections made in the content panel (such as "steel fencing") become usable context for the next agent response, enabling reactive conversation flow based on user interactions.