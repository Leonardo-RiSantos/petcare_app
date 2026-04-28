import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import DashboardScreen from '../screens/app/DashboardScreen';
import AddPetScreen from '../screens/app/AddPetScreen';
import PetDetailsScreen from '../screens/app/PetDetailsScreen';
import AddVaccineScreen from '../screens/app/AddVaccineScreen';
import ExpensesScreen from '../screens/app/ExpensesScreen';
import AddExpenseScreen from '../screens/app/AddExpenseScreen';
import WeightHistoryScreen from '../screens/app/WeightHistoryScreen';
import AddWeightScreen from '../screens/app/AddWeightScreen';
import FredScreen from '../screens/app/FredScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const NAV_OPTS = {
  headerStyle: { backgroundColor: '#fff' },
  headerTintColor: '#0EA5E9',
  headerTitleStyle: { fontWeight: '700', color: '#1E293B' },
  contentStyle: { backgroundColor: '#F0F9FF' },
};

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#0EA5E9',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E2E8F0', paddingBottom: 4 },
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#1E293B',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={DashboardScreen}
        options={{
          headerTitle: 'PetCare+',
          tabBarLabel: 'Início',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="ExpensesTab"
        component={ExpensesScreen}
        options={{
          headerTitle: 'Gastos',
          tabBarLabel: 'Gastos',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>💰</Text>,
        }}
      />
      <Tab.Screen
        name="FredTab"
        component={FredScreen}
        options={{
          headerTitle: 'Fred',
          tabBarLabel: 'Fred',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🐱</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={NAV_OPTS}>
      <Stack.Screen name="Main" component={HomeTabs} options={{ headerShown: false }} />
      <Stack.Screen name="AddPet" component={AddPetScreen} options={{ title: 'Novo Pet' }} />
      <Stack.Screen name="PetDetails" component={PetDetailsScreen} options={{ title: 'Detalhes do Pet' }} />
      <Stack.Screen name="AddVaccine" component={AddVaccineScreen} options={{ title: 'Nova Vacina' }} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Registrar Gasto' }} />
      <Stack.Screen name="WeightHistory" component={WeightHistoryScreen} options={{ title: 'Histórico de Peso' }} />
      <Stack.Screen name="AddWeight" component={AddWeightScreen} options={{ title: 'Registrar Peso' }} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

export default function Navigation() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F9FF' }}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
