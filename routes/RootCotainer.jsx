import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import TabBar from './BottomTabBar';
import Login from '../pages/Login';
import ChangePassword from '../pages/ChangePassword';
import HealthStatus from '../pages/HealthStatus';
import AskAI from '../pages/AskAI';

const Stack = createNativeStackNavigator();

export default function RootContainer() {
  const userinfo = useSelector((state) => state.userinfo.userinfo);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false
        }}
        initialRouteName={userinfo ? "TabBar" : "Login"}
      >
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="TabBar" component={TabBar} />
        <Stack.Screen name="ChangePassword" component={ChangePassword} />
        <Stack.Screen 
          name="HealthStatus" 
          component={HealthStatus}
          options={{
            headerShown: true,
            title: 'Health Status',
            headerStyle: {
              backgroundColor: '#4ECDC4',
            },
            headerTintColor: '#fff',
          }}
        />
        <Stack.Screen
          name="AskAI"
          component={AskAI}
          options={{
            headerShown: true,
            title: 'Virtual Fitness Coach',
            headerStyle: {
              backgroundColor: '#6C63FF',
            },
            headerTintColor: '#fff',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
