import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip, Row } from '../ui/Bits';
import { space } from '../theme/tokens';
import { useApp } from '../store/AppStore';
import { useParams } from '../nav/navigation';
import { isParentVisible } from '../domain/flagEngine';
import { DOMAINS } from '../domain/domains';
import { reportCard, pastPeriods, STATUS_LABEL, STATUS_TONE } from '../domain/reportCard';
import { exportReport } from '../lib/reportExport';
import { formatDate } from '../lib/time';

/**
 * One past report-card period. Milestone spec §1: "A simple list of past
 * report-card periods (e.g. monthly), so parents can look back, plus a way to
 * download/share a report (useful before a pediatrician visit)."
 *
 * Reuses the same `reportCard()` function the live dashboard uses, just with
 * `now` pinned to the period's end date — a past period and the current one
 * are answerable to identical logic, not a separate "history" data model.
 */
export function ReportHistory() {
  const { child, sessions, flags } = useApp();
  const { periodIndex } = useParams<'reportHistory'>();
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  const periods = useMemo(() => pastPeriods(sessions), [sessions]);
  const period = periods.find(p => p.index === periodIndex) ?? periods[0];
  const report = useMemo(
    () => (period ? reportCard(sessions, period.end) : []),
    [sessions, period],
  );
  // A PDF handed to an outside doctor gets the same plain-language conclusion
  // a parent sees on the dashboard — never the raw evidence. See reportExport.ts.
  const visibleFlag = period ? flags.find(f => isParentVisible(f, period.end)) : undefined;

  const onExport = async () => {
    if (!period) return;
    setExporting(true);
    setExportNote(null);
    const result = await exportReport({
      childName: child?.name ?? 'Your child',
      periodLabel: period.label,
      report,
      flagSummary: visibleFlag?.parent_body ?? null,
    });
    setExporting(false);
    if (!result.ok) setExportNote(result.reason ?? 'Couldn’t generate the report just now.');
  };

  if (!period) {
    return (
      <Screen backLabel="progress" title="Past reports">
        <Txt variant="body" tone="soft">
          No reports yet — check back after a few sessions.
        </Txt>
      </Screen>
    );
  }

  return (
    <Screen
      backLabel="progress"
      eyebrow={period.index === 0 ? 'Current period' : 'Past report'}
      title={period.label}
      footer={
        <>
          <Button
            label={exporting ? 'Preparing…' : 'Share or save this report'}
            glyph="⇪"
            onPress={onExport}
            disabled={exporting}
          />
          {exportNote ? (
            <Txt variant="micro" tone="notice" center>
              {exportNote}
            </Txt>
          ) : null}
        </>
      }
    >
      <Card tone="sunk">
        <Txt variant="small" tone="soft">
          Covers {formatDate(period.start)} to {formatDate(period.end)}, for{' '}
          {child?.name ?? 'this child'} only.
        </Txt>
      </Card>

      {report.length === 0 ? (
        <Card>
          <Txt variant="small" tone="soft">
            Not enough play in this period to report on.
          </Txt>
        </Card>
      ) : (
        report.map(r => (
          <Card key={r.domain}>
            <Row style={styles.head}>
              <Txt variant="bodyStrong" style={styles.grow}>
                {DOMAINS[r.domain].label}
              </Txt>
              <Chip label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />
            </Row>
            <Txt variant="small" tone="soft" style={styles.mtXs}>
              {r.note}
            </Txt>
          </Card>
        ))
      )}

      {visibleFlag ? (
        <Card tone="notice" label="Included in this report">
          <Txt variant="small" tone="notice">
            {visibleFlag.parent_body}
          </Txt>
        </Card>
      ) : null}

      <View style={styles.footnote}>
        <Txt variant="micro" tone="faint">
          This is not a diagnosis, and it never compares {child?.name ?? 'your child'} against
          another child on this account.
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center' },
  grow: { flex: 1 },
  mtXs: { marginTop: space.xs },
  footnote: { paddingVertical: space.md },
});
