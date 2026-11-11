import { useRouter } from 'expo-router';

import { SettingsScreen } from '@/components/settings/settings-screen';

export default function SettingsRoute() {
  const router = useRouter();
  return <SettingsScreen onBack={() => router.back()} onOpenMaxes={() => router.push('/maxes')} />;
}
