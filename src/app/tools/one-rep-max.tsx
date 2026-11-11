import { useRouter } from 'expo-router';

import { CalculatorScreen } from '@/components/maxes/calculator-screen';

export default function OneRepMaxRoute() {
  const router = useRouter();
  return <CalculatorScreen onBack={() => router.back()} />;
}
