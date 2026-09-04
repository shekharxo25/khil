import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../store/AppStore';
import { useNav, useParams } from '../nav/navigation';
import { ageInMonths } from '../lib/time';
import { makeId } from '../lib/id';
import { stopSpeaking } from '../lib/speech';
import { prepareAudio } from '../lib/sounds';
import { planSession, sessionNumberInBlock, type PlannedGame } from '../domain/rotation';
import { AGE_BANDS, bandForAge } from '../domain/norms';
import { GAMES, isGameInBand, type GameId } from '../domain/games';
import type { RoundEvent, SessionRecord } from '../domain/telemetry';
import { createRecorder } from '../game/recorder';
import { PatternGame } from '../game/PatternGame';
import { LanguageGame } from '../game/LanguageGame';
import { BeatGame } from '../game/BeatGame';
import { SequenceGame } from '../game/SequenceGame';
import { InhibitGame } from '../game/InhibitGame';
import { RhymeGame } from '../game/RhymeGame';
import { TraceGame } from '../game/TraceGame';
import { QuantityGame } from '../game/QuantityGame';
import type { GameProps } from '../game/types';

/**
 * Runs one session: the 1–2 games the rotation planner chose (or the parent's
 * own pick from the game picker), back to back, inside the same recorder so
 * task-switch timing survives the game change.
 *
 * Everything about a session is decided once, on mount. Re-planning mid-session
 * would change the progress denominator under the child's feet.
 */

const GAME_COMPONENTS: Record<GameId, React.ComponentType<GameProps>> = {
  pattern: PatternGame,
  language: LanguageGame,
  beat: BeatGame,
  sequence: SequenceGame,
  inhibit: InhibitGame,
  rhyme: RhymeGame,
  trace: TraceGame,
  quantity: QuantityGame,
};

export function SessionRunner() {
  const { state, child, sessions, completeSession } = useApp();
  const nav = useNav();
  const params = useParams<'session'>();

  const [gameIndex, setGameIndex] = useState(0);
  const finishedRef = useRef(false);

  const setup = useMemo(() => {
    const realAgeMonths = child ? ageInMonths(child.dob_iso) : 48;
    const override = child?.band_override ?? null;
    const activeBand = override
      ? (AGE_BANDS.find(b => b.id === override) ?? bandForAge(realAgeMonths))
      : bandForAge(realAgeMonths);
    // A representative age within the chosen band, so age-appropriate content
    // and reference-band lookups both land inside the band that was picked.
    const playAgeMonths = override ? activeBand.minMonths + 6 : realAgeMonths;

    const recommended = planSession({
      ageMonths: playAgeMonths,
      sessions,
      mvpOnly: state.settings.mvpOnly,
    });

    const chosenIds = params?.gameIds
      ?.filter(id => isGameInBand(id, playAgeMonths))
      .slice(0, 2);
    const plan =
      chosenIds && chosenIds.length > 0
        ? {
            ...recommended,
            games: chosenIds.map(
              (id): PlannedGame => ({
                game_id: id,
                rounds:
                  recommended.games.find(g => g.game_id === id)?.rounds ?? GAMES[id].rounds,
              }),
            ),
          }
        : recommended;

    const sessionId = makeId('session');
    return {
      ageMonths: playAgeMonths,
      offBand: override !== null,
      plan,
      sessionId,
      seed: Math.floor(Math.random() * 1e9),
      startedAt: Date.now(),
      sessionNumber: sessionNumberInBlock(sessions.filter(s => !s.abandoned).length),
      recorder: createRecorder({
        childId: child?.child_id ?? 'unknown',
        sessionId,
        ageMonths: playAgeMonths,
      }),
    };
    // Deliberately mount-only: see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hardware back must not drop a child out of a round mid-tap.
  useEffect(() => {
    nav.setBackLocked(true);
    void prepareAudio();
    return () => {
      nav.setBackLocked(false);
      stopSpeaking();
    };
  }, [nav]);

  const persist = useCallback(
    (abandoned: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      const rounds = setup.recorder.rounds();
      const record: SessionRecord = {
        session_id: setup.sessionId,
        child_id: child?.child_id ?? 'unknown',
        started_at: setup.startedAt,
        ended_at: Date.now(),
        game_ids: setup.plan.games.map(g => g.game_id),
        age_months: setup.ageMonths,
        seed: setup.seed,
        rounds,
        abandoned,
        off_band: setup.offBand,
      };

      if (rounds.length === 0) {
        // Nothing was played — there is nothing worth keeping.
        nav.reset('parentHome');
        return;
      }

      // A session the child walked out of is stored, but the flag engine skips
      // it: an abandoned session says something about the day, not the child.
      const flag = completeSession(record);
      if (abandoned) nav.reset('parentHome');
      else nav.reset('sessionComplete', { flagId: flag?.id });
    },
    [child, completeSession, nav, setup],
  );

  const onGameFinish = useCallback(() => {
    if (gameIndex + 1 >= setup.plan.games.length) persist(false);
    else setGameIndex(i => i + 1);
  }, [gameIndex, persist, setup.plan.games.length]);

  const onRound = useCallback((_event: RoundEvent) => {
    // Rounds are already inside the recorder; this hook exists for live overlays.
  }, []);

  if (!child) {
    return <View />;
  }

  const planned = setup.plan.games[Math.min(gameIndex, setup.plan.games.length - 1)];
  const Game = GAME_COMPONENTS[planned.game_id];

  return (
    <Game
      key={`${setup.sessionId}:${planned.game_id}:${gameIndex}`}
      childName={child.name}
      ageMonths={setup.ageMonths}
      rounds={planned.rounds}
      seed={setup.seed}
      recorder={setup.recorder}
      gameIndex={gameIndex}
      gameCount={setup.plan.games.length}
      sessionNumber={setup.sessionNumber}
      showPromptText={state.settings.showPromptText}
      showCaptureDebug={state.settings.showCaptureDebug}
      voiceEnabled={state.settings.voiceEnabled}
      onRound={onRound}
      onFinish={onGameFinish}
      onExit={() => persist(true)}
    />
  );
}
