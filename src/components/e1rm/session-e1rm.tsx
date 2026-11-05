import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { InvalidReferenceOneRmError, type E1rmRecord, type PerformedSession } from '@/data/repositories';
import { estimateSet, type E1rmFormula, type SetEstimate } from '@/domain/e1rm/estimate';
import { compareE1rm, sessionE1rmCandidates, sessionEstimates } from '@/domain/e1rm/session';
import type { Lift } from '@/domain/lifts';
import type { SetRecord } from '@/domain/performance';
import type { GeneratedSession } from '@/domain/periodization';
import { MAX_REFERENCE_1RM_KG } from '@/domain/validation';
import { useI18n } from '@/i18n';
import { selectCurrentOneRm } from '@/state/app-store';
import { useAppStore } from '@/state/app-store-context';
import { selectE1rmFormula, selectPreviousE1rm, selectSessionE1rms } from '@/state/e1rm-selectors';

import { Button, Card, Text } from '../ui';
import { useE1rmText } from './e1rm-text';

/** Per-set estimates (information only, SPEC §8.3) by set position; variation sets have none. */
export function useSetEstimates(
  session: GeneratedSession,
  sets: readonly SetRecord[],
  formula: E1rmFormula,
): Map<number, SetEstimate> {
  return useMemo(
    () =>
      new Map(sessionE1rmCandidates(session, sets).map((candidate) => [candidate.position, estimateSet(candidate, formula)])),
    [session, sets, formula],
  );
}

/** The line shown under a set once it has weight, reps and RIR/RPE. */
export function SetE1rmLine({ estimate }: { estimate: SetEstimate | undefined }) {
  const text = useE1rmText();
  const line = estimate ? text.setEstimate(estimate) : null;
  if (!line) return null;
  return (
    <Text variant="caption" tone={estimate?.status === 'valid' ? 'primary' : 'secondary'} tabular>
      {line}
    </Text>
  );
}

function EstimateLines({
  lift,
  valueKg,
  setNumber,
  previous,
}: {
  lift: Lift;
  valueKg: number;
  setNumber: number;
  previous: E1rmRecord | null;
}) {
  const { t } = useI18n();
  const text = useE1rmText();
  return (
    <>
      <Text variant="label" tabular>
        {t('e1rm.sessionLine', { lift: t(`lifts.${lift}`), value: text.value(valueKg), set: setNumber })}
      </Text>
      <Text tone="secondary" tabular>
        {text.comparison(compareE1rm(valueKg, previous?.valueKg ?? null))}
      </Text>
    </>
  );
}

function DraftEstimate({ lift, valueKg, setNumber }: { lift: Lift; valueKg: number; setNumber: number }) {
  const previous = useAppStore(selectPreviousE1rm(lift, null));
  return <EstimateLines lift={lift} valueKg={valueKg} setNumber={setNumber} previous={previous} />;
}

/** Live session estimate while logging: the representative set of each lift (SPEC §8.3). */
export function DraftSessionE1rm({ session, sets }: { session: GeneratedSession; sets: readonly SetRecord[] }) {
  const { t } = useI18n();
  const text = useE1rmText();
  const formula = useAppStore(selectE1rmFormula);
  const estimates = sessionEstimates(sessionE1rmCandidates(session, sets), formula);
  return (
    <Card testID="session-e1rm">
      <Text variant="heading">{t('e1rm.sessionTitle')}</Text>
      {estimates.length === 0 ? <Text tone="secondary">{t('e1rm.none')}</Text> : null}
      {estimates.map((estimate) => (
        <DraftEstimate
          key={estimate.lift}
          lift={estimate.lift}
          valueKg={estimate.e1rmKg}
          setNumber={estimate.position + 1}
        />
      ))}
      <Text variant="caption" tone="secondary">
        {t('e1rm.formulaLine', { formula: text.formula(formula) })}
      </Text>
    </Card>
  );
}

/** "Use as new reference 1RM" with an explicit confirmation (SPEC §8.4); never automatic. */
function UseAsReference({ record }: { record: E1rmRecord }) {
  const { t, formatKg } = useI18n();
  const text = useE1rmText();
  const adopt = useAppStore((s) => s.adoptE1rmAsReference);
  const current = useAppStore(selectCurrentOneRm(record.lift));
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const lift = t(`lifts.${record.lift}`);
  const value = text.value(record.valueKg);

  async function confirm() {
    setConfirming(false);
    try {
      await adopt(record.id);
      setMessage({ text: t('e1rm.adopted', { lift, value }), error: false });
    } catch (error) {
      if (!(error instanceof InvalidReferenceOneRmError)) throw error;
      setMessage({
        text:
          error.reason === 'aboveMax'
            ? t('validation.aboveMax', { max: MAX_REFERENCE_1RM_KG })
            : t(`validation.${error.reason}` as 'validation.invalidNumber'),
        error: true,
      });
    }
  }

  return (
    <View style={styles.block}>
      {confirming ? (
        <View style={styles.block} accessibilityLiveRegion="polite">
          <Text variant="label">{t('e1rm.confirmTitle', { lift, value })}</Text>
          <Text tone="secondary">
            {t('e1rm.confirmBody', { current: current ? formatKg(current.value) : t('e1rm.notSet') })}
          </Text>
          <View style={styles.row}>
            <Button label={t('e1rm.confirm')} onPress={() => void confirm()} />
            <Button variant="secondary" label={t('e1rm.cancel')} onPress={() => setConfirming(false)} />
          </View>
        </View>
      ) : (
        <Button
          variant="secondary"
          label={t('e1rm.useAsReference')}
          accessibilityLabel={t('e1rm.useAsReferenceFor', { lift })}
          onPress={() => {
            setMessage(null);
            setConfirming(true);
          }}
        />
      )}
      {message ? (
        <Text tone={message.error ? 'danger' : 'secondary'} accessibilityLiveRegion="polite">
          {message.text}
        </Text>
      ) : null}
    </View>
  );
}

function StoredEstimate({ record }: { record: E1rmRecord }) {
  const previous = useAppStore(selectPreviousE1rm(record.lift, record));
  return (
    <>
      <EstimateLines lift={record.lift} valueKg={record.valueKg} setNumber={record.setPosition + 1} previous={previous} />
      <UseAsReference record={record} />
    </>
  );
}

/** The stored estimates of a completed session, with the comparison and the reference action. */
export function CompletedSessionE1rm({ performed }: { performed: PerformedSession }) {
  const { t } = useI18n();
  const text = useE1rmText();
  const e1rmHistory = useAppStore((s) => s.e1rmHistory);
  const records = useMemo(() => selectSessionE1rms(performed.id)({ e1rmHistory }), [performed.id, e1rmHistory]);
  return (
    <Card testID="session-e1rm">
      <Text variant="heading">{t('e1rm.sessionTitle')}</Text>
      {records.length === 0 ? <Text tone="secondary">{t('e1rm.none')}</Text> : null}
      {records.map((record) => (
        <StoredEstimate key={record.id} record={record} />
      ))}
      {records.length > 0 ? (
        <Text variant="caption" tone="secondary">
          {t('e1rm.formulaLine', { formula: text.formula(records[0].formula) })}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
});
