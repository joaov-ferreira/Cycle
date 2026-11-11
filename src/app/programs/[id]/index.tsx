import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { useGoBack } from '@/components/navigation/use-go-back';
import { ProgramDetailScreen } from '@/components/programs/program-detail-screen';

export default function ProgramDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useGoBack('/programs');
  return (
    <ProgramDetailScreen
      programId={id}
      onBack={goBack}
      onStart={(programId) => router.push(`/programs/${programId}/start` as Href)}
    />
  );
}
