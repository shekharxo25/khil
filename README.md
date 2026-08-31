# Khil

A voice-first play session for children aged 2–6 that quietly records **how** a child
responds, and a parent/specialist layer that only speaks up when the same unusual pattern
turns up across several sessions and more than one kind of game.

Built with Expo SDK 57 (React Native 0.86, React 19, TypeScript). Runs in Expo Go.

Implements the *Khil — Game Design & Interface Spec* and the *Khil wireframe set v0.1*.

**Live: [khil.vercel.app](https://khil.vercel.app)** — open it on a phone, or narrow your
browser window; the layout is built for a 375pt screen. Turn sound on: every instruction is
spoken.

---

## Run it

```bash
npm install
```

```bash
npm start
```

Scan the QR code with **Expo Go** (Android/iOS). Sound on — every instruction is spoken.

To see it in a desktop browser instead:

```bash
npm run web
```

Deploy the hosted build:

```bash
vercel deploy --prod
```

`vercel.json` builds `npx expo export --platform web` into `dist/` and serves it as a
single-page app. The SPA fallback deliberately excludes `/_expo` and `/assets`, so a missing
bundle or sound returns a real 404 instead of silently serving the HTML shell.

Verify the decision logic without launching anything:

```bash
npm run check
```

That runs the TypeScript typecheck and then a headless pass over the flag engine
(`scripts/verify-domain.ts`), which prints exactly what the engine produces from seeded
data and exits non-zero if any invariant breaks.

### Seeing a flag in under a minute

A flag legitimately needs a history — that is the whole point of it — so the demo path is:

1. Onboard with PIN **380015** (covered PINs are listed under the field) and a DOB that
   makes the child 3–6.
2. `settings ›` → **Seed 12 days with a clustered pattern**.
3. Back to the dashboard: the flag is there, with a full report and a specialist portal
   behind *Specialist portal ›*.

**Seed 12 days of ordinary play** produces the same volume of data with no flag. Both
options generate real telemetry rows and run them through the same engine — no flag
anywhere in this project is hard-coded.

Useful toggles in `settings ›`:

| Toggle | What it does |
| --- | --- |
| Presenter overlay | Shows the passive-capture strip and live telemetry during play. Off in real play. |
| Show prompt text | Renders the spoken instruction as text. Breaks the pre-literate rule; for demoing on a muted laptop. |
| MVP games only | Restricts rotation to Games 1 and 2, per the spec's scope note. |
| Spoken instructions | Mute the voice layer. Timing stays comparable — see `lib/speech.ts`. |

---

## Three rules, enforced in code

The spec states three things as rules rather than preferences. A rule that lives only in a
document gets broken, so each one is enforced by something that fails loudly.

**1. No condition name ever reaches a human.**
Every string Khil generates about a child passes through `assertSafeCopy`
(`src/domain/safeLanguage.ts`) before it can leave the domain layer. In development a
violation throws; in production the string is replaced rather than shown. The banned list
covers condition names, deficit language and scored risk — but deliberately *not* the word
"diagnosis", because Khil is required to say "this is not a diagnosis" in three places.

**2. A flag never comes from one round, or from one session.**
`evaluateFlag` (`src/domain/flagEngine.ts`) requires seven conditions to hold at once, and
shows all seven, met or unmet, in the in-app audit panel. Self-checks assert that a single
session and a single round per session both produce nothing.

**3. Comparison ranges are placeholders until they are sourced.**
`src/domain/norms.ts` is marked `prototype-placeholder`, and every screen that shows a
comparison to an adult carries that warning. `REFERENCE_SOURCES_NEEDED` lists exactly what
still needs a citation. Swapping in real norms is a one-file change; the flag engine reads
nothing else.

All three are covered by `runSelfTests()` (`src/domain/selftest.ts`), which runs in the
audit panel and in `npm run check`.

---

## Screens → wireframes

| Wireframe | Screen | Notes honoured |
| --- | --- | --- |
| 01 Onboarding & consent | `screens/Onboarding.tsx` | DOB drives content, no age picker (1) · PIN validated against covered clusters with a waitlist state (2) · consent names the flagged segment, not full recordings (3) · a second, separate checkbox sets diagnostic expectations up front (4) |
| 02 Child game session | `game/GameFrame.tsx` + four games | Every instruction spoken (1) · tap/drag only, 88pt minimum targets (2) · session length shown to the parent before hand-off, never to the child (3) · capture is silent in real play (4) |
| 03 Parent dashboard | `screens/ParentDashboard.tsx` | Progress framing first (1) · calm plain-language flag, sand not red, no score (2) · one-tap booking to the mapped specialist (3) · "View full report" (4) |
| 04 Flag detail | `screens/FlagDetail.tsx` | Behavioural description only (1) · dedicated reassurance block before the decision (2) · "Remind me later" is a real option (3) |
| 05 Specialist portal | `screens/PediatricianList.tsx` | Scope limited to the PIN cluster (1) · review action only on active flags (2) · capacity indicator (3) |
| 06 Clip review | `screens/ClipReview.tsx` | Only the flagged segment is playable (1) · identical non-diagnostic language to the parent's report (2) · outcome tagging feeds the flag-usefulness measure (3) |

Two screens beyond the set: **Session intro** (the parent-side hand-off, where the spec's
attention-span reassurance belongs) and **Six skill areas**, which makes the dashboard's
"6 skills tracked" stat auditable instead of decorative.

## Games → spec §2

| Game | File | Logged |
| --- | --- | --- |
| 1 Spot the Odd One | `game/PatternGame.tsx` | latency from prompt end, correct/incorrect, repeated taps on the same wrong tile, difficulty tier |
| 2 Point to the One I Say | `game/LanguageGame.tsx` | latency, accuracy by word tier, whether the child dwelt before choosing |
| 3 Copy My Beat | `game/BeatGame.tsx` | tap accuracy, inter-tap timing deviation, max sequence length, error type |
| 4 What Happens Next | `game/SequenceGame.tsx` | final order correct, swaps before settling, time to first drag, whether the child re-ordered after audio feedback |

Difficulty escalates as the spec describes: colour-only → shape → subtle pattern for Game 1,
and named object → same-category distractors → *category* prompt for Game 2, which is what
separates comprehension from rote picture-word matching.

Spec §3 says the frame is the template and only the centre tile changes. That is literal
here: `GameFrame` owns the voice bar, progress meter, "Session X of 10" counter and
hold-to-exit; a game renders only its centre tile and implements one `GameProps` contract.

**Game 5 ("Peekaboo Response", gaze via front camera) is deliberately not built.** The spec
says not to build it until the consent flow and the on-device-only processing story are
solid. Khil currently touches no camera and no microphone, which is a claim the onboarding
screen makes to parents — adding gaze tracking would make that claim false.

---

## The one place the implementation departs from the spec

Spec §4 defines `task_switch_time_ms` as the *"gap between round-end and next first-tap"*.
Implemented literally — and it is, the column is in the table and shown to the clinician —
that gap unavoidably contains the next round's spoken instruction. Instruction audio is
device text-to-speech time, not child time, so putting a reference band on that number
would be putting a reference band on the phone. Measured on a real session it ran 3.5–6
seconds against a plausible child-timing band of well under two.

So the **signal** uses a switch *cost* instead: the child's own median latency on rounds
where the rule just changed, minus their own median latency on rounds where it did not,
within the same visit. Every device-dependent constant cancels. The difficulty schedule
(`src/domain/tiers.ts`) escalates with deliberate step-backs so that roughly half the rounds
are rule changes and the comparison has something to compare.

The clinician's round table marks rule changes with `⤳` and shows both numbers, so the
evidence for the phrase "slower-than-typical response switching" is visible rather than
asserted.

Two smaller notes, both marked in the code:

- Game 4's *time to first drag* and *swaps beyond the minimum* are recorded in the shared
  `response_latency_ms` and `repeat_error_count` columns rather than as new fields, which
  keeps the "one table" promise of §4.
- The clip review is a **replay reconstructed from tap timings**, not video. The wireframe
  shows a clip thumbnail; Khil has no camera, and rendering a fake video player for a
  clinician would be exactly the overclaim the spec's framing note warns against.

---

## How a flag is actually decided

```
rounds  →  per-visit measures  →  signals  →  cluster  →  flag
```

A **signal** is one measure, from one game, in one session, sitting outside the age
reference range by more than a third of that range's own width. Signals are not shown to
anyone; they are inputs.

A **flag** requires all of:

| Condition | Default |
| --- | --- |
| Complete sessions in the window | ≥ 3 in 14 days |
| Signals in the window | ≥ 3 |
| Distinct sessions those signals span | ≥ 2 |
| Distinct *kinds* of signal | ≥ 2 |
| At least one kind recurring across sessions | ≥ 2 sessions |
| Combined strength of the recurring cluster | ≥ 1.2 range-widths |
| No flag already open, not in the post-review quiet period | 21 days |

Deviation is measured in *range-widths*, not z-scores — we do not have the distributions a
z-score would imply, and pretending we do would be the overclaim the spec forbids. The
evidence shown to a parent quotes the **median** of each signal type, never the single worst
reading.

Everything above is visible live in `settings › Flag engine — right now`, including which
conditions are currently unmet and why.

---

## Layout

```
src/
  domain/        pure decision logic — no React, no storage, independently testable
    domains.ts     the six skill areas behind "6 skills tracked"
    games.ts       game registry: age bands, domains, round counts
    norms.ts       age reference bands + provenance  ← the file to replace with sourced norms
    tiers.ts       difficulty schedule (and therefore what a "rule change" is)
    telemetry.ts   spec §4 schema, snake_case so doc and code cannot drift
    signals.ts     per-visit measures → signals, incl. the switch-cost probe
    flagEngine.ts  the cluster rule
    safeLanguage.ts the language gate
    rotation.ts    1–2 games per session, all six domains twice a week
    coverage.ts    PIN → specialist mapping
    selftest.ts    the invariants, run in-app and in CI
  game/          the shared frame, the four games, the round recorder
  screens/       one file per wireframe screen
  store/         AsyncStorage-backed state; demo history generator
  ui/            design system primitives
  nav/           small typed stack (owns the back-lock during a session)
  theme/         tokens
scripts/
  verify-domain.ts   headless gate: npm run verify
```

`src/domain` imports nothing from React, React Native or storage. That is what lets the
whole decision layer run in plain Node, which is what `npm run verify` does.

## Data and privacy

Everything lives on the device, in one AsyncStorage key. A round is a handful of numbers —
timestamps, which tile was touched, whether it matched. There is no camera, no microphone,
no network call, and no analytics. The specialist portal in this build reads the same local
store, which is how the demo shows both sides; a real deployment would send only the flag
summary and the flagged segment's tap timings, which is precisely what the consent copy
promises.

## Sounds

The eight tones in `assets/audio` were generated as decaying sine tones rather than
licensed — see the generator note in `src/lib/sounds.ts`. There is no "wrong answer" buzzer
anywhere in Khil; the failure sound is a soft falling third, because a child must never
learn that the app is testing them.

---

*Khil (खिल) — to bloom. Course deliverable; pair with the PRD for product context.*
