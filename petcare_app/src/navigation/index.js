import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, ActivityIndicator, View, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import FredFloat from '../components/FredFloat';

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
import PetMapScreen from '../screens/app/PetMapScreen';
import PlanScreen from '../screens/app/PlanScreen';
import ManageViewersScreen from '../screens/app/ManageViewersScreen';
import ExpenseReportScreen from '../screens/app/ExpenseReportScreen';

// Vet
import VetPendingScreen           from '../screens/vet/VetPendingScreen';
import VetDashboardScreen         from '../screens/vet/VetDashboardScreen';
import VetPatientScreen           from '../screens/vet/VetPatientScreen';
import VetAddPatientScreen        from '../screens/vet/VetAddPatientScreen';
import VetAddAppointmentScreen    from '../screens/vet/VetAddAppointmentScreen';
import VetCalendarScreen          from '../screens/vet/VetCalendarScreen';
import VetFinancialScreen         from '../screens/vet/VetFinancialScreen';
import VetConsultationScreen      from '../screens/vet/VetConsultationScreen';
import VetAddUnlinkedPatientScreen from '../screens/vet/VetAddUnlinkedPatientScreen';
import VetUnlinkedPatientScreen   from '../screens/vet/VetUnlinkedPatientScreen';
import VetChatScreen              from '../screens/vet/VetChatScreen';

// Tutor (novas)
import TutorChatScreen            from '../screens/app/TutorChatScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const LOGO = require('../../assets/logo_background.png');

const TAB_ICONS = {
  home:     require('../../assets/icon_home.png'),
  expenses: require('../../assets/icon_expenses.png'),
  profile:  require('../../assets/icon_profile.png'),
  map:      require('../../assets/icon_map.png'),
  medical:  require('../../assets/icon_medical.png'),
  late:     require('../../assets/icon_late.png'),
};

const NAV_OPTS = {
  headerStyle: { backgroundColor: '#fff' },
  headerTintColor: '#0EA5E9',
  headerTitleStyle: { fontWeight: '700', color: '#1E293B' },
  contentStyle: { backgroundColor: '#F0F9FF' },
};

// ─── CUSTOM TAB BAR ───────────────────────────────────────────
const TAB_ROUTE_CONFIG = {
  HomeTab:         { icon: TAB_ICONS.home,     label: 'Início'     },
  ExpensesTab:     { icon: TAB_ICONS.expenses, label: 'Gastos'     },
  MapTab:          { icon: TAB_ICONS.map,      label: 'Mapa'       },
  ProfileTab:      { icon: TAB_ICONS.profile,  label: 'Perfil'     },
  VetHomeTab:      { icon: TAB_ICONS.medical,  label: 'Pacientes'  },
  VetCalendarTab:  { icon: TAB_ICONS.late,     label: 'Agenda'     },
  VetFinancialTab: { icon: TAB_ICONS.expenses, label: 'Financeiro' },
};

function CustomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={tabStyles.bar}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const { icon, label } = TAB_ROUTE_CONFIG[route.name] || { icon: TAB_ICONS.home, label: route.name };

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <TouchableOpacity key={route.key} onPress={onPress} style={tabStyles.item} activeOpacity={0.75}>
            {isFocused ? (
              <LinearGradient
                colors={['#0284C7', '#0EA5E9']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={tabStyles.pill}
              >
                <Image source={icon} style={tabStyles.pillIcon} resizeMode="contain" />
                <Text style={tabStyles.pillLabel}>{label}</Text>
              </LinearGradient>
            ) : (
              <View style={tabStyles.iconWrap}>
                <Image source={icon} style={tabStyles.icon} resizeMode="contain" />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1,
    borderTopColor: '#EFF6FF',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 10,
    gap: 4,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 22,
    paddingVertical: 10, paddingHorizontal: 8, width: '100%',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.38, shadowRadius: 10, elevation: 6,
  },
  pillIcon: { width: 18, height: 18 },
  pillLabel: { fontSize: 11, fontWeight: '800', color: '#fff' },
  iconWrap: { alignItems: 'center', justifyContent: 'center', padding: 10 },
  icon: { width: 24, height: 24, opacity: 0.35 },
});

// ─── TUTOR ────────────────────────────────────────────────────
function TutorTabs() {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#1E293B',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={DashboardScreen}
          options={{
            headerTitle: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Image source={LOGO} style={{ width: 30, height: 30 }} resizeMode="contain" />
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }}>PetCare+</Text>
              </View>
            ),
          }}
        />
        <Tab.Screen name="ExpensesTab" component={ExpensesScreen} options={{ headerTitle: 'Gastos' }} />
        <Tab.Screen name="MapTab"      component={PetMapScreen}   options={{ headerTitle: 'Mapa Pet' }} />
        <Tab.Screen name="ProfileTab"  component={ProfileScreen}  options={{ headerTitle: 'Perfil' }} />
      </Tab.Navigator>
      <FredFloat />
    </View>
  );
}

function TutorStack() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        ...NAV_OPTS,
        ...(Platform.OS === 'web' && {
          headerLeft: ({ canGoBack }) => canGoBack ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ paddingHorizontal: 6, paddingVertical: 4, marginRight: 4 }}
            >
              <Text style={{ fontSize: 22, color: '#0EA5E9', fontWeight: '300' }}>←</Text>
            </TouchableOpacity>
          ) : undefined,
        }),
      })}
    >
      <Stack.Screen name="Main"             component={TutorTabs}           options={{ headerShown: false }} />
      <Stack.Screen name="Fred"             component={FredScreen}          options={{ headerShown: false }} />
      <Stack.Screen name="AddPet"           component={AddPetScreen}        options={{ title: 'Novo Pet' }} />
      <Stack.Screen name="PetDetails"       component={PetDetailsScreen}    options={{ title: 'Detalhes do Pet' }} />
      <Stack.Screen name="AddVaccine"       component={AddVaccineScreen}    options={{ title: 'Nova Vacina' }} />
      <Stack.Screen name="AddExpense"       component={AddExpenseScreen}    options={{ title: 'Registrar Gasto' }} />
      <Stack.Screen name="WeightHistory"    component={WeightHistoryScreen} options={{ title: 'Histórico de Peso' }} />
      <Stack.Screen name="AddWeight"        component={AddWeightScreen}     options={{ title: 'Registrar Peso' }} />
      <Stack.Screen name="MedicalHistory"   component={MedicalHistoryScreen}options={{ title: 'Histórico Médico' }} />
      <Stack.Screen name="AddMedicalRecord" component={AddMedicalRecordScreen} options={{ title: 'Novo Registro' }} />
      <Stack.Screen name="PetQR"            component={PetQRScreen}         options={{ title: 'RG Digital' }} />
      <Stack.Screen name="Plan"             component={PlanScreen}          options={{ title: 'Meu Plano' }} />
      <Stack.Screen name="ManageViewers"    component={ManageViewersScreen} options={{ title: 'Compartilhar Acesso' }} />
      <Stack.Screen name="ExpenseReport"    component={ExpenseReportScreen} options={{ title: 'Relatório de Gastos' }} />
      <Stack.Screen name="TutorChat"        component={TutorChatScreen}     options={{ title: 'Chat com Vet' }} />
    </Stack.Navigator>
  );
}

// ─── VETERINÁRIO ──────────────────────────────────────────────
function VetTabs() {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#1E293B',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Tab.Screen
          name="VetHomeTab"
          component={VetDashboardScreen}
          options={{
            headerTitle: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Image source={LOGO} style={{ width: 30, height: 30 }} resizeMode="contain" />
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }}>PetCare+</Text>
              </View>
            ),
          }}
        />
        <Tab.Screen name="VetCalendarTab"  component={VetCalendarScreen}  options={{ headerTitle: 'Agenda'      }} />
        <Tab.Screen name="VetFinancialTab" component={VetFinancialScreen} options={{ headerTitle: 'Financeiro'  }} />
        <Tab.Screen name="ProfileTab"      component={ProfileScreen}      options={{ headerTitle: 'Perfil'      }} />
      </Tab.Navigator>
      <FredFloat />
    </View>
  );
}

function VetStack() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        ...NAV_OPTS,
        ...(Platform.OS === 'web' && {
          headerLeft: ({ canGoBack }) => canGoBack ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ paddingHorizontal: 6, paddingVertical: 4, marginRight: 4 }}
            >
              <Text style={{ fontSize: 22, color: '#0EA5E9', fontWeight: '300' }}>←</Text>
            </TouchableOpacity>
          ) : undefined,
        }),
      })}
    >
      <Stack.Screen name="VetMain"                 component={VetTabs}                      options={{ headerShown: false }} />
      <Stack.Screen name="Fred"                    component={FredScreen}                   options={{ headerShown: false }} />
      <Stack.Screen name="VetPatient"              component={VetPatientScreen}             options={{ title: 'Paciente' }} />
      <Stack.Screen name="VetAddPatient"           component={VetAddPatientScreen}          options={{ title: 'Adicionar Paciente' }} />
      <Stack.Screen name="AddMedicalRecord"        component={AddMedicalRecordScreen}       options={{ title: 'Novo Registro' }} />
      <Stack.Screen name="VetAddAppointment"       component={VetAddAppointmentScreen}      options={{ title: 'Agendar Consulta' }} />
      <Stack.Screen name="VetCalendar"             component={VetCalendarScreen}            options={{ title: 'Agenda', headerShown: false }} />
      <Stack.Screen name="VetFinancial"            component={VetFinancialScreen}           options={{ title: 'Financeiro', headerShown: false }} />
      <Stack.Screen name="VetConsultation"         component={VetConsultationScreen}        options={{ title: 'Prontuário' }} />
      <Stack.Screen name="VetAddUnlinkedPatient"   component={VetAddUnlinkedPatientScreen}  options={{ title: 'Novo Paciente' }} />
      <Stack.Screen name="VetUnlinkedPatient"      component={VetUnlinkedPatientScreen}     options={{ title: 'Paciente da Clínica' }} />
      <Stack.Screen name="VetChat"                 component={VetChatScreen}                options={{ title: 'Chat' }} />
    </Stack.Navigator>
  );
}

// ─── AUTH ─────────────────────────────────────────────────────
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login"    component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────
export default function Navigation() {
  const { user, isVet, vetStatus, loading } = useAuth();

  if (loading) {
    return (
      <LinearGradient
        colors={['#0284C7', '#0EA5E9', '#38BDF8']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 }}
      >
        <Image source={LOGO} style={{ width: 140, height: 140 }} resizeMode="contain" />
        <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff' }}>PetCare+</Text>
        <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
      </LinearGradient>
    );
  }

  if (!user) return <NavigationContainer><AuthStack /></NavigationContainer>;

  // Vet pendente → tela de análise (sem navegação)
  if (isVet && vetStatus !== 'approved') {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="VetPending" component={VetPendingScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      {isVet ? <VetStack /> : <TutorStack />}
    </NavigationContainer>
  );
}
