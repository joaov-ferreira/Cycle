import { useT } from '@/i18n';

import { Button, Screen, Text } from '../ui';
import { OptionCard } from './option-card';

export type NewPlanKind = 'templates' | 'programs' | 'import' | 'scratch';

export type PlanNewScreenProps = {
  onChoose: (kind: NewPlanKind) => void;
  onBack?: () => void;
};

/** Plan → New: choose how to create a plan (template, strength program, import or from scratch). */
export function PlanNewScreen({ onChoose, onBack }: PlanNewScreenProps) {
  const t = useT();
  return (
    <Screen title={t('planImport.new.title')} testID="screen-plan-new">
      {onBack ? <Button variant="secondary" label={t('planImport.back')} onPress={onBack} /> : null}
      <Text tone="secondary">{t('planImport.new.intro')}</Text>
      <OptionCard
        title={t('planImport.new.templateTitle')}
        body={t('planImport.new.templateBody')}
        onPress={() => onChoose('templates')}
      />
      <OptionCard
        title={t('planImport.new.strengthTitle')}
        body={t('planImport.new.strengthBody')}
        onPress={() => onChoose('programs')}
      />
      <OptionCard
        title={t('planImport.new.importTitle')}
        body={t('planImport.new.importBody')}
        onPress={() => onChoose('import')}
      />
      <OptionCard
        title={t('planImport.new.scratchTitle')}
        body={t('planImport.new.scratchBody')}
        onPress={() => onChoose('scratch')}
      />
    </Screen>
  );
}
