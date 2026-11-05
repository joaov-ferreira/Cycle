import { useLocalSearchParams, useRouter } from 'expo-router';

import { HistoryDetailScreen } from '@/components/history/history-detail-screen';

export default function HistoryDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <HistoryDetailScreen
      // a non-numeric id gives NaN, which matches no session
      performedSessionId={Number(id)}
      onBack={() => router.back()}
      onOpen={(sessionId) => router.push({ pathname: '/history/[id]', params: { id: String(sessionId) } })}
    />
  );
}
