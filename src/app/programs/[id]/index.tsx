import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { ProgramDetailScreen } from '@/components/programs/program-detail-screen';

export default function ProgramDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ProgramDetailScreen
      programId={id}
      onBack={() => router.back()}
      onStart={(programId) => router.push(`/programs/${programId}/start` as Href)}
    />
  );
}
