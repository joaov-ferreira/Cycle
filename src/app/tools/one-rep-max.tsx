import { useGoBack } from '@/components/navigation/use-go-back';
import { CalculatorScreen } from '@/components/maxes/calculator-screen';

export default function OneRepMaxRoute() {
  const goBack = useGoBack('/more');
  return <CalculatorScreen onBack={goBack} />;
}
