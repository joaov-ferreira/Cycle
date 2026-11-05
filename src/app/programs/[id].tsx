import { useLocalSearchParams, useRouter } from 'expo-router';

import { ProgramDetailScreen } from '@/components/programs/program-detail-screen';

export default function ProgramDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProgramDetailScreen templateId={id} onBack={() => router.back()} />;
}
