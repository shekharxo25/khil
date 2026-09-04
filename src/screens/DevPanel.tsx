import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip, Divider, Row } from '../ui/Bits';
import { color, radius, space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav } from '../nav/navigation';
import { evaluateFlag, FLAG_RULES } from '../domain/flagEngine';
import { runSelfTests } from '../domain/selftest';
import {
  REFERENCE_NOTE,
  REFERENCE_PROVENANCE,
  REFERENCE_SOURCES_NEEDED,
} from '../domain/norms';
import { formatSignalValue, SIGNAL_META } from '../domain/signals';
import { moduleName } from '../domain/games';
import { relativeDay } from '../lib/time';

/**
 * Settings, demo controls, and — more importantly — the audit surface.
 *
 * A screening aid that will not show its own trigger conditions is asking for
 * trust it has not earned. This screen shows exactly which criteria are met
 * right now, which are not, and what the engine is reading, along with the
 * self-checks that enforce the spec's language rule.
 */
export function DevPanel() {
  const { state, child, sessions, flags, setSettings, seedDemoHistory, resetAll } = useApp();
  const nav = useNav();
  const [showJson, setShowJson] = useState(false);

  const evaluation = useMemo(
    () =>
      child
        ? evaluateFlag(child.child_id, sessions, flags)
        : null,
    [child, sessions, flags],
  );

  const checks = useMemo(() => runSelfTests(), []);
  const failures = checks.filter(c => !c.passed);

  const lastRound = useMemo(() => {
    const last = sessions[sessions.length - 1];
    return last?.rounds[last.rounds.length - 1] ?? null;
  }, [sessions]);

  return (
    <Screen backLabel="progress" title="Settings & audit">
      <Card label="Play settings">
        <Toggle
          label="Spoken instructions"
          hint="Instructions are spoken, never written. Turning this off is for silent rooms only."
          value={state.settings.voiceEnabled}
          onChange={v => setSettings({ voiceEnabled: v })}
        />
        <Divider style={styles.divider} />
        <Toggle
          label="Show prompt text during play"
          hint="Breaks the pre-literate rule from the wireframes. For demoing on a muted device."
          value={state.settings.showPromptText}
          onChange={v => setSettings({ showPromptText: v })}
        />
        <Divider style={styles.divider} />
        <Toggle
          label="Presenter overlay"
          hint="Shows the passive-capture strip and live telemetry during a session."
          value={state.settings.showCaptureDebug}
          onChange={v => setSettings({ showCaptureDebug: v })}
        />
        <Divider style={styles.divider} />
        <Toggle
          label="MVP games only"
          hint="Spec §5 scope: rotate only Spot the Odd One and Point to the One I Say."
          value={state.settings.mvpOnly}
          onChange={v => setSettings({ mvpOnly: v })}
        />
      </Card>

      {/* Live flag-engine state. */}
      <Card label="Flag engine — right now">
        {evaluation ? (
          <>
            <Row style={styles.between}>
              <Txt variant="bodyStrong">
                {evaluation.eligible ? 'All conditions met' : 'Holding — conditions not met'}
              </Txt>
              <Chip
                label={`${evaluation.criteria.filter(c => c.met).length}/${evaluation.criteria.length}`}
                tone={evaluation.eligible ? 'notice' : 'neutral'}
              />
            </Row>

            <View style={styles.criteria}>
              {evaluation.criteria.map(criterion => (
                <Row key={criterion.id} gap={space.sm} align="flex-start">
                  <Txt variant="small" tone={criterion.met ? 'positive' : 'faint'}>
                    {criterion.met ? '✓' : '○'}
                  </Txt>
                  <View style={styles.grow}>
                    <Txt variant="small" tone={criterion.met ? 'ink' : 'soft'}>
                      {criterion.label}
                    </Txt>
                    <Txt variant="micro" tone="faint">
                      {criterion.detail}
                    </Txt>
                  </View>
                </Row>
              ))}
            </View>

            <Divider style={styles.divider} />
            <Txt variant="label" tone="faint">
              Signals in the last {FLAG_RULES.windowDays} days
            </Txt>
            {evaluation.windowSignals.length === 0 ? (
              <Txt variant="small" tone="soft" style={styles.mtSm}>
                None. Everything measured sits inside the age reference range.
              </Txt>
            ) : (
              <View style={styles.signals}>
                {evaluation.windowSignals.map((signal, index) => (
                  <Row key={`${signal.session_id}-${signal.id}-${index}`} style={styles.between}>
                    <View style={styles.grow}>
                      <Txt variant="small">{SIGNAL_META[signal.id].measure}</Txt>
                      <Txt variant="micro" tone="faint">
                        {moduleName(signal.game_id)} · {formatSignalValue(signal)} vs{' '}
                        {signal.expected_range}
                      </Txt>
                    </View>
                    <Chip label={`×${signal.strength.toFixed(2)}`} tone="neutral" />
                  </Row>
                ))}
              </View>
            )}
          </>
        ) : (
          <Txt variant="small" tone="soft">
            No child profile yet.
          </Txt>
        )}
      </Card>

      <Card label="Demo data">
        <Txt variant="small" tone="soft">
          Both options generate real telemetry and run it through the same engine. Nothing
          is hard-coded — turn the numbers down and the flag disappears.
        </Txt>
        <View style={styles.stack}>
          <Button
            label="Seed 12 days of ordinary play"
            variant="secondary"
            onPress={() => seedDemoHistory('typical')}
          />
          <Button
            label="Seed 12 days with a clustered pattern"
            variant="secondary"
            onPress={() => seedDemoHistory('cluster')}
          />
          <Button
            label="Erase everything on this device"
            variant="danger"
            onPress={() => {
              resetAll();
              nav.reset('onboarding');
            }}
          />
        </View>
      </Card>

      <Card label="Self-checks">
        <Row style={styles.between}>
          <Txt variant="bodyStrong">
            {failures.length === 0 ? 'All checks passing' : `${failures.length} failing`}
          </Txt>
          <Chip
            label={`${checks.length - failures.length}/${checks.length}`}
            tone={failures.length === 0 ? 'positive' : 'notice'}
          />
        </Row>
        <View style={styles.criteria}>
          {checks.map(check => (
            <Row key={check.name} gap={space.sm} align="flex-start">
              <Txt variant="small" tone={check.passed ? 'positive' : 'notice'}>
                {check.passed ? '✓' : '✕'}
              </Txt>
              <View style={styles.grow}>
                <Txt variant="small">{check.name}</Txt>
                {!check.passed ? (
                  <Txt variant="micro" tone="notice">
                    {check.detail}
                  </Txt>
                ) : null}
              </View>
            </Row>
          ))}
        </View>
      </Card>

      <Card tone="notice" label="Reference framework">
        <Txt variant="small" tone="notice">
          Status: {REFERENCE_PROVENANCE}
        </Txt>
        <Txt variant="small" tone="notice" style={styles.mtSm}>
          {REFERENCE_NOTE}
        </Txt>
        <Txt variant="label" tone="notice" style={styles.mtMd}>
          Still to source
        </Txt>
        <View style={styles.stackTight}>
          {REFERENCE_SOURCES_NEEDED.map(item => (
            <Txt key={item} variant="micro" tone="notice">
              · {item}
            </Txt>
          ))}
        </View>
      </Card>

      <Card label="Stored data">
        <Txt variant="small" tone="soft">
          {sessions.length} sessions · {sessions.reduce((n, s) => n + s.rounds.length, 0)}{' '}
          rounds · {flags.length} flags. All of it on this device only.
        </Txt>
        {sessions.length > 0 ? (
          <Txt variant="micro" tone="faint" style={styles.mtSm}>
            Most recent: {relativeDay(sessions[sessions.length - 1].ended_at)}
          </Txt>
        ) : null}

        <Pressable onPress={() => setShowJson(v => !v)} style={styles.mtMd} hitSlop={8}>
          <Txt variant="small" tone="brand">
            {showJson ? 'Hide' : 'Show'} the last recorded round (spec §4 schema) ›
          </Txt>
        </Pressable>

        {showJson && lastRound ? (
          <ScrollView horizontal style={styles.json} showsHorizontalScrollIndicator={false}>
            <Txt variant="micro" tone="soft" style={styles.mono}>
              {JSON.stringify(lastRound, null, 2)}
            </Txt>
          </ScrollView>
        ) : null}
      </Card>
    </Screen>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Row align="flex-start" gap={space.md}>
      <View style={styles.grow}>
        <Txt variant="bodyStrong">{label}</Txt>
        <Txt variant="micro" tone="faint" style={styles.mtXs}>
          {hint}
        </Txt>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: color.brand, false: color.hairlineStrong }}
        thumbColor="#FFFFFF"
      />
    </Row>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  grow: { flex: 1 },
  divider: { marginVertical: space.lg },
  criteria: { marginTop: space.md, gap: space.md },
  signals: { marginTop: space.sm, gap: space.md },
  stack: { marginTop: space.lg, gap: space.sm },
  stackTight: { marginTop: space.sm, gap: 2 },
  mtXs: { marginTop: 2 },
  mtSm: { marginTop: space.sm },
  mtMd: { marginTop: space.md },
  json: {
    marginTop: space.md,
    backgroundColor: color.surfaceSunk,
    borderRadius: radius.md,
    padding: space.md,
    maxHeight: 260,
  },
  mono: { fontVariant: ['tabular-nums'] },
});
