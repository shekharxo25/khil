import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '../ui/Txt';
import { BloomMark } from '../ui/Bloom';
import { color, radius, space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useNav } from '../nav/navigation';
import { planFor } from '../store/types';
import { ageInYears } from '../lib/time';
import { tapFeedback } from '../lib/feedback';
import { clusterByPin } from '../domain/coverage';

/**
 * "Who's playing?" — the account gate.
 *
 * A parent with two children needs their histories kept apart, or the whole
 * screening idea collapses: one child's slow week would quietly contaminate the
 * other's reference comparison. Picking a face here is what keeps every session
 * attached to the right child.
 *
 * On slate rather than paper, because this is the household shell rather than
 * anyone's dashboard, and because the profile colours need a dark field to sing.
 */
export function ProfileGate() {
  const { state, profiles, selectProfile, canAddProfile } = useApp();
  const nav = useNav();
  const insets = useSafeAreaInsets();

  const plan = planFor(state.account);
  const specialist = state.account ? clusterByPin(state.account.pin)?.specialist : undefined;

  const open = (childId: string) => {
    tapFeedback();
    selectProfile(childId);
    nav.reset('parentHome');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.xl }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <BloomMark size={30} tint={color.kite.parrot} />
          <Txt variant="label" tone="chalkFaint">
            Khil
          </Txt>
        </View>

        <Txt variant="display" tone="chalk" center style={styles.heading}>
          Who’s playing?
        </Txt>
        <Txt variant="small" tone="chalkSoft" center>
          Each child keeps their own games and their own progress.
        </Txt>

        <View style={styles.grid}>
          {profiles.map(profile => (
            <Pressable
              key={profile.child_id}
              accessibilityRole="button"
              accessibilityLabel={`Play as ${profile.name}, age ${ageInYears(profile.dob_iso)}`}
              onPress={() => open(profile.child_id)}
              style={styles.tile}
            >
              <View style={[styles.avatar, { backgroundColor: profile.avatar.color }]}>
                <Txt style={styles.avatarGlyph}>{profile.avatar.glyph}</Txt>
              </View>
              <Txt variant="bodyStrong" tone="chalk" numberOfLines={1}>
                {profile.name}
              </Txt>
              <Txt variant="micro" tone="chalkFaint">
                age {ageInYears(profile.dob_iso)}
                {profile.band_override ? ' · custom age group' : ''}
              </Txt>
            </Pressable>
          ))}

          {/* The limit is part of the product, so it is shown as a state rather
              than hidden until someone bumps into it. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              canAddProfile ? 'Add a child' : `Plan limit reached. ${plan.name} covers ${plan.profileLimit}.`
            }
            onPress={() => {
              tapFeedback();
              nav.push(canAddProfile ? 'profileEditor' : 'plans');
            }}
            style={styles.tile}
          >
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Txt variant="display" tone="chalkFaint">
                {canAddProfile ? '+' : '🔒'}
              </Txt>
            </View>
            <Txt variant="bodyStrong" tone="chalkSoft" numberOfLines={1}>
              {canAddProfile ? 'Add a child' : 'Add a child'}
            </Txt>
            <Txt variant="micro" tone="chalkFaint">
              {canAddProfile
                ? `${plan.profileLimit - profiles.length} space${plan.profileLimit - profiles.length === 1 ? '' : 's'} left`
                : `${plan.name} covers ${plan.profileLimit}`}
            </Txt>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.push('plans')}
            hitSlop={8}
            style={styles.footerRow}
          >
            <Txt variant="small" tone="chalkSoft">
              {plan.name}
            </Txt>
            <Txt variant="small" tone="noticeOnSlate">
              Manage plan ›
            </Txt>
          </Pressable>

          {profiles.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => nav.push('profileEditor', { childId: profiles[0].child_id })}
              hitSlop={8}
            >
              <Txt variant="small" tone="chalkFaint" center>
                Edit profiles
              </Txt>
            </Pressable>
          ) : null}

          {specialist ? (
            <Txt variant="micro" tone="chalkFaint" center style={styles.specialist}>
              Matched to {specialist.name}, {specialist.clinic} · PIN {state.account?.pin}
            </Txt>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.slate },
  content: { paddingHorizontal: space.xl, gap: space.md, alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xl },
  heading: { marginTop: space.sm },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.xl,
    marginTop: space.xxl,
  },
  tile: { alignItems: 'center', gap: 6, width: 124 },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  avatarEmpty: {
    backgroundColor: color.slateRaise,
    borderWidth: 2,
    borderColor: color.slateLine,
    borderStyle: 'dashed',
  },
  avatarGlyph: { fontSize: 48 },
  footer: { marginTop: space.xxxl, gap: space.lg, alignSelf: 'stretch' },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.slateLine,
    paddingTop: space.lg,
  },
  specialist: { marginTop: space.sm },
});
