import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '@/features/inventory/screens/HomeScreen';
import { ItemsListScreen } from '@/features/inventory/screens/ItemsListScreen';
import { CustomersListScreen } from '@/features/parties/screens/CustomersListScreen';
import { SuppliersListScreen } from '@/features/parties/screens/SuppliersListScreen';
import { NewOutgoingScreen } from '@/features/documents/screens/NewOutgoingScreen';
import { NewIncomingScreen } from '@/features/documents/screens/NewIncomingScreen';
import { DocumentsListScreen } from '@/features/documents/screens/DocumentsListScreen';
import { ExpensesScreen } from '@/features/expenses/screens/ExpensesScreen';
import { CashBookScreen } from '@/features/cashbook/screens/CashBookScreen';
import { ReportsScreen } from '@/features/reports/screens/ReportsScreen';
import { ProfitLossScreen } from '@/features/reports/screens/ProfitLossScreen';
import { DebtsByCustomerScreen } from '@/features/reports/screens/DebtsByCustomerScreen';
import { DebtsBySupplierScreen } from '@/features/reports/screens/DebtsBySupplierScreen';
import { ScanScreen } from '@/features/scan/screens/ScanScreen';
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';

export type RootStackParamList = {
  Home: undefined;
  Items: undefined;
  Customers: undefined;
  Suppliers: undefined;
  NewOutgoing: undefined;
  NewIncoming: undefined;
  Documents: undefined;
  Expenses: undefined;
  CashBook: undefined;
  Reports: undefined;
  ProfitLoss: undefined;
  DebtsByCustomer: undefined;
  DebtsBySupplier: undefined;
  Scan: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Items" component={ItemsListScreen} />
      <Stack.Screen name="Customers" component={CustomersListScreen} />
      <Stack.Screen name="Suppliers" component={SuppliersListScreen} />
      <Stack.Screen name="NewOutgoing" component={NewOutgoingScreen} />
      <Stack.Screen name="NewIncoming" component={NewIncomingScreen} />
      <Stack.Screen name="Documents" component={DocumentsListScreen} />
      <Stack.Screen name="Expenses" component={ExpensesScreen} />
      <Stack.Screen name="CashBook" component={CashBookScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="ProfitLoss" component={ProfitLossScreen} />
      <Stack.Screen name="DebtsByCustomer" component={DebtsByCustomerScreen} />
      <Stack.Screen name="DebtsBySupplier" component={DebtsBySupplierScreen} />
      <Stack.Screen name="Scan" component={ScanScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
