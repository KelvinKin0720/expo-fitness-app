import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Index from "../pages/Index";
import Schedule from "../pages/Schedule";
import Workouts from "../pages/Workouts";
import My from "../pages/My";

export default function BottomTabBar() {
  const Tab = createBottomTabNavigator();
  
  const THEME = {
    primary: "#FF6B6B",
    secondary: "#4ECDC4",
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: THEME.primary,
        },
        headerTitleStyle: {
          color: "white",
          fontWeight: "bold",
        },
        headerTintColor: "white",
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: "#666",
        tabBarStyle: {
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: -5,
        },
      }}
    >
      <Tab.Screen
        options={{
          title: "Dashboard",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="view-dashboard" size={24} color={color} />
          ),
        }}
        name="Index"
        component={Index}
      />

      <Tab.Screen
        options={{
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="calendar-clock" size={24} color={color} />
          ),
        }}
        name="Schedule"
        component={Schedule}
      />

      <Tab.Screen
        options={{
          title: "Workouts",
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="dumbbell" size={24} color={color} />
          ),
        }}
        name="Workouts"
        component={Workouts}
      />

      <Tab.Screen
        options={{
          title: "Profile",
          headerShown: false,
          headerTitleAlign: "center",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account" size={24} color={color} />
          ),
        }}
        name="My"
        component={My}
      />
    </Tab.Navigator>
  );
}
