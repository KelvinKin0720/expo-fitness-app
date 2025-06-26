import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { Provider as PaperProvider } from "react-native-paper";
import Toast from "react-native-toast-message";
import * as Notifications from 'expo-notifications';
import AsyncStorage from "@react-native-async-storage/async-storage";
import store from "./redux/store";
import RootContainer from "./routes/RootCotainer";
import { updateUserinfo } from "./redux/reducers/userinfoSlice";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { LogBox } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { syncOfflineData } from './utils/networkUtils';

LogBox.ignoreAllLogs(true); // 屏蔽所有黄色警告

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  // Check user login status and network connection
  useEffect(() => {
    checkLoginStatus();
    setupNetworkListener();
  }, []);

  const setupNetworkListener = () => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(async state => {
      if (!state.isConnected) {
        Toast.show({
          type: "error",
          text1: "Network Connection Lost",
          text2: "Some features may be unavailable",
          position: "top",
          visibilityTime: 3000,
        });
      } else {
        Toast.show({
          type: "success",
          text1: "Network Connected",
          text2: "All features are now available",
          position: "top",
          visibilityTime: 2000,
        });
        
        // Sync offline data when network is restored
        await syncOfflineData();
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  };

  const checkLoginStatus = async () => {
    try {
      // Get user information from AsyncStorage first
      const userinfo = await AsyncStorage.getItem('userinfo');

      if (userinfo) {
        const parsedUserInfo = JSON.parse(userinfo);
        
        // Check network connection before trying to sync with Firestore
        const netInfo = await NetInfo.fetch();
        
        if (netInfo.isConnected) {
          // If userinfo contains id, try to get latest data from Firestore
          if (parsedUserInfo.id) {
            try {
              const userDocRef = doc(db, "users", parsedUserInfo.id);
              const userDoc = await getDoc(userDocRef);
              
              if (userDoc.exists()) {
                // Combine Firestore data with stored user data
                const firestoreData = userDoc.data();
                const updatedUserInfo = {
                  ...parsedUserInfo,
                  ...firestoreData,
                  id: parsedUserInfo.id
                };
                
                // Update AsyncStorage with latest data
                await AsyncStorage.setItem('userinfo', JSON.stringify(updatedUserInfo));
                
                // Update Redux
                store.dispatch(updateUserinfo(updatedUserInfo));
              } else {
                // User exists in AsyncStorage but not in Firestore
                // Still use the AsyncStorage data
                store.dispatch(updateUserinfo(parsedUserInfo));
              }
            } catch (firestoreError) {
              console.error('Error fetching user from Firestore:', firestoreError);
              // Fall back to AsyncStorage data
              store.dispatch(updateUserinfo(parsedUserInfo));
            }
          } else {
            // No id available, just use AsyncStorage data
            store.dispatch(updateUserinfo(parsedUserInfo));
          }
        } else {
          // No network connection, use AsyncStorage data
          store.dispatch(updateUserinfo(parsedUserInfo));
        }
      } else {
        // If user information does not exist, update Redux to null
        store.dispatch(updateUserinfo(null));
      }
    } catch (error) {
      console.error('Error checking login status:', error);
      // Ensure user information is null when an error occurs
      store.dispatch(updateUserinfo(null));
    }
  };

  return (
    <PaperProvider>
      <Provider store={store}>
        <RootContainer />
        <Toast 
          position="top"
          visibilityTime={2000}
          topOffset={50}
        />
      </Provider>
    </PaperProvider>
  );
}
