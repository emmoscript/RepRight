import { navigationRef } from '@/navigation/navigationRef';

/** Opens the in-app UNIBE biomechanics questionnaire. */
export function navigateToBiomechSurvey(): boolean {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate('BiomechSurvey');
  return true;
}
