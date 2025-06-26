import { StyleSheet, View, TouchableOpacity } from "react-native";
import { useDispatch } from "react-redux";
import { LinearGradient } from "expo-linear-gradient";
import { updateUserinfo } from "../redux/reducers/userinfoSlice";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Text, Button, TextInput } from "react-native-paper";
import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import * as Notifications from "expo-notifications";
import { updateSchedules } from "../redux/reducers/scheduleSlice";
import store from "../redux/store";
import { updateWorkouts } from "../redux/reducers/workoutsSlice";
import { db } from "../firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where, 
  getDocs,
  addDoc
} from "firebase/firestore";
import { withNetworkCheck, showNetworkError } from '../utils/networkUtils';

const SCHEDULE_STORAGE_KEY = "@fithub_schedules_";
const NOTIFICATION_SETTINGS_KEY = "@fithub_notification_settings";
const USERS_COLLECTION = "users";

export default function Login() {
  const navigation = useNavigation();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [cPwd, setCPwd] = useState("");
  const [islogin, setIsLogin] = useState(true);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();

  const handleAuth = async () => {
    try {
      setLoading(true);
      if (!email || !pwd) {
        Toast.show({
          type: "error",
          text1: "Error!",
          text2: "Please enter email and password",
        });
        setLoading(false);
        return;
      }

      if (islogin) {
        // 使用网络检查包装器处理登录操作
        const success = await withNetworkCheck(
          async () => {
            // Login logic with Firestore
            const usersRef = collection(db, USERS_COLLECTION);
            const q = query(usersRef, where("email", "==", email));
            const querySnapshot = await getDocs(q);
            
            let userFound = false;
            querySnapshot.forEach((doc) => {
              const userData = doc.data();
              if (userData.password === pwd) {
                userFound = true;
                handleLoginSuccess({
                  id: doc.id,
                  email: userData.email,
                  nickname: userData.nickname,
                  height: userData.height,
                  weight: userData.weight,
                  createdAt: userData.createdAt
                });
              }
            });
            
            if (!userFound) {
              Toast.show({
                type: "error",
                text1: "Error!",
                text2: "Invalid email or password",
              });
            }
          },
          "Login failed, please check your network connection"
        );

        if (!success) {
          setLoading(false);
          return;
        }
      } else {
        // 注册逻辑
        if (!nickname || !cPwd || !height || !weight) {
          Toast.show({
            type: "error",
            text1: "Error!",
            text2: "Please fill in all fields",
          });
          setLoading(false);
          return;
        }

        if (pwd !== cPwd) {
          Toast.show({
            type: "error",
            text1: "Error!",
            text2: "Passwords do not match",
          });
          setLoading(false);
          return;
        }

        // Validate height and weight
        const heightNum = parseFloat(height);
        const weightNum = parseFloat(weight);

        if (isNaN(heightNum) || heightNum < 0.5 || heightNum > 2.5) {
          Toast.show({
            type: "error",
            text1: "Error!",
            text2: "Please enter a valid height (0.5-2.5m)",
          });
          setLoading(false);
          return;
        }

        if (isNaN(weightNum) || weightNum < 20 || weightNum > 300) {
          Toast.show({
            type: "error",
            text1: "Error!",
            text2: "Please enter a valid weight (20-300kg)",
          });
          setLoading(false);
          return;
        }

        // 使用网络检查包装器处理注册操作
        const success = await withNetworkCheck(
          async () => {
            // Check if email already exists
            const usersRef = collection(db, USERS_COLLECTION);
            const q = query(usersRef, where("email", "==", email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              Toast.show({
                type: "error",
                text1: "Error!",
                text2: "Email already exists",
              });
              return;
            }

            // Create new user in Firestore
            const userData = {
              email,
              password: pwd,
              nickname,
              height: heightNum,
              weight: weightNum,
              createdAt: new Date().toISOString(),
            };

            // Add new user to Firestore with auto-generated ID
            const docRef = await addDoc(collection(db, USERS_COLLECTION), userData);

            setIsLogin(true);
            Toast.show({
              type: "success",
              text1: "Success!",
              text2: "Registration successful, please log in!",
            });

            // Clear form
            setEmail("");
            setPwd("");
            setNickname("");
            setCPwd("");
            setHeight("");
            setWeight("");
          },
          "Registration failed, please check your network connection"
        );

        if (!success) {
          setLoading(false);
          return;
        }
      }
    } catch (error) {
      console.error("Authentication error:", error);
      Toast.show({
        type: "error",
        text1: "Error!",
        text2: "An error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle login success
  const handleLoginSuccess = async (userinfo) => {
    try {
      // 1. Save user information
      await AsyncStorage.setItem("userinfo", JSON.stringify(userinfo));
      dispatch(updateUserinfo(userinfo));

      // 2. Load schedule data
      await loadSchedulesToRedux(userinfo.id);

      // 3. Load workout data
      await loadWorkoutsToRedux(userinfo.id);

      // 4. Check notification settings and set notifications
      await initializeNotifications(userinfo.id);

      // 5. Navigate to home page
      navigation.replace("TabBar");
    } catch (error) {
      console.error("Login success handling error:", error);
    }
  };

  // Load schedule data to Redux
  const loadSchedulesToRedux = async (userId) => {
    try {
      // Try to load from Firestore
      const scheduleDoc = await getDoc(doc(db, "schedules", userId));
      
      if (scheduleDoc.exists()) {
        const schedules = scheduleDoc.data().schedules || [];
        dispatch(updateSchedules(schedules));
        console.log("Loaded schedules from Firestore:", schedules.length);
        
        // Also save to AsyncStorage for offline access
        await AsyncStorage.setItem(
          `${SCHEDULE_STORAGE_KEY}${userId}`,
          JSON.stringify(schedules)
        );
      } else {
        // Fall back to AsyncStorage if no data in Firestore
        const savedSchedules = await AsyncStorage.getItem(`${SCHEDULE_STORAGE_KEY}${userId}`);
        if (savedSchedules) {
          const parsedSchedules = JSON.parse(savedSchedules);
          dispatch(updateSchedules(parsedSchedules));
          console.log("Loaded schedules from AsyncStorage:", parsedSchedules.length);
          
          // Save to Firestore for future use
          await setDoc(doc(db, "schedules", userId), {
            schedules: parsedSchedules
          });
        }
      }
    } catch (error) {
      console.error("Error loading schedules to Redux:", error);
      
      // Try AsyncStorage as fallback
      try {
        const savedSchedules = await AsyncStorage.getItem(`${SCHEDULE_STORAGE_KEY}${userId}`);
        if (savedSchedules) {
          const parsedSchedules = JSON.parse(savedSchedules);
          dispatch(updateSchedules(parsedSchedules));
          console.log("Loaded schedules from AsyncStorage (fallback):", parsedSchedules.length);
        }
      } catch (asyncError) {
        console.error("AsyncStorage fallback failed:", asyncError);
      }
    }
  };

  // Load workout data to Redux
  const loadWorkoutsToRedux = async (userId) => {
    try {
      // Try to load from Firestore
      const workoutDoc = await getDoc(doc(db, "workouts", userId));
      
      if (workoutDoc.exists()) {
        const workouts = workoutDoc.data().workouts || [];
        dispatch(updateWorkouts(workouts));
        console.log("Loaded workouts from Firestore:", workouts.length);
        
        // Also save to AsyncStorage for offline access
        await AsyncStorage.setItem(
          `@fithub_workouts_${userId}`,
          JSON.stringify(workouts)
        );
      } else {
        // Fall back to AsyncStorage if no data in Firestore
        const savedWorkouts = await AsyncStorage.getItem(`@fithub_workouts_${userId}`);
        if (savedWorkouts) {
          const parsedWorkouts = JSON.parse(savedWorkouts);
          dispatch(updateWorkouts(parsedWorkouts));
          console.log("Loaded workouts from AsyncStorage:", parsedWorkouts.length);
          
          // Save to Firestore for future use
          await setDoc(doc(db, "workouts", userId), {
            workouts: parsedWorkouts
          });
        }
      }
    } catch (error) {
      console.error("Error loading workouts to Redux:", error);
      
      // Try AsyncStorage as fallback
      try {
        const savedWorkouts = await AsyncStorage.getItem(`@fithub_workouts_${userId}`);
        if (savedWorkouts) {
          const parsedWorkouts = JSON.parse(savedWorkouts);
          dispatch(updateWorkouts(parsedWorkouts));
          console.log("Loaded workouts from AsyncStorage (fallback):", parsedWorkouts.length);
        }
      } catch (asyncError) {
        console.error("AsyncStorage fallback failed:", asyncError);
      }
    }
  };

  // Initialize notifications
  const initializeNotifications = async (userId) => {
    try {
      // Try to load from Firestore
      const notificationDoc = await getDoc(doc(db, "notifications", userId));
      
      let notificationEnabled = true;
      if (notificationDoc.exists()) {
        notificationEnabled = notificationDoc.data().enabled;
      } else {
        // Check AsyncStorage
        const savedSettings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
        notificationEnabled = savedSettings ? JSON.parse(savedSettings) : true;
        
        // Save to Firestore for future use
        await setDoc(doc(db, "notifications", userId), {
          enabled: notificationEnabled
        });
      }

      if (notificationEnabled) {
        // Request notification permission
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === "granted") {
          await checkAndScheduleNotifications();
        }
      }
    } catch (error) {
      console.error("Error initializing notifications:", error);
      
      // Try AsyncStorage as fallback
      try {
        const savedSettings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
        const notificationEnabled = savedSettings ? JSON.parse(savedSettings) : true;
        
        if (notificationEnabled) {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status === "granted") {
            await checkAndScheduleNotifications();
          }
        }
      } catch (asyncError) {
        console.error("AsyncStorage fallback failed:", asyncError);
      }
    }
  };

  // Check and set notifications
  const checkAndScheduleNotifications = async () => {
    try {
      const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const now = new Date();
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayDay = days[today.getDay()];
      const tomorrowDay = days[tomorrow.getDay()];

      const schedules = store.getState().schedule.schedules;
      const todaySchedule = schedules.find(
        (schedule) => schedule.day === todayDay
      );
      const tomorrowSchedule = schedules.find(
        (schedule) => schedule.day === tomorrowDay
      );

      console.log("Today's schedule:", todaySchedule);
      console.log("Tomorrow's schedule:", tomorrowSchedule);

      // Cancel all existing notifications
      await Notifications.cancelAllScheduledNotificationsAsync();

      // Handle today's training
      const todayWorkouts = todaySchedule?.workouts || [];
      for (const workout of todayWorkouts) {
        const [startTime] = workout.time.split(" - ");
        const [hours, minutes] = startTime.split(":");

        const notificationDate = new Date(today);
        notificationDate.setHours(parseInt(hours));
        notificationDate.setMinutes(parseInt(minutes));

        // Set notifications only for upcoming events
        if (notificationDate > now) {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
            }),
          });
          Notifications.scheduleNotificationAsync({
            content: {
              title: "Today's Workout",
              body: `${workout.name} with ${workout.trainer} at ${workout.time}${workout.location ? `, ${workout.location}` : ''}`,
            },
            trigger: notificationDate,
          });
          console.log("Scheduled today's notification for:", notificationDate);
        }
      }

      // Handle tomorrow's training
      const tomorrowWorkouts = tomorrowSchedule?.workouts || [];
      for (const workout of tomorrowWorkouts) {
        const [startTime] = workout.time.split(" - ");
        const [hours, minutes] = startTime.split(":");

        const notificationDate = new Date(tomorrow);
        notificationDate.setHours(parseInt(hours));
        notificationDate.setMinutes(parseInt(minutes));

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
        Notifications.scheduleNotificationAsync({
          content: {
            title: "Tomorrow's Workout",
            body: `${workout.name} with ${workout.trainer} at ${workout.time}${workout.location ? `, ${workout.location}` : ''}`,
          },
          trigger: notificationDate,
        });
        console.log("Scheduled tomorrow's notification for:", notificationDate);
      }
    } catch (error) {
      console.error("Error scheduling notifications:", error);
    }
  };

  const clearForm = () => {
    setEmail("");
    setPwd("");
    setNickname("");
    setCPwd("");
    setHeight("");
    setWeight("");
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FF6B6B", "#4ECDC4"]} style={styles.background}>
        <View style={styles.card}>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="dumbbell" size={100} color="white" />
          </View>
          <Text style={styles.tit} variant="displaySmall">
            {islogin ? "FitHub Login" : "FitHub Register"}
          </Text>

          {!islogin && (
            <>
              <TextInput
                style={styles.inputItem}
                label="Nickname"
                value={nickname}
                onChangeText={setNickname}
                theme={{ colors: { primary: "#FF6B6B" } }}
              />
              <View style={styles.measurementContainer}>
                <TextInput
                  style={[styles.inputItem, styles.measurementInput]}
                  label="Height (m)"
                  value={height}
                  onChangeText={setHeight}
                  keyboardType="decimal-pad"
                  theme={{ colors: { primary: "#FF6B6B" } }}
                />
                <TextInput
                  style={[styles.inputItem, styles.measurementInput]}
                  label="Weight (kg)"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  theme={{ colors: { primary: "#FF6B6B" } }}
                />
              </View>
            </>
          )}
          <TextInput
            style={styles.inputItem}
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            theme={{ colors: { primary: "#FF6B6B" } }}
          />
          <TextInput
            style={styles.inputItem}
            label="Password"
            secureTextEntry
            value={pwd}
            onChangeText={setPwd}
            theme={{ colors: { primary: "#FF6B6B" } }}
          />
          {!islogin && (
            <TextInput
              style={styles.inputItem}
              label="Confirm Password"
              secureTextEntry
              value={cPwd}
              onChangeText={setCPwd}
              theme={{ colors: { primary: "#FF6B6B" } }}
            />
          )}
          <Button
            mode="contained"
            style={styles.button}
            buttonColor="#FF6B6B"
            onPress={handleAuth}
            loading={loading}
            disabled={loading}
          >
            {islogin ? "START YOUR JOURNEY" : "JOIN FITHUB"}
          </Button>
          <TouchableOpacity
            onPress={() => {
              setIsLogin(!islogin);
              clearForm();
            }}
          >
            <Text style={styles.link} variant="labelMedium">
              {islogin
                ? "New to FitHub? Join now!"
                : "Already a member? Login here"}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "85%",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 20,
    borderRadius: 15,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  tit: {
    color: "white",
    textAlign: "center",
    marginBottom: 30,
    fontWeight: "bold",
  },
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  inputItem: {
    marginBottom: 15,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 8,
  },
  button: {
    marginTop: 10,
    borderRadius: 8,
    paddingVertical: 8,
  },
  link: {
    color: "#fff",
    textAlign: "center",
    paddingTop: 20,
    textDecorationLine: "underline",
  },
  measurementContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  measurementInput: {
    flex: 0.48, 
    marginBottom: 0,
  },
});
