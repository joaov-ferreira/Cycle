import { useMemo, useState } from 'react';

import type { Plan } from '@/domain/plan';
import { DEFAULT_MAX_BYTES, type ImportDraft, type ImportError } from '@/domain/plan-import';
import { useI18n } from '@/i18n';
import { buildAiPlanPrompt } from '@/library/ai-prompt';
import { useAppStore } from '@/state/app-store-context';
import { selectAllExercises } from '@/state/selectors';
import { selectParsedPlanImport } from '@/state/selectors-v4';

import { Button, Screen } from '../ui';
import { AiPromptView } from './ai-prompt-view';
import { ImportInputStep } from './import-input-step';
import { ImportPreviewStep } from './import-preview-step';
import { pickTextFile } from './pick-text-file';
import { shareText } from './share-text';

export type PlanImportScreenProps = {
  /** Called with the saved plan (the route replaces this screen with the plan's detail). */
  onImported: (plan: Plan) => void;
  onBack?: () => void;
  /** The plan the preview offers to update (the route reads `?update=`); preselects "Update plan". */
  updatePlanId?: number;
  /** Overridable for tests; defaults to the system document picker. */
  pickFile?: () => Promise<{ name: string; text: string; size?: number } | null>;
  /** Overridable for tests; defaults to the platform share sheet. */
  share?: (text: string) => Promise<void>;
};

type Step = 'input' | 'ai' | 'preview';

/** Plan import (SPEC §4.3, §4.5): paste / pick / create with AI, then preview and save. */
export function PlanImportScreen({
  onImported,
  onBack,
  updatePlanId,
  pickFile = pickTextFile,
  share = shareText,
}: PlanImportScreenProps) {
  const { t, locale } = useI18n();
  const exercises = useAppStore(selectAllExercises);
  const state = useAppStore((s) => s);
  const [step, setStep] = useState<Step>('input');
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<ImportDraft | null>(null);

  const prompt = useMemo(() => buildAiPlanPrompt(exercises, locale), [exercises, locale]);

  const changeText = (next: string) => {
    setText(next);
    setErrors([]);
    setNotice(null);
  };

  const pick = async () => {
    setNotice(null);
    try {
      const file = await pickFile();
      if (!file) return;
      const size = file.size ?? new TextEncoder().encode(file.text).length;
      if (size > DEFAULT_MAX_BYTES) {
        setNotice(t('planImport.input.fileTooLarge'));
        return;
      }
      changeText(file.text);
    } catch {
      setNotice(t('planImport.input.fileReadError'));
    }
  };

  const proceed = () => {
    setNotice(null);
    if (text.trim() === '') {
      setErrors([]);
      setNotice(t('planImport.input.emptyText'));
      return;
    }
    const result = selectParsedPlanImport(state, text);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setDraft(result.draft);
    setStep('preview');
  };

  if (step === 'ai') {
    return <AiPromptView prompt={prompt} onShare={share} onDone={() => setStep('input')} />;
  }

  return (
    <Screen
      title={step === 'preview' ? t('planImport.preview.title') : t('planImport.input.title')}
      testID="screen-plan-import">
      {step === 'input' && onBack ? (
        <Button variant="secondary" label={t('planImport.back')} onPress={onBack} />
      ) : null}
      {step === 'preview' && draft ? (
        <ImportPreviewStep
          draft={draft}
          exercises={exercises}
          onImported={onImported}
          updatePlanId={updatePlanId}
          onEditText={() => setStep('input')}
        />
      ) : (
        <ImportInputStep
          text={text}
          onChangeText={changeText}
          errors={errors}
          notice={notice}
          onPickFile={pick}
          onCreateWithAi={() => setStep('ai')}
          onContinue={proceed}
        />
      )}
    </Screen>
  );
}
