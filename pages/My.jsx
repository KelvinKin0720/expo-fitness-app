import { StyleSheet, View, ScrollView, TouchableOpacity } from "react-native";
import { Text, Surface, Button, List, Switch, Avatar, ActivityIndicator } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateUserinfo } from "../redux/reducers/userinfoSlice";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

// Firestore collection name for notifications
const NOTIFICATIONS_COLLECTION = "notifications";
// Key for backup in AsyncStorage
const NOTIFICATION_SETTINGS_KEY = "@fithub_notification_settings";

export default function My({ navigation }) {
  const [notifications, setNotifications] = useState(true);
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const userinfo = useSelector((state) => state.userinfo.userinfo);
  const workouts = useSelector((state) => state.workouts.workouts);

  // Load notification settings from Firestore
  useEffect(() => {
    const loadNotificationSettings = async () => {
      if (!userinfo?.id) return;
      
      try {
        setLoading(true);
        // Try to get notification settings from Firestore first
        const notificationsDocRef = doc(db, NOTIFICATIONS_COLLECTION, userinfo.id);
        const notificationsDoc = await getDoc(notificationsDocRef);
        
        if (notificationsDoc.exists()) {
          // Settings found in Firestore
          setNotifications(notificationsDoc.data().enabled);
          
          // Also save to AsyncStorage as backup
          await AsyncStorage.setItem(
            NOTIFICATION_SETTINGS_KEY,
            JSON.stringify(notificationsDoc.data().enabled)
          );
        } else {
          // No settings in Firestore, try AsyncStorage as fallback
          const savedSettings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
          if (savedSettings !== null) {
            const parsedSettings = JSON.parse(savedSettings);
            setNotifications(parsedSettings);
            
            // Save to Firestore for future use
            await setDoc(notificationsDocRef, { enabled: parsedSettings });
          }
        }
      } catch (error) {
        console.error("Error loading notification settings from Firestore:", error);
        
        // Try AsyncStorage as fallback if Firestore fails
        try {
          const savedSettings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
          if (savedSettings !== null) {
            setNotifications(JSON.parse(savedSettings));
          }
        } catch (backupError) {
          console.error("Error loading settings from backup:", backupError);
        }
      } finally {
        setLoading(false);
      }
    };

    loadNotificationSettings();
  }, [userinfo]);

  // Handle notification toggle - save to Firestore and AsyncStorage
  const handleNotificationToggle = async (value) => {
    if (!userinfo?.id) return;
    
    try {
      setLoading(true);
      
      // Save to Firestore
      const notificationsDocRef = doc(db, NOTIFICATIONS_COLLECTION, userinfo.id);
      await setDoc(notificationsDocRef, { enabled: value });
      
      // Also save to AsyncStorage as backup
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(value));
      
      setNotifications(value);
    } catch (error) {
      console.error("Error saving notification settings to Firestore:", error);
      
      // Try to save to AsyncStorage only
      try {
        await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(value));
        setNotifications(value);
      } catch (backupError) {
        console.error("Backup save also failed:", backupError);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      // Clear local user info
      await AsyncStorage.removeItem("userinfo");
      dispatch(updateUserinfo(null));
      navigation.replace("Login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Get user nickname initials for avatar
  const getInitials = (nickname) => {
    return nickname ? nickname.charAt(0).toUpperCase() : "U";
  };

  // Add achievement calculation function
  const calculateAchievements = () => {
    if (!workouts.length) return [];
    
    const achievements = [];
    
    // Calculate total workouts
    const totalWorkouts = workouts.length;
    if (totalWorkouts >= 1) {
      achievements.push({
        id: 'first-workout',
        icon: 'trophy',
        title: 'First Workout',
        description: 'Completed your first workout',
        date: new Date(workouts[0].date).toLocaleDateString(),
        color: '#FFD700' 
      });
    }
    if (totalWorkouts >= 5) {
      achievements.push({
        id: 'workout-streak',
        icon: 'fire',
        title: 'Workout Warrior',
        description: 'Completed 5 workouts',
        date: new Date(workouts[4].date).toLocaleDateString(),
        color: '#FF6B6B'
      });
    }

    if (workouts.length >= 2) {
      const firstWeight = parseFloat(workouts[workouts.length - 1].metrics.weightAfter);
      const latestWeight = parseFloat(workouts[0].metrics.weightAfter);
      const weightLoss = firstWeight - latestWeight;
      
      if (weightLoss > 0) {
        achievements.push({
          id: 'weight-loss',
          icon: 'scale-bathroom',
          title: 'Weight Loss Champion',
          description: `Lost ${weightLoss.toFixed(1)}kg`,
          date: new Date(workouts[0].date).toLocaleDateString(),
          color: '#4ECDC4'
        });
      }
    }

    // Calculate highest heart rate
    const maxHeartRate = Math.max(...workouts.map(w => parseInt(w.metrics.heartRateAfter)));
    if (maxHeartRate > 120) {
      achievements.push({
        id: 'high-intensity',
        icon: 'heart-pulse',
        title: 'High Intensity',
        description: `Reached ${maxHeartRate} BPM`,
        date: new Date(workouts.find(w => parseInt(w.metrics.heartRateAfter) === maxHeartRate).date).toLocaleDateString(),
        color: '#FF4081'
      });
    }

    // Calculate longest workout time
    const maxDuration = Math.max(...workouts.map(w => parseInt(w.duration)));
    if (maxDuration >= 60) {
      achievements.push({
        id: 'endurance',
        icon: 'clock-time-eight',
        title: 'Endurance Master',
        description: `Completed a ${maxDuration}-minute workout`,
        date: new Date(workouts.find(w => parseInt(w.duration) === maxDuration).date).toLocaleDateString(),
        color: '#7C4DFF'
      });
    }

    return achievements;
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FF6B6B", "#4ECDC4"]} style={styles.header}>
        <View style={styles.profileHeader}>
          <Avatar.Text
            size={80}
            label={getInitials(userinfo?.nickname)}
            style={styles.avatar}
            color="#FF6B6B"
            backgroundColor="white"
          />
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{userinfo?.nickname || "Guest"}</Text>
            <Text style={styles.email}>{userinfo?.email || userinfo?.username}</Text>
            <Text style={styles.joinDate}>
              Member since {new Date(userinfo?.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <Surface style={styles.achievementsCard}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          {calculateAchievements().length > 0 ? (
            calculateAchievements().map((achievement) => (
              <View key={achievement.id} style={styles.achievementItem}>
                <View style={[styles.achievementIcon, { backgroundColor: achievement.color }]}>
                  <MaterialCommunityIcons
                    name={achievement.icon}
                    size={24}
                    color="white"
                  />
                </View>
                <View style={styles.achievementInfo}>
                  <Text style={styles.achievementTitle}>{achievement.title}</Text>
                  <Text style={styles.achievementDesc}>{achievement.description}</Text>
                  <Text style={styles.achievementDate}>{achievement.date}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyAchievements}>
              <MaterialCommunityIcons
                name="trophy-outline"
                size={40}
                color="#666"
              />
              <Text style={styles.emptyText}>No achievements yet</Text>
              <Text style={styles.emptySubtext}>Complete workouts to earn achievements</Text>
            </View>
          )}
        </Surface>

        <Surface style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <List.Item
            title="Notifications"
            description="Receive workout reminders"
            left={props => <List.Icon {...props} icon="bell-outline" />}
            right={props => (
              loading ? 
              <ActivityIndicator size={24} color="#4ECDC4" style={{marginRight: 10}} /> :
              <Switch
                value={notifications}
                onValueChange={handleNotificationToggle}
                color="#4ECDC4"
              />
            )}
          />
          <List.Item
            title="Change Password"
            left={props => <List.Icon {...props} icon="lock" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => navigation.navigate("ChangePassword")}
          />
          <List.Item
            title="About"
            description="Version 1.0.0"
            left={props => <List.Icon {...props} icon="information" />}
            onPress={() => navigation.navigate("Splash")}
          />
        </Surface>

        <Button
          mode="outlined"
          onPress={handleLogout}
          style={styles.logoutButton}
          icon="logout"
          textColor="#FF6B6B"
        >
          Log Out
        </Button>
      </ScrollView>
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
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    borderWidth: 3,
    borderColor: "white",
  },
  profileInfo: {
    marginLeft: 20,
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
  },
  email: {
    fontSize: 14,
    color: "white",
    opacity: 0.8,
  },
  joinDate: {
    fontSize: 12,
    color: "white",
    opacity: 0.6,
    marginTop: 4,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    padding: 15,
    marginTop: -30,
  },
  achievementsCard: {
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    backgroundColor: "white",
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  achievementItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  achievementIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  achievementDesc: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  achievementDate: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  settingsCard: {
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    backgroundColor: "white",
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  logoutButton: {
    marginVertical: 20,
    borderColor: "#FF6B6B",
    borderRadius: 8,
  },
  emptyAchievements: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
    textAlign: 'center',
  },
});
