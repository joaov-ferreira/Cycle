import { useRouter, type Href } from 'expo-router';

import { PlanNewScreen } from '@/components/plan-import/plan-new-screen';

export default function PlanNewRoute() {
  const router = useRouter();
  return (
    <PlanNewScreen
      onBack={() => router.back()}
      onChoose={(kind) => {
        if (kind === 'templates') router.push('/plans/templates');
        else if (kind === 'programs') router.push('/programs' as Href);
        else if (kind === 'import') router.push('/plans/import');
        else router.replace('/plans/scratch/edit');
      }}
    />
  );
}
