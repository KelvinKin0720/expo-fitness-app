import { StyleSheet, View, ScrollView, Modal as RNModal, TouchableOpacity, Image, Dimensions } from "react-native";
import { Text, Surface, Button, TextInput, IconButton, ActivityIndicator } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState, useEffect } from "react";
import { LineChart } from "react-native-gifted-charts";
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { useSelector, useDispatch } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateWorkouts, addWorkout } from "../redux/reducers/workoutsSlice";
import Toast from "react-native-toast-message";
import { updateUserinfo } from "../redux/reducers/userinfoSlice";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc, collection } from "firebase/firestore";
import { withNetworkCheck, showNetworkError, saveOfflineData } from '../utils/networkUtils';

const screenWidth = Dimensions.get("window").width;

// Firestore collection name
const WORKOUTS_COLLECTION = "workouts";
// Key for backup in AsyncStorage
const WORKOUTS_STORAGE_KEY = "@fithub_workouts_";
// Firestore collection for users
const USERS_COLLECTION = "users";

export default function Workouts() {
  const dispatch = useDispatch();
  const userinfo = useSelector((state) => state.userinfo.userinfo);
  const workoutRecords = useSelector((state) => state.workouts.workouts);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('weight');
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingWorkout, setSavingWorkout] = useState(false);

  const [chartData, setChartData] = useState({
    weight: [],
    heartRate: []
  });

  // Load user workout records
  useEffect(() => {
    loadUserWorkouts();
  }, [userinfo]);

  const loadUserWorkouts = async () => {
    try {
      if (!userinfo?.id) return;
      
      setLoading(true);
      
      // Try to get workouts from Firestore first
      const workoutsDocRef = doc(db, WORKOUTS_COLLECTION, userinfo.id);
      const workoutsDoc = await getDoc(workoutsDocRef);
      
      if (workoutsDoc.exists()) {
        // Workouts found in Firestore
        const firestoreWorkouts = workoutsDoc.data().workouts || [];
        dispatch(updateWorkouts(firestoreWorkouts));
        
        // Process chart data
        updateChartData(firestoreWorkouts);
        
        // Also save to AsyncStorage as backup
        await AsyncStorage.setItem(
          `${WORKOUTS_STORAGE_KEY}${userinfo.id}`,
          JSON.stringify(firestoreWorkouts)
        );
      } else {
        // No workouts in Firestore, try AsyncStorage as fallback
        const savedWorkouts = await AsyncStorage.getItem(`${WORKOUTS_STORAGE_KEY}${userinfo.id}`);
        
        if (savedWorkouts) {
          const parsedWorkouts = JSON.parse(savedWorkouts);
          dispatch(updateWorkouts(parsedWorkouts));
          
          // Process chart data
          updateChartData(parsedWorkouts);
          
          // Save to Firestore for future use
          await setDoc(workoutsDocRef, { workouts: parsedWorkouts });
        }
      }
    } catch (error) {
      console.error('Error loading workouts from Firestore:', error);
      
      // Try AsyncStorage as fallback if Firestore fails
      try {
        const savedWorkouts = await AsyncStorage.getItem(`${WORKOUTS_STORAGE_KEY}${userinfo.id}`);
        if (savedWorkouts) {
          const parsedWorkouts = JSON.parse(savedWorkouts);
          dispatch(updateWorkouts(parsedWorkouts));
          
          // Process chart data
          updateChartData(parsedWorkouts);
        }
      } catch (backupError) {
        console.error('Error loading from backup:', backupError);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Failed to load workout records",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const updateChartData = (workouts) => {
    // 先根據日期排序（由舊到新）
    const sortedWorkouts = [...workouts].sort((a, b) => new Date(a.date) - new Date(b.date));
    // 取最後7筆
    const recentWorkouts = sortedWorkouts.slice(-7);
    
    const weightData = recentWorkouts.map(record => ({
      value: parseFloat(record.metrics.weightAfter),
      dataPointText: `${record.metrics.weightAfter}`,
      showDataPoint: true,
      textShiftY: 20, 
      textShiftX: 0,
      textFontSize: 12,
    }));

    const heartRateData = recentWorkouts.map(record => ({
      value: parseInt(record.metrics.heartRateAfter),
      dataPointText: record.metrics.heartRateAfter,
      showDataPoint: true,
      textShiftY: 20, 
      textShiftX: 0,
      textFontSize: 12,
    }));

    setChartData({
      weight: weightData,
      heartRate: heartRateData
    });
  };

  // Save workout record to Firestore and AsyncStorage  
  const handleSaveWorkout = async () => {
    try {
      setSavingWorkout(true);
      
      const newWorkout = {
        ...newRecord,
        date: new Date().toISOString(),
        userId: userinfo.id
      };

      const currentWorkouts = [newWorkout, ...workoutRecords];
      
      // 使用网络检查包装器处理保存操作
      const success = await withNetworkCheck(
        async () => {
          // Save to Firestore
          const workoutRef = doc(db, "workouts", userinfo.id);
          await setDoc(workoutRef, { workouts: currentWorkouts });

          // Update workout records in Redux
          dispatch(addWorkout(newWorkout));
          
          // Save workout record to local storage
          const storageKey = `${WORKOUTS_STORAGE_KEY}${userinfo.id}`;
          await AsyncStorage.setItem(storageKey, JSON.stringify(currentWorkouts));
          
          // Update user information in AsyncStorage
          const updatedUserInfo = {
            ...userinfo,
            weight: parseFloat(newWorkout.metrics.weightAfter)
          };
          await AsyncStorage.setItem('userinfo', JSON.stringify(updatedUserInfo));
          
          dispatch(updateUserinfo(updatedUserInfo));
          updateChartData(currentWorkouts);
          
          setModalVisible(false);
          Toast.show({
            type: "success",
            text1: "Success",
            text2: "Workout record added successfully",
          });
        },
        "Failed to save workout record, please check your network connection"
      );

      if (!success) {
        // 如果网络操作失败，保存到本地并标记为待同步
        const storageKey = `${WORKOUTS_STORAGE_KEY}${userinfo.id}`;
        await saveOfflineData(storageKey, { workouts: currentWorkouts });
        
        // Update workout records in Redux
        dispatch(addWorkout(newWorkout));
        
        // Update user information in AsyncStorage
        const updatedUserInfo = {
          ...userinfo,
          weight: parseFloat(newWorkout.metrics.weightAfter)
        };
        await AsyncStorage.setItem('userinfo', JSON.stringify(updatedUserInfo));
        
        dispatch(updateUserinfo(updatedUserInfo));
        updateChartData(currentWorkouts);
        
        setModalVisible(false);
        Toast.show({
          type: "success",
          text1: "Success",
          text2: "Workout saved locally (offline mode)",
        });
      }
    } catch (error) {
      console.error('Error saving workout:', error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to save workout record",
      });
    } finally {
      setSavingWorkout(false);
    }
  };

  const [newRecord, setNewRecord] = useState({
    type: "",
    duration: "",
    metrics: {
      weightBefore: userinfo?.weight?.toString() || "",
      weightAfter: "",
      heartRateBefore: "",
      heartRateAfter: ""
    },
    notes: "",
    videos: []
  });

  const handleSubmit = () => {
    setFormError("");

    if (!newRecord.type.trim()) {
      setFormError("Please enter workout type");
      return;
    }

    if (!newRecord.duration.trim()) {
      setFormError("Please enter workout duration");
      return;
    }

    const duration = parseInt(newRecord.duration);
    if (isNaN(duration) || duration <= 0) {
      setFormError("Please enter a valid duration");
      return;
    }

    const metrics = newRecord.metrics;
    const weightBefore = parseFloat(metrics.weightBefore);
    const weightAfter = parseFloat(metrics.weightAfter);
    const heartRateBefore = parseInt(metrics.heartRateBefore);
    const heartRateAfter = parseInt(metrics.heartRateAfter);

    if (isNaN(weightBefore) || weightBefore <= 0) {
      setFormError("Please enter a valid starting weight");
      return;
    }

    if (isNaN(weightAfter) || weightAfter <= 0) {
      setFormError("Please enter a valid ending weight");
      return;
    }

    if (isNaN(heartRateBefore) || heartRateBefore <= 0) {
      setFormError("Please enter a valid starting heart rate");
      return;
    }

    if (isNaN(heartRateAfter) || heartRateAfter <= 0) {
      setFormError("Please enter a valid ending heart rate");
      return;
    }

    if (!newRecord.notes.trim()) {
      setFormError("Please enter workout notes");
      return;
    }

    handleSaveWorkout();
  };

  // Record video
  const recordVideo = async () => {
    try {
      // If already has video, show prompt
      if (newRecord.videos.length > 0) {
        Toast.show({
          type: "info",
          text1: "Video limit reached",
          text2: "Only one video allowed per workout",
        });
        return;
      }

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: "error",
          text1: "Permission needed",
          text2: "Camera permission is required to record video",
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 1,
        videoMaxDuration: 60,
      });

      if (!result.canceled) {
        setNewRecord(prev => ({
          ...prev,
          videos: [{
            uri: result.assets[0].uri,
            timestamp: new Date().toISOString()
          }]
        }));
      }
    } catch (error) {
      console.error('Error recording video:', error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to record video",
      });
    }
  };

  const renderRecordCard = (record) => {
    // Format date and time
    const formatDateTime = (dateString) => {
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          // If it's an invalid date, return the original string
          return dateString;
        }
        const dateFormat = date.toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'short',
          day: '2-digit'
        });
        const timeFormat = date.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        return `${dateFormat} ${timeFormat}`;
      } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
      }
    };

    return (
      <Surface key={record.id} style={styles.recordCard}>
        <View style={styles.recordHeader}>
          <View>
            <Text style={styles.recordType}>{record.type}</Text>
            <Text style={styles.recordDate}>{formatDateTime(record.date)}</Text>
          </View>
          <Text style={styles.recordDuration}>{record.duration} min</Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <MaterialCommunityIcons name="scale" size={20} color="#666" />
            <Text style={styles.metricLabel}>Weight</Text>
            <Text style={styles.metricValue}>
              {record.metrics.weightBefore} → {record.metrics.weightAfter} kg
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <MaterialCommunityIcons name="heart-pulse" size={20} color="#666" />
            <Text style={styles.metricLabel}>Heart Rate</Text>
            <Text style={styles.metricValue}>
              {record.metrics.heartRateBefore} → {record.metrics.heartRateAfter} bpm
            </Text>
          </View>
        </View>

        {record.videos.length > 0 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.videosScroll}
          >
            {record.videos.map((video, index) => (
              <View key={index} style={styles.videoContainer}>
                <Video
                  source={{ uri: video.uri }}
                  style={styles.videoPreview}
                  useNativeControls
                  resizeMode="cover"
                />
              </View>
            ))}
          </ScrollView>
        )}

        <Text style={styles.notes}>{record.notes}</Text>
      </Surface>
    );
  };

  // 修改模态框中的媒体部分
  const renderModalMediaSection = () => (
    <>
      <Button
        mode="outlined"
        onPress={recordVideo}
        icon="video"
        style={styles.videoButton}
      >
        Record Video
      </Button>

      {newRecord.videos.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.videosScroll}
        >
          {newRecord.videos.map((video, index) => (
            <View key={index} style={styles.videoPreviewContainer}>
              <Video
                source={{ uri: video.uri }}
                style={styles.videoPreview}
                useNativeControls
                resizeMode="cover"
              />
              <IconButton
                icon="close"
                size={20}
                onPress={() => {
                  setNewRecord(prev => ({
                    ...prev,
                    videos: prev.videos.filter((_, i) => i !== index)
                  }));
                }}
                style={styles.removeButton}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </>
  );

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons 
        name="dumbbell" 
        size={60} 
        color="#ccc" 
      />
      <Text style={styles.emptyText}>No workout records yet</Text>
      <Text style={styles.emptySubtext}>Start tracking your fitness journey!</Text>
      <Button
        mode="contained"
        style={styles.addFirstButton}
        buttonColor="#4ECDC4"
        onPress={() => setModalVisible(true)}
      >
        Add Your First Workout
      </Button>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#FF6B6B", "#4ECDC4"]}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Workout Records</Text>
        <Text style={styles.headerSubtitle}>Track your progress</Text>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4ECDC4" />
            <Text style={styles.loadingText}>Loading your workouts...</Text>
          </View>
        ) : (
          <>
            <View style={styles.metricToggle}>
              <TouchableOpacity 
                style={[
                  styles.metricButton,
                  selectedMetric === 'weight' && styles.metricButtonActive
                ]}
                onPress={() => setSelectedMetric('weight')}
              >
                <MaterialCommunityIcons 
                  name="scale-bathroom" 
                  size={24} 
                  color={selectedMetric === 'weight' ? "#FF6B6B" : "#666"} 
                />
                <Text style={[
                  styles.metricButtonText,
                  selectedMetric === 'weight' && styles.metricButtonTextActive
                ]}>Weight</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.metricButton,
                  selectedMetric === 'heartRate' && styles.metricButtonActive
                ]}
                onPress={() => setSelectedMetric('heartRate')}
              >
                <MaterialCommunityIcons 
                  name="heart-pulse" 
                  size={24} 
                  color={selectedMetric === 'heartRate' ? "#FF6B6B" : "#666"} 
                />
                <Text style={[
                  styles.metricButtonText,
                  selectedMetric === 'heartRate' && styles.metricButtonTextActive
                ]}>Heart Rate</Text>
              </TouchableOpacity>
            </View>

            {/* 数据图表 */}
            <Surface style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>
                  {selectedMetric === 'weight' ? 'Weight Progress' : 'Heart Rate Progress'}
                </Text>
              </View>
              {chartData[selectedMetric].length > 0 ? (
                <LineChart
                  data={chartData[selectedMetric]}
                  width={screenWidth - 100}
                  height={220}
                  spacing={40}
                  color="#FF6B6B"
                  thickness={2}
                  initialSpacing={20}
                  endSpacing={20}
                  noOfSections={6}
                  maxValue={selectedMetric === 'weight' ? 
                    Math.max(...chartData.weight.map(d => d.value)) + 5 : 
                    Math.max(...chartData.heartRate.map(d => d.value)) + 20
                  }
                  yAxisColor="rgba(0,0,0,0.1)"
                  xAxisColor="rgba(0,0,0,0.1)"
                  yAxisTextStyle={{ color: "#666" }}
                  hideDataPoints={false}
                  showValuesAsDataPointText={true}
                  showTextOnDataPoints={true}
                  textColor="#666"
                  hideXAxisText={true} 
                  dataPointsColor="#FF6B6B"
                  dataPointsRadius={5}
                  curved
                />
              ) : (
                <View style={styles.emptyChartContainer}>
                  <Text style={styles.emptyChartText}>No data available</Text>
                </View>
              )}
            </Surface>

            <Button
              mode="contained"
              onPress={() => setModalVisible(true)}
              style={styles.addButton}
              buttonColor="#4ECDC4"
              icon="plus"
            >
              Add New Record
            </Button>

            {workoutRecords.length > 0 ? (
              workoutRecords.map((record) => renderRecordCard(record))
            ) : (
              <EmptyState />
            )}
          </>
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
              <Text style={styles.modalTitle}>Add Workout Record</Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setModalVisible(false)}
              />
            </View>

            <ScrollView>
              <TextInput
                mode="outlined"
                label="Workout Type"
                value={newRecord.type}
                onChangeText={(text) => setNewRecord({...newRecord, type: text})}
                style={styles.modalInput}
              />

              <TextInput
                mode="outlined"
                label="Duration (minutes)"
                value={newRecord.duration}
                onChangeText={(text) => setNewRecord({...newRecord, duration: text})}
                style={styles.modalInput}
                keyboardType="numeric"
              />

              <Text style={styles.sectionTitle}>Before Workout</Text>
              <View style={styles.metricsInput}>
                <TextInput
                  mode="outlined"
                  label="Weight (kg)"
                  value={newRecord.metrics.weightBefore}
                  onChangeText={(text) => setNewRecord({
                    ...newRecord,
                    metrics: {...newRecord.metrics, weightBefore: text}
                  })}
                  style={[styles.modalInput, styles.halfInput]}
                  keyboardType="numeric"
                />
                
                <TextInput
                  mode="outlined"
                  label="Heart Rate (bpm)"
                  value={newRecord.metrics.heartRateBefore}
                  onChangeText={(text) => setNewRecord({
                    ...newRecord,
                    metrics: {...newRecord.metrics, heartRateBefore: text}
                  })}
                  style={[styles.modalInput, styles.halfInput]}
                  keyboardType="numeric"
                />
              </View>

              <Text style={styles.sectionTitle}>After Workout</Text>
              <View style={styles.metricsInput}>
                <TextInput
                  mode="outlined"
                  label="Weight (kg)"
                  value={newRecord.metrics.weightAfter}
                  onChangeText={(text) => setNewRecord({
                    ...newRecord,
                    metrics: {...newRecord.metrics, weightAfter: text}
                  })}
                  style={[styles.modalInput, styles.halfInput]}
                  keyboardType="numeric"
                />
                
                <TextInput
                  mode="outlined"
                  label="Heart Rate (bpm)"
                  value={newRecord.metrics.heartRateAfter}
                  onChangeText={(text) => setNewRecord({
                    ...newRecord,
                    metrics: {...newRecord.metrics, heartRateAfter: text}
                  })}
                  style={[styles.modalInput, styles.halfInput]}
                  keyboardType="numeric"
                />
              </View>

              <TextInput
                mode="outlined"
                label="Notes"
                value={newRecord.notes}
                onChangeText={(text) => setNewRecord({...newRecord, notes: text})}
                style={styles.modalInput}
                multiline
              />

              {renderModalMediaSection()}

              {formError ? (
                <View style={styles.errorContainer}>
                  <MaterialCommunityIcons name="alert-circle" size={20} color="#FF6B6B" />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}

              <Button
                mode="contained"
                onPress={handleSubmit}
                style={styles.modalButton}
                buttonColor="#4ECDC4"
                loading={savingWorkout}
                disabled={savingWorkout}
              >
                Save Record
              </Button>
            </ScrollView>
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
  segmentedButtons: {
    marginBottom: 15,
  },
  chartCard: {
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  addButton: {
    marginBottom: 15,
    borderRadius: 8,
  },
  recordCard: {
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  recordType: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  recordDate: {
    fontSize: 14,
    color: "#666",
  },
  recordDuration: {
    fontSize: 14,
    color: "#4ECDC4",
    fontWeight: "bold",
  },
  metricsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  metricColumn: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 14,
    color: "#333",
    marginBottom: 3,
  },
  notes: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "90%",
    padding: 20,
    borderRadius: 15,
    backgroundColor: "white",
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginTop: 10,
    marginBottom: 10,
  },
  modalButton: {
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 8,
  },
  metricToggle: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    padding: 5,
    backgroundColor: 'white',
    borderRadius: 15,
  },
  metricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
  },
  metricButtonActive: {
    backgroundColor: 'rgba(255,107,107,0.1)',
  },
  metricButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
  },
  metricButtonTextActive: {
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  metricValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
    marginTop: 2,
  },
  metricsInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  memoryButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 15,
  },
  memoryButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  memoriesScroll: {
    marginVertical: 10,
  },
  memoryPreviewContainer: {
    marginRight: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  memoryPreview: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  removeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  shareButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  videoButton: {
    marginVertical: 15,
  },
  videosScroll: {
    marginVertical: 10,
  },
  videoContainer: {
    marginRight: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  videoPreview: {
    width: 160,
    height: 90,
    borderRadius: 10,
  },
  videoPreviewContainer: {
    marginRight: 10,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  chartLabel: {
    color: '#666',
    fontSize: 10,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 15,
    fontWeight: 'bold',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
    textAlign: 'center',
  },
  addFirstButton: {
    marginTop: 20,
    borderRadius: 20,
    paddingHorizontal: 20,
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
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyChartContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: {
    color: '#666',
    fontSize: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 10,
  },
}); 