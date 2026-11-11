import { useRouter, type Href } from 'expo-router';

import { ProgramListScreen } from '@/components/programs/program-list-screen';

export default function ProgramsRoute() {
  const router = useRouter();
  return (
    <ProgramListScreen
      onBack={() => router.back()}
      onOpenProgram={(programId) => router.push(`/programs/${programId}` as Href)}
    />
  );
}
