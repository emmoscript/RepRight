import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { WorkoutStackParamList } from '@/navigation/routeTypes';
import { DeadliftConfigureScreen } from '@/screens/DeadliftConfigureScreen';
import { WorkoutScreen } from '@/screens/WorkoutScreen';

const Stack = createNativeStackNavigator<WorkoutStackParamList>();

export function WorkoutStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkoutHome" component={WorkoutScreen} />
      <Stack.Screen name="DeadliftConfigure" component={DeadliftConfigureScreen} />
    </Stack.Navigator>
  );
}
