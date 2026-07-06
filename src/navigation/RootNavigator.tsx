import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '@/features/inventory/screens/HomeScreen';
import { ItemsListScreen } from '@/features/inventory/screens/ItemsListScreen';
import { CustomersListScreen } from '@/features/parties/screens/CustomersListScreen';

export type RootStackParamList = {
  Home: undefined;
  Items: undefined;
  Customers: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Items" component={ItemsListScreen} />
      <Stack.Screen name="Customers" component={CustomersListScreen} />
    </Stack.Navigator>
  );
}
