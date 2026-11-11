import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { ProgramStartScreen } from '@/components/programs/program-start-screen';

export default function ProgramStartRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ProgramStartScreen
      programId={id}
      onBack={() => router.back()}
      onCreated={(planId) => router.replace(`/plans/${planId}/periodization` as Href)}
    />
  );
}
