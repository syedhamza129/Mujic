import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from './src/constants/colors';
import { useAuthStore } from './src/store/useAuthStore';
import { useDownloadStore } from './src/store/useDownloadStore';
import { setupPlayer } from './src/player/trackPlayerSetup';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ToastProvider } from './src/components/Toast';
import { MiniPlayer } from './src/components/MiniPlayer';
import { SplashScreenView } from './src/components/SplashScreenView';
import TabNavigator from './src/navigation/TabNavigator';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import PlayerScreen from './src/screens/PlayerScreen';
import QueueScreen from './src/screens/QueueScreen';
import PlaylistDetailScreen from './src/screens/PlaylistDetailScreen';
import SongDetailScreen from './src/screens/SongDetailScreen';
import LikedSongsScreen from './src/screens/LikedSongsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import UploadScreen from './src/screens/UploadScreen';
import GenresScreen from './src/screens/GenresScreen';
import DownloadsScreen from './src/screens/DownloadsScreen';
import AvatarPickerScreen from './src/screens/AvatarPickerScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { isAuthenticated, isSkipped } = useAuthStore();
  const isAllowed = isAuthenticated || isSkipped;

  return (
    <View style={styles.container}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: Colors.bg },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: Colors.bg },
          animation: 'slide_from_right',
        }}
      >
        {isAllowed ? (
          <>
            <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="Player" component={PlayerScreen} options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Queue" component={QueueScreen} options={{ headerShown: false, animation: 'slide_from_bottom' }} />
            <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SongDetail" component={SongDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="LikedSongs" component={LikedSongsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="History" component={HistoryScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Upload" component={UploadScreen} options={{ headerShown: false, animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Genres" component={GenresScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Downloads" component={DownloadsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AvatarPicker" component={AvatarPickerScreen} options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
      <MiniPlayer />
    </View>
  );
}

function App(): React.JSX.Element {
  const { loadStoredAuth } = useAuthStore();
  const loadDownloads = useDownloadStore((s) => s.load);
  // Gate: keep splash visible until the animation finishes (even if auth loads fast)
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    loadStoredAuth();
    loadDownloads();
    setupPlayer();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <ToastProvider>
            <NavigationContainer>
              <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
              {splashDone ? (
                <AppNavigator />
              ) : (
                <View style={styles.container}>
                  <AppNavigator />
                  <SplashScreenView onFinish={() => setSplashDone(true)} />
                </View>
              )}
            </NavigationContainer>
          </ToastProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
});

export default App;
