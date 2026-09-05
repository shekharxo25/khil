# Khil

खिल — "to bloom". A voice-first play session for children aged 2–6 that quietly records
**how** a child responds, across an account that can hold several children, and a
parent/specialist layer that only speaks up when the same unusual pattern turns up across
several sessions and more than one kind of game.

Built with Expo SDK 57 (React Native 0.86, React 19, TypeScript). Runs in Expo Go.

Implements the *Khil — Game Design & Interface Spec* and the *Khil wireframe set v0.1*, plus
four rounds of follow-on direction from the person commissioning it — see
[Beyond the original spec](#beyond-the-original-spec) for what changed and why.

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

1. Create an account with PIN **380015** (covered PINs are listed under the field), accept
   the two consents, and add a first child with a DOB that makes them 3–6.
2. `settings ›` → **Seed 12 days with a clustered pattern**.
3. Back to the dashboard: the flag is there, with a full report and a specialist portal
   behind *Specialist portal ›*.

From the dashboard, *Your account ›* opens the profile gate — add a second child (up to the
plan's limit) to see that their history starts empty and stays completely separate from the
first child's flag.

**Seed 12 days of ordinary play** produces the same volume of data with no flag. Both
options generate real telemetry rows and run them through the same engine — no flag
anywhere in this project is hard-coded.

Useful toggles in `settings ›`:

| Toggle | What it does |
| --- | --- |
| Presenter overlay | Shows the passive-capture strip and live telemetry during play. Off in real play. |
| Show prompt text | Renders the spoken instruction as text. Breaks the pre-literate rule; for demoing on a muted laptop. |
| MVP games only | Restricts rotation to Spot the Odd One and Point to the One I Say, per the spec's scope note. |
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
| 01 Onboarding & consent | `screens/Onboarding.tsx` | PIN validated against covered clusters with a waitlist state (2) · consent names the flagged segment, not full recordings (3) · a second, separate checkbox sets diagnostic expectations up front (4) |
| 02 Child game session | `game/GameFrame.tsx` + eight games | Every instruction spoken (1) · tap/drag only, 88pt minimum targets (2) · session length shown to the parent before hand-off, never to the child (3) · capture is silent in real play (4) |
| 03 Parent dashboard | `screens/ParentDashboard.tsx` | Progress framing first (1) · calm plain-language flag, indigo not red, no score (2) · one-tap booking to the mapped specialist (3) · "View full report" (4) |
| 04 Flag detail | `screens/FlagDetail.tsx` | Behavioural description only (1) · dedicated reassurance block before the decision (2) · "Remind me later" is a real option (3) |
| 05 Specialist portal | `screens/PediatricianList.tsx` | Scope limited to the PIN cluster, now across every child on the account (1) · review action only on active flags (2) · capacity indicator (3) |
| 06 Clip review | `screens/ClipReview.tsx` | Only the flagged segment is playable (1) · identical non-diagnostic language to the parent's report (2) · outcome tagging feeds the flag-usefulness measure (3) |

Wireframe 01's note 1 — date of birth drives content, no manual age picker — moved with the
child: it now governs `screens/ProfileEditor.tsx`, since a household's PIN and a child's
birthday are answered at different moments once an account can hold more than one child.

Screens beyond the original set: **Profile gate** (who's playing), **Profile editor**
(add/edit a child), **Plans** (how many children an account covers), **Game picker** (choose
today's games and, separately, today's age group), **Session intro** (the parent-side
hand-off, where the spec's attention-span reassurance belongs), and **Six skill areas**,
which makes the dashboard's bloom auditable instead of decorative.

## Games

| Game | File | Logged |
| --- | --- | --- |
| Spot the Odd One | `game/PatternGame.tsx` | latency from prompt end, correct/incorrect, repeated taps on the same wrong tile, difficulty tier |
| Point to the One I Say | `game/LanguageGame.tsx` | latency, accuracy by word tier, whether the child dwelt before choosing |
| Copy My Beat | `game/BeatGame.tsx` | tap accuracy, inter-tap timing deviation, max sequence length, error type |
| What Happens Next | `game/SequenceGame.tsx` | final order correct, swaps before settling, time to first drag, whether the child re-ordered after audio feedback |
| Wake the Sleepy Ones | `game/InhibitGame.tsx` | commission errors (tapped when it should have waited) and omission errors (no response when one was wanted), separately |
| Sounds the Same | `game/RhymeGame.tsx` | latency and accuracy on rhyme-matching and initial-sound-matching rounds |
| Follow the Kite String | `game/TraceGame.tsx` | mean deviation from a traced path (as a share of the canvas diagonal), lift-offs, path completion |
| Which Has More? | `game/QuantityGame.tsx` | accuracy on near-ratio (hard) vs. obvious (easy) non-symbolic quantity comparisons |

The first four are spec §2's original set, and their difficulty escalates exactly as
described: colour-only → shape → subtle pattern for Spot the Odd One, and named object →
same-category distractors → *category* prompt for Point to the One I Say, which is what
separates comprehension from rote picture-word matching.

Spec §3 says the frame is the template and only the centre tile changes. That is literal
here across all eight games: `GameFrame` owns the voice bar, progress meter, "Session X of
10" counter and hold-to-exit; a game renders only its centre tile and implements one
`GameProps` contract.

**A gaze-tracking game (front camera) is deliberately not built.** The spec says not to
build it until the consent flow and the on-device-only processing story are solid. Khil
touches no camera and no microphone, which is a claim the onboarding screen makes to
parents — adding gaze tracking would make that claim false.

---

## Beyond the original spec

Four requests came in after the first build, and each one changes something structural
rather than cosmetic.

**Accounts, not just children.** The original build assumed one child per install. A parent
with two or three children wants to watch all of them, with separate histories — otherwise
one child's slow week would quietly sit in the same comparison pool as another's. So the
household (PIN, specialist, consent, plan) and the child (name, DOB, avatar, play history)
are now separate records. `store/types.ts` has the full model; `AppStore.tsx` filters
sessions and flags by the active child everywhere, and removing a profile removes its
history with it rather than leaving it to quietly feed a sibling's numbers.

**Plans, sized only by how many children an account covers.** Three tiers
(`store/types.ts` → `PLANS`), Basic/Family/Family+, at 1/2/4 children. No plan gates a game,
a skill area, or the flag engine itself — see `screens/Plans.tsx` for why: putting the
screening logic behind a paywall would mean choosing not to tell a parent something Khil
already noticed, and there's no version of that this product can defend. The limit is shown
as a real state at the profile gate (a locked "add a child" tile), not discovered by
surprise.

**A game picker, and a per-session age-group override.** `screens/GamePicker.tsx` offers the
rotation's own pick first — it is better than a parent at spotting which skill area went
untouched — but lets a parent choose any game (up to the two-game session cap) and,
separately, play a different age band's content for one session. An override is real and
saved, but the resulting session is marked `off_band` and excluded from the flag engine:
comparing a 4-year-old's timings against the 2-year-old reference band would not mean
anything in either direction. The dashboard, session intro and game picker all say this
plainly when an override is active.

**Wider behavioural coverage.** The request was for the app to cover more of what shows up
in early childhood as attention, impulse-control, reading-precursor, writing-precursor and
number-sense concerns. The spec's own framing note is unambiguous that condition names never
touch the UI or logs, so the honest way to do this is what the original four games already
did: add games that surface the *behavioural* correlates, in plain language, with no
diagnostic mapping anywhere near the product. Four games and four reference metrics were
added — `Wake the Sleepy Ones` (commission/omission errors, a standard go/no-go measure),
`Sounds the Same` (rhyme and initial-sound awareness), `Follow the Kite String`
(grapho-motor tracing deviation), and `Which Has More?` (non-symbolic quantity comparison).
The correspondence between what a game measures and the concern areas it was designed to
help surface is documented **here, and only here**:

| Game measures (shown to a parent/clinician) | Motivating concern areas (never shown anywhere in the app) |
| --- | --- |
| Pattern recognition, task-switch cost, repeated selections | attention/flexibility concerns generally |
| Language response, shared attention, rhyme/initial-sound matching | language-delay and early literacy concerns |
| Movement & rhythm, sequencing/working memory | motor-coordination and sequencing concerns |
| Commission/omission errors on a wait-and-tap task | impulsivity/inattention concerns |
| Rhyme and initial-sound awareness specifically | early reading-precursor (phonological awareness) concerns |
| Grapho-motor tracing steadiness | early writing-precursor (fine motor) concerns |
| Non-symbolic quantity comparison | early number-sense concerns |
| A cluster spanning several of the above at once, repeatedly | the general "worth a second look" case the spec describes |

No signal, domain, game, or line of UI copy maps one-to-one onto a single named condition,
by design — see `domain/safeLanguage.ts` and the self-check "Every domain and module name is
behavioural". That is a deliberate reading of the request: cover the *behaviours* clinicians
actually screen for at this age, not attach diagnostic labels a screening toy has no
business assigning.

**Visual identity.** The palette, type and the bloom (below) replaced the earlier
cream-and-marigold system, which read as templated. See
[`ui/Bloom.tsx`](src/ui/Bloom.tsx) and `theme/tokens.ts` for the reasoning behind the choices.

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

- What Happens Next's *time to first drag* and *swaps beyond the minimum* are recorded in the shared
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

## Design

"Slate & Kite". The child's play surface and the account shell sit on a dark slate ground —
the school patti every Indian child learns on — because saturated targets read harder there
than on pastel, which matters when the thing being measured is how fast a child finds the
odd one out. Play and profile colours come from kite paper: Uttarayan, Ahmedabad's festival,
is where the magenta/parrot/cobalt/saffron palette in `theme/tokens.ts` comes from. Parent
and clinician surfaces are chalk-washed paper — cool, quiet, deliberately not the warm cream
this kind of app defaults to. Type is Baloo 2 (display) and Anek Latin (everything else),
both from Ek Type, a foundry that draws Latin and Devanagari together.

The signature element is the **bloom** (`ui/Bloom.tsx`): ten petals, one per skill area,
filling in as the week's play covers them. It replaces the earlier progress-bar-plus-stat-row
because a bar can only say *how much*; the bloom says *how much of what*, and a lopsided week
looks visibly lopsided rather than merely short.

The flag card is **indigo, not amber and not red** — wireframe 03's note 2 requires the flag
to never read as alarm, and every warm notice colour fights that. Blue reads as "look at
this", which is the register a screening aid needs when it is right only some of the time.

## Layout

```
src/
  domain/        pure decision logic — no React, no storage, independently testable
    domains.ts     the ten skill areas behind the bloom
    games.ts       game registry: age bands, domains, round counts
    norms.ts       age reference bands + provenance  ← the file to replace with sourced norms
    tiers.ts       difficulty schedule (and therefore what a "rule change" is)
    telemetry.ts   spec §4 schema, snake_case so doc and code cannot drift
    signals.ts     per-visit measures → signals, incl. the switch-cost probe
    flagEngine.ts  the cluster rule
    safeLanguage.ts the language gate
    rotation.ts    1–2 games per session, all ten domains twice a week
    coverage.ts    PIN → specialist mapping
    selftest.ts    the invariants, run in-app and in CI
  game/          the shared frame, the eight games, the round recorder
  screens/       one file per screen (wireframe-mapped and beyond)
  store/         AsyncStorage-backed state: account + child profiles; demo history generator
  ui/            design system primitives, incl. the bloom
  nav/           small typed stack (owns the back-lock during a session)
  theme/         tokens (palette, type) and font loading
scripts/
  verify-domain.ts   headless gate: npm run verify
```

`src/domain` imports nothing from React, React Native or storage. That is what lets the
whole decision layer run in plain Node, which is what `npm run verify` does.

## Data and privacy

Everything lives on the device, in one AsyncStorage key, for every child on the account. A
round is a handful of numbers — timestamps, which tile was touched, whether it matched.
There is no camera, no microphone, no network call, and no analytics. The specialist portal
in this build reads the same local store, which is how the demo shows both sides; a real
deployment would send only the flag summary and the flagged segment's tap timings, which is
precisely what the consent copy promises.

## Sounds

The eight tones in `assets/audio` were generated as decaying sine tones rather than
licensed — see the generator note in `src/lib/sounds.ts`. There is no "wrong answer" buzzer
anywhere in Khil; the failure sound is a soft falling third, because a child must never
learn that the app is testing them.

---

*Khil (खिल) — to bloom. Course deliverable; pair with the PRD for product context.*
#   K h i l - F i n a l - A p p  
 #   K h i l - F i n a l - A p p  
 