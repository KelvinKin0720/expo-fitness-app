import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Check network connection status
export const checkNetworkConnection = async () => {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected;
};

// Show network error message
export const showNetworkError = () => {
  Toast.show({
    type: "error",
    text1: "Network Connection Lost",
    text2: "Please check your internet connection",
    position: "top",
    visibilityTime: 3000,
  });
};

// Show network restored message
export const showNetworkRestored = () => {
  Toast.show({
    type: "success",
    text1: "Network Connected",
    text2: "All features are now available",
    position: "top",
    visibilityTime: 2000,
  });
};

// Operation wrapper with network check
export const withNetworkCheck = async (operation, errorMessage = "Operation failed, please check your network connection") => {
  const isConnected = await checkNetworkConnection();
  
  if (!isConnected) {
    showNetworkError();
    return false;
  }
  
  try {
    await operation();
    return true;
  } catch (error) {
    console.error('Operation failed:', error);
    Toast.show({
      type: "error",
      text1: "Error",
      text2: errorMessage,
    });
    return false;
  }
};

// Save data locally and mark for sync
export const saveOfflineData = async (key, data) => {
  try {
    // Save current data
    await AsyncStorage.setItem(key, JSON.stringify(data));
    
    // Mark for sync
    const syncQueue = await AsyncStorage.getItem('syncQueue') || '[]';
    const queue = JSON.parse(syncQueue);
    if (!queue.includes(key)) {
      queue.push(key);
      await AsyncStorage.setItem('syncQueue', JSON.stringify(queue));
    }
    
    return true;
  } catch (error) {
    console.error('Error saving offline data:', error);
    return false;
  }
};

// Sync offline data when network is restored
export const syncOfflineData = async () => {
  try {
    const syncQueue = await AsyncStorage.getItem('syncQueue');
    if (!syncQueue) return;

    const queue = JSON.parse(syncQueue);
    const userId = await AsyncStorage.getItem('userinfo');
    if (!userId) return;

    const userInfo = JSON.parse(userId);

    for (const key of queue) {
      const data = await AsyncStorage.getItem(key);
      if (!data) continue;

      const parsedData = JSON.parse(data);
      
      // Determine collection based on key
      let collection = '';
      if (key.includes('workouts')) {
        collection = 'workouts';
      } else if (key.includes('schedules')) {
        collection = 'schedules';
      }

      if (collection) {
        await setDoc(doc(db, collection, userInfo.id), parsedData);
      }
    }

    // Clear sync queue after successful sync
    await AsyncStorage.removeItem('syncQueue');
    
    Toast.show({
      type: "success",
      text1: "Sync Complete",
      text2: "Offline data has been synchronized",
      position: "top",
      visibilityTime: 2000,
    });
  } catch (error) {
    console.error('Error syncing offline data:', error);
    Toast.show({
      type: "error",
      text1: "Sync Failed",
      text2: "Failed to sync offline data",
      position: "top",
      visibilityTime: 3000,
    });
  }
}; 