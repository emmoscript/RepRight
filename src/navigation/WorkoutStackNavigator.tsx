import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { WorkoutStackParamList } from '@/navigation/routeTypes';

const Stack = createNativeStackNavigator<WorkoutStackParamList>();

export function WorkoutStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkoutHome" getComponent={() => require('@/screens/WorkoutScreen').WorkoutScreen} />
      <Stack.Screen
        name="DeadliftConfigure"
        getComponent={() => require('@/screens/DeadliftConfigureScreen').DeadliftConfigureScreen}
      />
    </Stack.Navigator>
  );
}
