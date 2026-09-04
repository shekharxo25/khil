import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Chip, Row } from '../ui/Bits';
import { color, radius, space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav, useParams } from '../nav/navigation';
import { AVATAR_COLORS, AVATAR_GLYPHS, planFor } from '../store/types';
import { ageInMonths, parseDob } from '../lib/time';
import { formatDobInput } from '../lib/dob';

const MIN_MONTHS = 24;
const MAX_MONTHS = 83;

/**
 * Create or edit one child.
 *
 * Name and date of birth only — the date of birth is what selects the games and
 * the reference ranges, so there is still no "pick an age group" step here.
 * (That override lives on the game picker, where it belongs: it is a choice
 * about today's play, not a fact about the child.)
 */
export function ProfileEditor() {
  const { state, profiles, addProfile, updateProfile, removeProfile, selectProfile, suggestAvatar } =
    useApp();
  const nav = useNav();
  const params = useParams<'profileEditor'>();
  const existing = profiles.find(p => p.child_id === params?.childId) ?? null;
  const isFirst = profiles.length === 0;

  const [name, setName] = useState(existing?.name ?? '');
  const [dob, setDob] = useState(
    existing ? formatDobFromIso(existing.dob_iso) : '',
  );
  const [avatar, setAvatar] = useState(existing?.avatar ?? suggestAvatar());
  const [limitHit, setLimitHit] = useState(false);

  const dobDate = useMemo(() => parseDob(dob), [dob]);
  const months = dobDate ? ageInMonths(dobDate.toISOString()) : null;

  const ageHint = (() => {
    if (dob.length === 0) return undefined;
    if (!dobDate) return 'Use the format DD / MM / YYYY';
    if (months === null) return undefined;
    if (months < MIN_MONTHS) return 'Khil’s games start at age 2.';
    if (months > MAX_MONTHS) return 'Khil’s games are designed for ages 2 to 6.';
    return `Age ${Math.floor(months / 12)}y ${months % 12}m — games and comparison ranges will match this.`;
  })();

  const ageOk = months !== null && months >= MIN_MONTHS && months <= MAX_MONTHS;
  const ready = name.trim().length > 1 && ageOk;
  const plan = planFor(state.account);

  const onSave = () => {
    if (!ready || !dobDate) return;
    if (existing) {
      updateProfile(existing.child_id, { name: name.trim(), dob_iso: dobDate.toISOString(), avatar });
      nav.back();
      return;
    }
    const result = addProfile({ name, dobIso: dobDate.toISOString(), avatar });
    if (!result.ok) {
      setLimitHit(true);
      return;
    }
    selectProfile(result.profile.child_id);
    nav.reset(isFirst ? 'parentHome' : 'profileGate');
  };

  return (
    <Screen
      backLabel={isFirst ? undefined : 'back'}
      eyebrow={existing ? 'Edit profile' : 'New profile'}
      title={existing ? existing.name : isFirst ? 'Add your first child' : 'Add a child'}
      footer={
        <>
          <Button label={existing ? 'Save changes' : 'Add child'} onPress={onSave} disabled={!ready} />
          {existing && profiles.length > 1 ? (
            <Button
              label={`Remove ${existing.name} and their history`}
              variant="danger"
              onPress={() => {
                removeProfile(existing.child_id);
                nav.reset('profileGate');
              }}
            />
          ) : null}
        </>
      }
    >
      {limitHit ? (
        <Card tone="notice" label="Plan limit reached">
          <Txt variant="body" tone="notice">
            {plan.name} covers {plan.profileLimit} {plan.profileLimit === 1 ? 'child' : 'children'}.
          </Txt>
          <View style={styles.mt}>
            <Button label="See plans" variant="notice" onPress={() => nav.push('plans')} />
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={styles.form}>
          <Field
            label="Child’s name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Aarav"
            autoCapitalize="words"
            maxLength={40}
          />
          <Field
            label="Date of birth"
            value={dob}
            onChangeText={next => setDob(formatDobInput(next))}
            placeholder="DD / MM / YYYY"
            keyboardType="number-pad"
            maxLength={10}
            hint={ageHint}
            hintTone={ageHint && !ageOk && dob.length >= 8 ? 'notice' : 'faint'}
          />
        </View>
      </Card>

      <Card label="Pick a colour">
        <Row gap={space.md} wrap>
          {AVATAR_COLORS.map(c => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Colour ${c}`}
              accessibilityState={{ selected: avatar.color === c }}
              onPress={() => setAvatar(a => ({ ...a, color: c }))}
              style={[
                styles.swatch,
                { backgroundColor: c },
                avatar.color === c && styles.swatchOn,
              ]}
            />
          ))}
        </Row>
      </Card>

      <Card label="Pick a badge">
        <Row gap={space.md} wrap>
          {AVATAR_GLYPHS.map(g => (
            <Pressable
              key={g}
              accessibilityRole="button"
              accessibilityLabel={`Badge ${g}`}
              accessibilityState={{ selected: avatar.glyph === g }}
              onPress={() => setAvatar(a => ({ ...a, glyph: g }))}
              style={[styles.glyphTile, avatar.glyph === g && styles.glyphTileOn]}
            >
              <Txt style={styles.glyph}>{g}</Txt>
            </Pressable>
          ))}
        </Row>
      </Card>

      <Card tone="sunk">
        <Row gap={space.lg}>
          <View style={[styles.preview, { backgroundColor: avatar.color }]}>
            <Txt style={styles.previewGlyph}>{avatar.glyph}</Txt>
          </View>
          <View style={styles.grow}>
            <Txt variant="bodyStrong">{name.trim() || 'Your child'}</Txt>
            <Txt variant="small" tone="soft">
              This is how they’ll pick themselves at the start.
            </Txt>
            <View style={styles.mt}>
              <Chip
                label={`${profiles.length + (existing ? 0 : 1)} of ${plan.profileLimit} on ${plan.name}`}
                tone="neutral"
              />
            </View>
          </View>
        </Row>
      </Card>
    </Screen>
  );
}

function formatDobFromIso(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  grow: { flex: 1 },
  mt: { marginTop: space.md },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  swatchOn: { borderColor: color.ink },
  glyphTile: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceSunk,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  glyphTileOn: { borderColor: color.ink, backgroundColor: color.surface },
  glyph: { fontSize: 24 },
  preview: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewGlyph: { fontSize: 34 },
});
