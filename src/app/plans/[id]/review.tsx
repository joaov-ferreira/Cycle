import { useLocalSearchParams, useRouter } from 'expo-router';

import { AiReviewScreen } from '@/components/ai-review/ai-review-screen';

export default function AiReviewRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <AiReviewScreen
      planId={Number(id)}
      onBack={() => router.back()}
      onImportAnswer={(planId) => router.push(`/plans/import?update=${planId}`)}
    />
  );
}
