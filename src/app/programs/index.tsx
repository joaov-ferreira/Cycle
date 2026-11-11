import { useRouter, type Href } from 'expo-router';

import { useGoBack } from '@/components/navigation/use-go-back';
import { ProgramListScreen } from '@/components/programs/program-list-screen';

export default function ProgramsRoute() {
  const router = useRouter();
  const goBack = useGoBack('/more');
  return (
    <ProgramListScreen
      onBack={goBack}
      onOpenProgram={(programId) => router.push(`/programs/${programId}` as Href)}
    />
  );
}
