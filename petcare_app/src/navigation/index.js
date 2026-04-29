import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

// Auth
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Tutor
import DashboardScreen from '../screens/app/DashboardScreen';
import AddPetScreen from '../screens/app/AddPetScreen';
import PetDetailsScreen from '../screens/app/PetDetailsScreen';
import AddVaccineScreen from '../screens/app/AddVaccineScreen';
import ExpensesScreen from '../screens/app/ExpensesScreen';
import AddExpenseScreen from '../screens/app/AddExpenseScreen';
import WeightHistoryScreen from '../screens/app/WeightHistoryScreen';
import AddWeightScreen from '../screens/app/AddWeightScreen';
import FredScreen from '../screens/app/FredScreen';
import ProfileScreen from '../screens/app/ProfileScreen';
import MedicalHistoryScreen from '../screens/app/MedicalHistoryScreen';
import AddMedicalRecordScreen from '../screens/app/AddMedicalRecordScreen';
import PetQRScreen from '../screens/app/PetQRScreen';

// Vet
import VetDashboardScreen from '../screens/vet/VetDashboardScreen';
import VetPatientScreen from '../screens/vet/VetPatientScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const NAV_OPTS = {
  headerStyle: { backgroundColor: '#fff' },
  headerTintColor: '#0EA5E9',
  headerTitleStyle: { fontWeight: '700', color: '#1E293B' },
  contentStyle: { backgroundColor: '#F0F9FF' },
};

const VET_NAV_OPTS = {
  ...NAV_OPTS,
  headerTintColor: '#10B981',
  contentStyle: { backgroundColor: '#F0FDF4' },
};

// ─── TUTOR ───────────────────────────────────────────────
function TutorTabs() {
  return (
    <Tab.Navigator screenOptions={{
      tabBarActiveTintColor: '#0EA5E9', tabBarInactiveTintColor: '#94A3B8',
      tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E2E8F0', paddingBottom: 4 },
      headerStyle: { backgroundColor: '#fff' },
      headerTintColor: '#1E293B', headerTitleStyle: { fontWeight: '700' },
    }}>
      <Tab.Screen name="HomeTab" component={DashboardScreen} options={{ headerTitle: 'PetCare+', tabBarLabel: 'Início', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text> }} />
      <Tab.Screen name="ExpensesTab" component={ExpensesScreen} options={{ headerTitle: 'Gastos', tabBarLabel: 'Gastos', tabBarIcon: () => <Text style={{ fontSize: 20 }}>💰</Text> }} />
      <Tab.Screen name="FredTab" component={FredScreen} options={{ headerTitle: 'Fred', tabBarLabel: 'Fred', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🐱</Text> }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ headerTitle: 'Perfil', tabBarLabel: 'Perfil', tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text> }} />
    </Tab.Navigator>
  );
}

function TutorStack() {
  return (
    <Stack.Navigator screenOptions={NAV_OPTS}>
      <Stack.Screen name="Main" component={TutorTabs} options={{ headerShown: false }} />
      <Stack.Screen name="AddPet" component={AddPetScreen} options={{ title: 'Novo Pet' }} />
      <Stack.Screen name="PetDetails" component={PetDetailsScreen} options={{ title: 'Detalhes do Pet' }} />
      <Stack.Screen name="AddVaccine" component={AddVaccineScreen} options={{ title: 'Nova Vacina' }} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Registrar Gasto' }} />
      <Stack.Screen name="WeightHistory" component={WeightHistoryScreen} options={{ title: 'Histórico de Peso' }} />
      <Stack.Screen name="AddWeight" component={AddWeightScreen} options={{ title: 'Registrar Peso' }} />
      <Stack.Screen name="MedicalHistory" component={MedicalHistoryScreen} options={{ title: 'Histórico Médico' }} />
      <Stack.Screen name="AddMedicalRecord" component={AddMedicalRecordScreen} options={{ title: 'Novo Registro' }} />
      <Stack.Screen name="PetQR" component={PetQRScreen} options={{ title: 'RG Digital' }} />
    </Stack.Navigator>
  );
}

// ─── VETERINÁRIO ─────────────────────────────────────────
function VetTabs() {
  return (
    <Tab.Navigator screenOptions={{
      tabBarActiveTintColor: '#10B981', tabBarInactiveTintColor: '#94A3B8',
      tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E2E8F0', paddingBottom: 4 },
      headerStyle: { backgroundColor: '#fff' },
      headerTintColor: '#1E293B', headerTitleStyle: { fontWeight: '700' },
    }}>
      <Tab.Screen name="VetHomeTab" component={VetDashboardScreen} options={{ headerTitle: 'Meus Pacientes', tabBarLabel: 'Pacientes', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🐾</Text> }} />
      <Tab.Screen name="FredTab" component={FredScreen} options={{ headerTitle: 'Fred', tabBarLabel: 'Fred', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🐱</Text> }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ headerTitle: 'Perfil', tabBarLabel: 'Perfil', tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text> }} />
    </Tab.Navigator>
  );
}

function VetStack() {
  return (
    <Stack.Navigator screenOptions={VET_NAV_OPTS}>
      <Stack.Screen name="VetMain" component={VetTabs} options={{ headerShown: false }} />
      <Stack.Screen name="VetPatient" component={VetPatientScreen} options={{ title: 'Paciente' }} />
      <Stack.Screen name="AddMedicalRecord" component={AddMedicalRecordScreen} options={{ title: 'Novo Registro' }} />
    </Stack.Navigator>
  );
}

// ─── AUTH ────────────────────────────────────────────────
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

// ─── ROOT ────────────────────────────────────────────────
export default function Navigation() {
  const { user, isVet, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F9FF' }}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? <AuthStack /> : isVet ? <VetStack /> : <TutorStack />}
    </NavigationContainer>
  );
}
