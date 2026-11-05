import { useRouter } from 'expo-router';

import { ProgramsScreen } from '@/components/programs/programs-screen';

export default function ProgramsRoute() {
  const router = useRouter();
  return (
    <ProgramsScreen
      onBack={() => router.back()}
      onOpen={(id) => router.push({ pathname: '/programs/[id]', params: { id } })}
    />
  );
}
