import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { useGoBack } from '@/components/navigation/use-go-back';
import { ProgramStartScreen } from '@/components/programs/program-start-screen';

export default function ProgramStartRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useGoBack(`/programs/${id}` as Href);
  return (
    <ProgramStartScreen
      programId={id}
      onBack={goBack}
      onCreated={(planId) => router.replace(`/plans/${planId}/periodization` as Href)}
    />
  );
}
