import { useRouter } from 'expo-router';

import { HistoryScreen } from '@/components/history/history-screen';

export default function HistoryRoute() {
  const router = useRouter();
  return (
    <HistoryScreen
      onBack={() => router.back()}
      onOpen={(id) => router.push({ pathname: '/history/[id]', params: { id: String(id) } })}
    />
  );
}
