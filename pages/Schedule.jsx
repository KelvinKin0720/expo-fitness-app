import {
  StyleSheet,
  View,
  ScrollView,
  Modal as RNModal,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Text, Surface, Button, TextInput, Switch } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState, useEffect, useRef } from "react";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSelector, useDispatch } from "react-redux";
import Toast from "react-native-toast-message";
import { updateSchedules } from "../redux/reducers/scheduleSlice";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import * as Notifications from 'expo-notifications';
import moment from 'moment';
import { withNetworkCheck, showNetworkError, saveOfflineData } from '../utils/networkUtils';

// Collection name for storing schedules in Firestore
const SCHEDULES_COLLECTION = "schedules";
// Key for backup in AsyncStorage
const SCHEDULE_STORAGE_KEY = "@fithub_schedules_";

// 配置通知
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function Schedule() {
  const dispatch = useDispatch();
  const notificationListener = useRef();
  const responseListener = useRef();
  
  // Get schedule data from Redux
  const schedules = useSelector((state) => state.schedule.schedules);
  const userinfo = useSelector((state) => state.userinfo.userinfo);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enableReminder, setEnableReminder] = useState(true);
  const [reminderTime, setReminderTime] = useState("15"); // Default 15 minutes before

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date(Date.now() + 60 * 60 * 1000));

  const initialTimeString = `${formatTime(startTime)} - ${formatTime(endTime)}`;

  const [newWorkout, setNewWorkout] = useState({
    time: initialTimeString,
    name: "",
    status: "scheduled",
    location: "",
  });

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationName, setLocationName] = useState("");

  const [errorMessage, setErrorMessage] = useState('');

  // 新增時間輸入狀態
  const [startTimeInput, setStartTimeInput] = useState(
    startTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
  const [endTimeInput, setEndTimeInput] = useState(
    endTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  );

  // 當用戶輸入時間時，更新狀態並同步newWorkout.time
  useEffect(() => {
    setNewWorkout((prev) => ({
      ...prev,
      time: `${startTimeInput} - ${endTimeInput}`,
    }));
  }, [startTimeInput, endTimeInput]);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("Location permission is required to obtain the current location!");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      updateLocationInfo(location);
    } catch (error) {
      console.error("Error getting current location:", error);
    }
  };

  const updateLocationInfo = async (location) => {
    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      const name = address
        ? `${address.name || ""}`
        : "Current Location";

      setLocationName(name);
      setSelectedLocation(location);
    } catch (error) {
      console.error("Error updating location info:", error);
    }
  };

  // Load user specific schedule data from Firestore
  const loadUserSchedules = async () => {
    try {
      if (!userinfo?.id) return;
      
      setLoading(true);
      
      // 使用网络检查包装器处理加载操作
      const success = await withNetworkCheck(
        async () => {
          // 从 Firestore 加载数据
          const scheduleRef = doc(db, "schedules", userinfo.id);
          const scheduleDoc = await getDoc(scheduleRef);

          if (scheduleDoc.exists()) {
            const scheduleData = scheduleDoc.data();
            if (scheduleData.schedules) {
              dispatch(updateSchedules(scheduleData.schedules));
              // 保存到本地存储
              const storageKey = `${SCHEDULE_STORAGE_KEY}${userinfo.id}`;
              await AsyncStorage.setItem(storageKey, JSON.stringify(scheduleData.schedules));
            }
          }
        },
        "Failed to load schedule, please check your network connection"
      );

      if (!success) {
        // 如果网络操作失败，尝试从本地加载
        try {
          const savedSchedules = await AsyncStorage.getItem(`${SCHEDULE_STORAGE_KEY}${userinfo.id}`);
          if (savedSchedules) {
            const parsedSchedules = JSON.parse(savedSchedules);
            dispatch(updateSchedules(parsedSchedules));
          }
        } catch (backupError) {
          console.error('Error loading from backup:', backupError);
          Toast.show({
            type: "error",
            text1: "Error",
            text2: "Failed to load schedules",
          });
        }
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to load schedules",
      });
    } finally {
      setLoading(false);
    }
  };

  // Save user schedule data to Firestore
  const saveUserSchedules = async (updatedSchedules) => {
    setLoading(true);
    try {
      // 使用网络检查包装器处理保存操作
      const success = await withNetworkCheck(
        async () => {
          // 保存到 Firestore
          const scheduleRef = doc(db, "schedules", userinfo.id);
          await setDoc(scheduleRef, { schedules: updatedSchedules });

          // 更新 Redux 中的日程数据
          dispatch(updateSchedules(updatedSchedules));

          // 保存到本地存储
          const storageKey = `${SCHEDULE_STORAGE_KEY}${userinfo.id}`;
          await AsyncStorage.setItem(storageKey, JSON.stringify(updatedSchedules));

          setModalVisible(false);
          Toast.show({
            type: "success",
            text1: "Success",
            text2: "Schedule saved successfully",
          });
        },
        "Failed to save schedule, please check your network connection"
      );

      if (!success) {
        // 如果网络操作失败，保存到本地并标记为待同步
        const storageKey = `${SCHEDULE_STORAGE_KEY}${userinfo.id}`;
        await saveOfflineData(storageKey, { schedules: updatedSchedules });
        
        // 更新 Redux 中的日程数据
        dispatch(updateSchedules(updatedSchedules));
        
        setModalVisible(false);
        Toast.show({
          type: "success",
          text1: "Success",
          text2: "Schedule saved locally (offline mode)",
        });
      }
    } catch (error) {
      console.error('Error saving schedules:', error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to save schedule",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load user schedule when component loads
  useEffect(() => {
    loadUserSchedules();
  }, [userinfo]);

  // 请求通知权限
  useEffect(() => {
    registerForPushNotificationsAsync();

    // 监听通知
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  // 请求通知权限的函数
  async function registerForPushNotificationsAsync() {
    let token;
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to get push token for push notification!",
      });
      return;
    }
  }

  // 工具函数：获取下一个目标星期几的日期（包含小时分钟和提醒分钟）
  function getNextDayOfWeek(date, dayOfWeek, hours, minutes, reminderTime) {
    const resultDate = new Date(date);
    const now = new Date(date);

    // 先设置到目标星期几
    let diff = (7 + dayOfWeek - date.getDay()) % 7;
    resultDate.setDate(date.getDate() + diff);
    resultDate.setHours(hours, minutes, 0, 0);
    resultDate.setMinutes(resultDate.getMinutes() - reminderTime);

    // 如果提醒时间已过，跳到下周
    if (resultDate <= now) {
      resultDate.setDate(resultDate.getDate() + 7);
    }
    return resultDate;
  }

  // 设置提醒的函数
  async function schedulePushNotification(workout, scheduleDay) {
    const [startTime] = workout.time.split(' - ');
    const [hours, minutes] = startTime.split(':').map(Number);
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetDayIndex = days.indexOf(scheduleDay);
    const reminderMinutes = parseInt(reminderTime);

    const now = new Date();
    const targetDate = getNextDayOfWeek(now, targetDayIndex, hours, minutes, reminderMinutes);

    await Notifications.cancelScheduledNotificationAsync(workout.id);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Workout Reminder",
        body: `Your ${workout.name} workout will start at ${startTime} at ${workout.location}`,
        data: { workout },
      },
      trigger: {
        type: 'date',
        timestamp: targetDate.getTime(),
      },
      identifier: workout.id,
    });

    console.log('Scheduled notification for:', targetDate.toLocaleString());
  }

  // 检查并清理过期的运动计划
  const cleanupExpiredWorkouts = async (schedules) => {
    const now = new Date();
    const updatedSchedules = schedules.map(schedule => {
      const validWorkouts = schedule.workouts.filter(workout => {
        const [endTime] = workout.time.split(' - ').reverse();
        const [hours, minutes] = endTime.split(':').map(Number);
        const workoutEndTime = new Date();
        workoutEndTime.setHours(hours, minutes, 0, 0);
        
        // 如果结束时间已经过去，则删除该计划
        if (workoutEndTime < now) {
          // 取消相关的通知
          Notifications.cancelScheduledNotificationAsync(workout.id);
          return false;
        }
        return true;
      });

      return {
        ...schedule,
        workouts: validWorkouts
      };
    });

    // 如果有任何变化，保存更新后的计划
    if (JSON.stringify(schedules) !== JSON.stringify(updatedSchedules)) {
      await saveUserSchedules(updatedSchedules);
    }
  };

  // 定期检查过期计划
  useEffect(() => {
    if (schedules.length > 0) {
      cleanupExpiredWorkouts(schedules);
    }

    // 每5分钟检查一次
    const interval = setInterval(() => {
      if (schedules.length > 0) {
        cleanupExpiredWorkouts(schedules);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [schedules]);

  const handleAddWorkout = async () => {
    setErrorMessage('');

    if (!userinfo?.id) {
      setErrorMessage('Please login first');
      return;
    }

    if (!selectedDay) {
      setErrorMessage('Please select a day');
      return;
    }

    if (!newWorkout.time || !newWorkout.name) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    try {
      const updatedSchedules = schedules.map((schedule) => {
        if (schedule.id === selectedDay) {
          const newWorkoutWithId = {
            ...newWorkout,
            id: Date.now().toString(),
            userId: userinfo.id,
            createdAt: new Date().toISOString(),
            location: locationName || "No location set",
          };

          if (enableReminder) {
            schedulePushNotification(newWorkoutWithId, schedule.day);
          }

          return {
            ...schedule,
            workouts: [...schedule.workouts, newWorkoutWithId],
          };
        }
        return schedule;
      });

      await saveUserSchedules(updatedSchedules);

      // Reset form
      setNewWorkout({
        time: initialTimeString,
        name: "",
        status: "scheduled",
        location: "",
      });
      setModalVisible(false);
      setErrorMessage('');

      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Workout scheduled successfully",
      });
    } catch (error) {
      console.error("Error adding workout:", error);
      setErrorMessage('Failed to add workout');
    }
  };

  const handleDeleteWorkout = async (dayId, workoutId) => {
    try {
      const updatedSchedules = schedules.map((schedule) => {
        if (schedule.id === dayId) {
          return {
            ...schedule,
            workouts: schedule.workouts.filter((w) => w.id !== workoutId),
          };
        }
        return schedule;
      });

      await saveUserSchedules(updatedSchedules);

      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Workout deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting workout:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to delete workout",
      });
    }
  };

  const openAddModal = (dayId) => {
    setSelectedDay(dayId);
    setModalVisible(true);
  };

  const renderWorkoutItem = (workout, schedule) => (
    <View key={workout.id} style={styles.workoutItem}>
      <View style={styles.infoRow}>
        <MaterialCommunityIcons 
          name="clock-outline" 
          size={20} 
          color="#666" 
        />
        <Text style={styles.infoText}>{workout.time}</Text>
      </View>

      <View style={styles.infoRow}>
        <MaterialCommunityIcons 
          name="dumbbell" 
          size={20} 
          color="#666" 
        />
        <Text style={[styles.infoText, styles.workoutName]}>{workout.name}</Text>
      </View>

      <View style={styles.infoRow}>
        <MaterialCommunityIcons 
          name="map-marker" 
          size={20} 
          color="#666" 
        />
        <Text style={styles.infoText}>{workout.location || 'No location set'}</Text>
      </View>

      <TouchableOpacity 
        onPress={() => handleDeleteWorkout(schedule.id, workout.id)}
        style={styles.deleteButton}
      >
        <MaterialCommunityIcons 
          name="delete-outline" 
          size={24} 
          color="#FF6B6B" 
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FF6B6B", "#4ECDC4"]} style={styles.header}>
        <Text style={styles.headerTitle}>Weekly Schedule</Text>
        <Text style={styles.headerSubtitle}>Plan your fitness journey</Text>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading schedules...</Text>
          </View>
        ) : (
          schedules.map((schedule) => (
            <Surface key={schedule.id} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{schedule.day}</Text>
                <Button
                  mode="contained"
                  onPress={() => openAddModal(schedule.id)}
                  style={styles.addButton}
                  buttonColor="#4ECDC4"
                  icon="plus"
                >
                  Add
                </Button>
              </View>

              {schedule.workouts.length > 0 ? (
                schedule.workouts.map((workout) =>
                  renderWorkoutItem(workout, schedule)
                )
              ) : (
                <View style={styles.emptyDay}>
                  <MaterialCommunityIcons
                    name="calendar-blank"
                    size={24}
                    color="#666"
                  />
                  <Text style={styles.emptyText}>No workouts scheduled</Text>
                  <Text style={styles.emptySubtext}>Tap + to add a workout</Text>
                </View>
              )}
            </Surface>
          ))
        )}
      </ScrollView>

      <RNModal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Surface style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Workout</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.timeRow}>
              <View style={styles.timeInputWrapper}>
                <TextInput
                  mode="outlined"
                  label="Start Time (HH:mm)"
                  value={startTimeInput}
                  onChangeText={setStartTimeInput}
                  style={styles.timeInput}
                  theme={{ colors: { primary: "#4ECDC4" } }}
                  keyboardType="numeric"
                  placeholder="06:00"
                  maxLength={5}
                  dense={false}
                  inputStyle={styles.timeInputText}
                />
              </View>
              <View style={styles.timeInputWrapper}>
                <TextInput
                  mode="outlined"
                  label="End Time (HH:mm)"
                  value={endTimeInput}
                  onChangeText={setEndTimeInput}
                  style={styles.timeInput}
                  theme={{ colors: { primary: "#4ECDC4" } }}
                  keyboardType="numeric"
                  placeholder="07:00"
                  maxLength={5}
                  dense={false}
                  inputStyle={styles.timeInputText}
                />
              </View>
            </View>

            <TextInput
              mode="outlined"
              label="Workout Name *"
              value={newWorkout.name}
              onChangeText={(text) =>
                setNewWorkout((prev) => ({ ...prev, name: text }))
              }
              style={styles.modalInput}
              theme={{ colors: { primary: "#4ECDC4" } }}
            />

            <View style={styles.locationPicker}>
              <Text style={styles.locationLabel}>Fitness Location</Text>
              <Text style={styles.locationText}>
                {locationName || "Get location in..."}
              </Text>

              <MapView
                style={styles.map}
                initialRegion={
                  selectedLocation
                    ? {
                        latitude: selectedLocation.coords.latitude,
                        longitude: selectedLocation.coords.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }
                    : null
                }
                onPress={(e) => {
                  const newLocation = {
                    coords: e.nativeEvent.coordinate,
                  };
                  updateLocationInfo(newLocation);
                }}
              >
                {selectedLocation && (
                  <Marker
                    coordinate={selectedLocation.coords}
                    draggable
                    onDragEnd={(e) => {
                      const newLocation = {
                        coords: e.nativeEvent.coordinate,
                      };
                      updateLocationInfo(newLocation);
                    }}
                  />
                )}
              </MapView>
            </View>

            <View style={styles.reminderContainer}>
              <View style={styles.reminderRow}>
                <Text style={styles.reminderLabel}>Enable Reminder</Text>
                <Switch
                  value={enableReminder}
                  onValueChange={setEnableReminder}
                  color="#4ECDC4"
                />
              </View>
              {enableReminder && (
                <View style={styles.reminderTimeContainer}>
                  <Text style={styles.reminderLabel}>Reminder Time (minutes before)</Text>
                  <TextInput
                    mode="outlined"
                    value={reminderTime}
                    onChangeText={(text) => {
                      // 只允许输入数字
                      const numericValue = text.replace(/[^0-9]/g, '');
                      setReminderTime(numericValue);
                    }}
                    keyboardType="numeric"
                    style={styles.reminderTimeInput}
                    theme={{ colors: { primary: "#4ECDC4" } }}
                    dense={true}
                  />
                </View>
              )}
            </View>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons 
                  name="alert-circle" 
                  size={20} 
                  color="#FF6B6B" 
                />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <Button
              mode="contained"
              onPress={handleAddWorkout}
              style={styles.modalButton}
              buttonColor="#4ECDC4"
              loading={loading}
              disabled={loading}
            >
              Add Workout
            </Button>
          </Surface>
        </View>
      </RNModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    padding: 20,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
  },
  headerSubtitle: {
    fontSize: 16,
    color: "white",
    opacity: 0.8,
    marginTop: 5,
  },
  content: {
    flex: 1,
    padding: 15,
    marginTop: -30,
  },
  dayCard: {
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "white",
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  addButton: {
    borderRadius: 20,
  },
  workoutItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    position: "relative",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  deleteButton: {
    position: "absolute",
    top: 15,
    right: 15,
    padding: 8,
  },
  emptyDay: {
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  emptySubtext: {
    marginTop: 5,
    fontSize: 14,
    color: "#999",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 1000,
  },
  modalContent: {
    width: "90%",
    padding: 20,
    borderRadius: 15,
    backgroundColor: "white",
    zIndex: 1001,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  modalInput: {
    marginBottom: 15,
  },
  modalButton: {
    marginTop: 10,
    borderRadius: 8,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  timeInputWrapper: {
    flex: 1,
  },
  timeInput: {
    fontSize: 18,
    height: 60,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  timeInputText: {
    fontSize: 20,
    letterSpacing: 1,
  },
  locationPicker: {
    marginBottom: 15,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  map: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorText: {
    color: '#FF6B6B',
    marginLeft: 8,
    fontSize: 14,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  reminderContainer: {
    marginBottom: 15,
  },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reminderLabel: {
    fontSize: 14,
    color: '#333',
  },
  reminderTimeContainer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reminderTimeInput: {
    width: 80,
    backgroundColor: '#f8f8f8',
  },
});
