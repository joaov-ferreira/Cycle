/**
 * The app's real route files under a root layout that mirrors `src/app/_layout.tsx` (shell and a
 * stack), for router tests that follow links between screens. Provide `AppProviders` through the
 * `wrapper` option of `renderRouter`.
 */
import { Stack } from 'expo-router';

import TabsLayout from '@/app/(tabs)/_layout';
import HomeRoute from '@/app/(tabs)/index';
import MoreRoute from '@/app/(tabs)/more';
import PlanTabRoute from '@/app/(tabs)/plan';
import ProgressRoute from '@/app/(tabs)/progress';
import WorkoutRoute from '@/app/(tabs)/workout';
import ExerciseDetailRoute from '@/app/exercises/[id]';
import BodyRoute from '@/app/body';
import MaxDetailRoute from '@/app/maxes/[exerciseId]';
import MaxesRoute from '@/app/maxes/index';
import ProgramDetailRoute from '@/app/programs/[id]/index';
import ProgramStartRoute from '@/app/programs/[id]/start';
import ProgramsRoute from '@/app/programs/index';
import PeriodizationRoute from '@/app/plans/[id]/periodization';
import OneRepMaxRoute from '@/app/tools/one-rep-max';
import ExercisesRoute from '@/app/exercises/index';
import ExerciseNewRoute from '@/app/exercises/new';
import HistoryDetailRoute from '@/app/history/[id]';
import HistoryRoute from '@/app/history/index';
import PlanEditRoute from '@/app/plans/[id]/edit';
import PlanExportRoute from '@/app/plans/[id]/export';
import CycleReportRoute from '@/app/plans/[id]/cycles/[cycle]';
import PlanDetailRoute from '@/app/plans/[id]/index';
import AiReviewRoute from '@/app/plans/[id]/review';
import PlanImportRoute from '@/app/plans/import';
import PlansRoute from '@/app/plans/index';
import PlanNewRoute from '@/app/plans/new';
import PlanTemplatesRoute from '@/app/plans/templates';
import SettingsRoute from '@/app/settings';
import { AppShell } from '@/components/navigation/app-shell';

export const appRoutes = {
  _layout: () => (
    <AppShell>
      <Stack screenOptions={{ headerShown: false }} />
    </AppShell>
  ),
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeRoute,
  '(tabs)/plan': PlanTabRoute,
  '(tabs)/workout': WorkoutRoute,
  '(tabs)/progress': ProgressRoute,
  '(tabs)/more': MoreRoute,
  'plans/index': PlansRoute,
  'plans/new': PlanNewRoute,
  'plans/templates': PlanTemplatesRoute,
  'plans/import': PlanImportRoute,
  'plans/[id]/index': PlanDetailRoute,
  'plans/[id]/edit': PlanEditRoute,
  'plans/[id]/export': PlanExportRoute,
  'plans/[id]/cycles/[cycle]': CycleReportRoute,
  'plans/[id]/review': AiReviewRoute,
  'plans/[id]/periodization': PeriodizationRoute,
  'programs/index': ProgramsRoute,
  'programs/[id]/index': ProgramDetailRoute,
  'programs/[id]/start': ProgramStartRoute,
  'maxes/index': MaxesRoute,
  'maxes/[exerciseId]': MaxDetailRoute,
  'tools/one-rep-max': OneRepMaxRoute,
  'exercises/index': ExercisesRoute,
  'exercises/new': ExerciseNewRoute,
  'exercises/[id]': ExerciseDetailRoute,
  'history/index': HistoryRoute,
  'history/[id]': HistoryDetailRoute,
  settings: SettingsRoute,
  body: BodyRoute,
};
