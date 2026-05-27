import type { WorkoutStackParamList } from '@/navigation/routeTypes';

export type ExerciseId = 'conventional_deadlift' | 'squat' | 'romanian_deadlift';

export type ExerciseCatalogItem = {
  id: ExerciseId;
  title: string;
  subtitle: string;
  trackingLabel: string;
  available: boolean;
  /** Workout stack screen when {@link available}. */
  configureScreen: keyof WorkoutStackParamList | null;
};

export const EXERCISE_CATALOG: ExerciseCatalogItem[] = [
  {
    id: 'conventional_deadlift',
    title: 'Deadlift',
    subtitle: 'Conventional barbell · full ROM logging',
    trackingLabel: 'HIGH INTENSITY TRACKING',
    available: true,
    configureScreen: 'DeadliftConfigure',
  },
  {
    id: 'squat',
    title: 'Squat',
    subtitle: 'Barbell back squat · depth & knee tracking',
    trackingLabel: 'COMING SOON',
    available: false,
    configureScreen: null,
  },
  {
    id: 'romanian_deadlift',
    title: 'Romanian Deadlift',
    subtitle: 'Hip hinge · hamstring emphasis',
    trackingLabel: 'COMING SOON',
    available: false,
    configureScreen: null,
  },
];

export function exerciseById(id: ExerciseId): ExerciseCatalogItem | undefined {
  return EXERCISE_CATALOG.find((e) => e.id === id);
}
