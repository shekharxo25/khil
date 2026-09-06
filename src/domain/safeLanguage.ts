/**
 * The non-negotiable rule, enforced in code.
 *
 * Spec, framing note: "Do not label outputs with condition names (e.g. never
 * show 'autism risk: high') anywhere in the UI or logs that a parent or
 * pediatrician sees."
 *
 * A convention that lives only in a document gets broken. So every string Khil
 * generates about a child — flag titles, flag bodies, clinician system notes,
 * and anything written to the local log — is passed through `assertSafeCopy`
 * before it can leave the domain layer. In development the violation throws; in
 * production the string is replaced with a safe fallback rather than shown.
 *
 * Note what is NOT banned: the word "diagnosis". Khil is required to say "this
 * is not a diagnosis" in three separate places. Banning the token would ban the
 * disclaimer. What is banned is naming a condition, scoring a risk, or using
 * deficit language.
 */

type Rule = { label: string; pattern: RegExp };

const BANNED: Rule[] = [
  // Condition names
  { label: 'autism', pattern: /\bautis(m|tic)\b/i },
  { label: 'ASD', pattern: /\bASD\b/ },
  { label: 'Asperger', pattern: /\basperger'?s?\b/i },
  { label: 'dyslexia', pattern: /\bdyslex(ia|ic)\b/i },
  { label: 'dyspraxia', pattern: /\bdyspraxi(a|c)\b/i },
  { label: 'ADHD', pattern: /\bADHD\b/i },
  { label: 'disorder', pattern: /\bdisorders?\b/i },
  { label: 'syndrome', pattern: /\bsyndromes?\b/i },
  { label: 'spectrum', pattern: /\bspectrum\b/i },
  { label: 'developmental delay', pattern: /\bdevelopmental(ly)?\s+delay(ed|s)?\b/i },

  // Deficit / severity language
  { label: 'deficit', pattern: /\bdeficits?\b/i },
  { label: 'impairment', pattern: /\bimpair(ed|ment|ments)\b/i },
  { label: 'abnormal', pattern: /\babnormal(ity|ities)?\b/i },
  { label: 'pathology', pattern: /\bpatholog(y|ical)\b/i },
  { label: 'disability', pattern: /\bdisabilit(y|ies)\b/i },
  { label: 'symptom', pattern: /\bsymptoms?\b/i },
  { label: 'diagnosed', pattern: /\bdiagnos(ed|is of|tic of)\b/i },

  // Scored risk of any kind
  { label: 'risk score', pattern: /\brisk\s*(score|level|rating|:)/i },
  { label: 'high risk', pattern: /\b(high|low|moderate|elevated)\s+risk\b/i },
  { label: 'severity', pattern: /\bseverit(y|ies)\b/i },
  { label: 'screen positive', pattern: /\b(screens?|screening)\s+positive\b/i },
  { label: 'probability of condition', pattern: /\b\d+\s*%\s*(chance|likelihood|probability)\b/i },
];

export function findUnsafeTerms(text: string): string[] {
  return BANNED.filter(rule => rule.pattern.test(text)).map(rule => rule.label);
}

export function isSafeCopy(text: string): boolean {
  return findUnsafeTerms(text).length === 0;
}

const SAFE_FALLBACK =
  'Something in this week’s play is worth a second look. A specialist can tell you more.';

/**
 * Gate for any generated, child-specific string.
 * Throws during development so the violation is impossible to ship silently.
 */
export function assertSafeCopy(text: string, where: string): string {
  const hits = findUnsafeTerms(text);
  if (hits.length === 0) return text;

  const message = `[khil/safe-language] ${where} contained disallowed term(s): ${hits.join(', ')}`;
  if (__DEV__) {
    throw new Error(message);
  }
  // Production: never render the offending string, and never log the string itself.
  console.warn(message);
  return SAFE_FALLBACK;
}

/**
 * Console/log gate. Spec forbids condition names in logs, not just UI.
 */
export function safeLog(where: string, text: string): void {
  if (!__DEV__) return;
  console.log(`[khil] ${where}: ${assertSafeCopy(text, `log:${where}`)}`);
}

/**
 * A second, stricter gate for anything a PARENT reads.
 *
 * Milestone spec v0.2, §1: "this section should never show the raw behavioral
 * data or 'symptoms' (e.g. never say 'repetitive selections' or 'slow
 * task-switching' — that's for the pediatrician's view only... The parent
 * gets the conclusion in kind language, not the clinical observation itself."
 *
 * `assertSafeCopy` already keeps condition names and deficit language out of
 * every string. This adds a second ban list specific to the parent channel:
 * the technical names of the measures themselves, and any raw number that
 * would make a sentence read as a lab result. A clinician-facing string (the
 * clip review, the clinician note) is expected to contain exactly these
 * terms and must NOT be run through this gate — see `evaluateFlag`, which
 * calls this only for `parent_headline`/`parent_body` and the ordinary gate
 * for `clinician_note`.
 */
const PARENT_ONLY_BANNED: Rule[] = [
  { label: 'task-switching (technical)', pattern: /\btask[-\s]?switch(ing)?\b/i },
  { label: 'repeated selections (technical)', pattern: /\brepeated?\s+selections?\b/i },
  { label: 'repetition rate', pattern: /\brepetition\s+rate\b/i },
  { label: 'latency', pattern: /\blatency\b/i },
  { label: 'commission/omission (technical)', pattern: /\b(commission|omission)\s+(error|rate)/i },
  { label: 'deviation (technical)', pattern: /\bdeviation\b/i },
  { label: 'accuracy (technical)', pattern: /\baccuracy\b/i },
  { label: 'reference range/band', pattern: /\b(reference|typical)\s+(range|band)\b/i },
  { label: 'a raw millisecond figure', pattern: /\b\d+(\.\d+)?\s?(ms|milliseconds)\b/i },
  { label: 'a raw percentage figure', pattern: /\b\d+(\.\d+)?\s?%/ },
];

export function findParentUnsafeTerms(text: string): string[] {
  return [...findUnsafeTerms(text), ...PARENT_ONLY_BANNED.filter(r => r.pattern.test(text)).map(r => r.label)];
}

export function isParentSafeCopy(text: string): boolean {
  return findParentUnsafeTerms(text).length === 0;
}

/** Gate for any string a parent-facing screen renders. See doc comment above. */
export function assertParentSafeCopy(text: string, where: string): string {
  const hits = findParentUnsafeTerms(text);
  if (hits.length === 0) return text;

  const message = `[khil/safe-language:parent] ${where} contained disallowed term(s): ${hits.join(', ')}`;
  if (__DEV__) {
    throw new Error(message);
  }
  console.warn(message);
  return SAFE_FALLBACK;
}

/**
 * Gate for chatbot replies from the Claude API backend.
 *
 * The chat assistant discusses published research, which inevitably names conditions
 * and discusses measures. However, it must never:
 * 1. Tell a parent their child has/shows signs of a condition.
 * 2. State a personalized risk score or severity.
 * 3. Give medical advice beyond "ask the specialist".
 *
 * This gate keeps those rules in code. It uses the core ban list (condition names,
 * deficit language, scored risk) but allows the measure and condition-discussion
 * terms that are fine in research-discussion context.
 */
export function assertChatSafeReply(text: string, where: string): string {
  const unsafe = findUnsafeTerms(text);
  if (unsafe.length === 0) return text;

  const message = `[khil/safe-language:chat] ${where} contained disallowed term(s): ${unsafe.join(', ')}`;
  if (__DEV__) {
    throw new Error(message);
  }
  console.warn(message);
  return SAFE_FALLBACK;
}
