import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import HomeScreen from '../../screens/HomeScreen';
import SearchScreen from '../../screens/SearchScreen';
import EditScreen from '../../screens/EditScreen';
import LoveScreen from '../../screens/LoveScreen';
import SettingScreen from '../../screens/SettingScreen';
import KrpanoScreen from '../../screens/KrpanoScreen';
import { Provider as PaperProvider } from 'react-native-paper';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: 'gray',
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color: color }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Search" 
        component={SearchScreen} 
        options={{
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color: color }}>🔍</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Edit" 
        component={EditScreen} 
        options={{
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color: color }}>✏️</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Love" 
        component={LoveScreen} 
        options={{
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color: color }}>❤️</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Setting" 
        component={SettingScreen} 
        options={{
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size, color: color }}>⚙️</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="Krpano" component={KrpanoScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
} 