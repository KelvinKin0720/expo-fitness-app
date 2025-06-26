import { StyleSheet, View, ScrollView } from "react-native";
import { Text, Button, Surface } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Dimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useNavigation } from '@react-navigation/native';
import { useSelector } from "react-redux";

const screenWidth = Dimensions.get("window").width;

export default function Index() {
  const navigation = useNavigation();
  const userinfo = useSelector((state) => state.userinfo.userinfo);
  
  const height = userinfo?.height || 0;
  const currentWeight = userinfo?.weight || 0;

  // The function for calculating BMI
  const calculateBMI = (weight, height) => {
    return (weight / (height * height)).toFixed(1);
  };

  // Obtain BMI status
  const getBMIStatus = (bmi) => {
    if (bmi < 18.5) return { text: "Underweight", color: "#FFA726" };
    if (bmi < 24.9) return { text: "Normal", color: "#66BB6A" };
    if (bmi < 29.9) return { text: "Overweight", color: "#FF7043" };
    return { text: "Obese", color: "#EF5350" };
  };

  // current BMI
  const currentBMI = calculateBMI(currentWeight, height);
  const bmiStatus = getBMIStatus(currentBMI);

  // Retrieve schedule data from Redux
  const schedules = useSelector((state) => state.schedule.schedules);

  // Get tomorrow's date and corresponding day of the week
  const getTomorrowSchedule = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = days[tomorrow.getDay()];
    
    // Search for tomorrow's schedule
    const tomorrowSchedule = schedules.find(schedule => schedule.day === tomorrowDay);
    return tomorrowSchedule?.workouts || [];
  };

  // Get tomorrow's training program
  const upcomingWorkouts = getTomorrowSchedule().map(workout => ({
    id: workout.id,
    name: workout.name,
    time: workout.time,
    trainer: workout.trainer,
    location: workout.location,
    type: workout.type || "dumbbell",
  }));

  const workouts = useSelector((state) => state.workouts.workouts);
  
  // 取最近7次運動紀錄（由舊到新）
  const sortedWorkouts = [...workouts].sort((a, b) => new Date(a.date) - new Date(b.date));
  const recentWorkouts = sortedWorkouts.slice(-7);

  // 體重圖表資料
  const getWeightData = () => {
    return recentWorkouts.map(workout => ({
      value: parseFloat(workout.metrics.weightAfter),
      dataPointText: `${workout.metrics.weightAfter}`,
      showDataPoint: true,
      textShiftY: 20,
      textShiftX: 0,
      textFontSize: 12,
    }));
  };

  // 心率圖表資料
  const getHeartRateData = () => {
    return recentWorkouts.map(workout => ({
      value: parseInt(workout.metrics.heartRateAfter),
      dataPointText: workout.metrics.heartRateAfter,
      showDataPoint: true,
      textShiftY: 20,
      textShiftX: 0,
      textFontSize: 12,
    }));
  };

  // y軸範圍優化
  const weightValues = getWeightData().map(d => d.value).filter(v => !isNaN(v));
  const minWeight = Math.min(...weightValues);
  const maxWeight = Math.max(...weightValues);
  const yAxisMin = weightValues.length > 1 ? Math.floor(minWeight - 2) : minWeight - 2;
  const yAxisMax = weightValues.length > 1 ? Math.ceil(maxWeight + 2) : maxWeight + 2;

  const heartRateValues = getHeartRateData().map(d => d.value).filter(v => !isNaN(v));
  const minHR = Math.min(...heartRateValues);
  const maxHR = Math.max(...heartRateValues);
  const yAxisMinHR = heartRateValues.length > 1 ? Math.floor(minHR - 5) : minHR - 5;
  const yAxisMaxHR = heartRateValues.length > 1 ? Math.ceil(maxHR + 5) : maxHR + 5;

  // Get recent workout records
  const getRecentWorkouts = () => {
    return workouts.slice(-5).reverse().map(workout => ({
      id: workout.id,
      type: workout.type,
      duration: `${workout.duration} min`,
      date: new Date(workout.date).toLocaleString(),
    }));
  };

  return (
    <>
      <ScrollView style={styles.container}>
        <LinearGradient colors={["#FF6B6B", "#4ECDC4"]} style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Dashboard</Text>
              <Text style={styles.headerSubtitle}>Keep pushing your limits!</Text>
            </View>
            <MaterialCommunityIcons
              name="lightning-bolt"
              size={40}
              color="white"
            />
          </View>
        </LinearGradient>

        <Button
          mode="contained"
          icon="heart-pulse"
          onPress={() => navigation.navigate('HealthStatus')}
          style={styles.healthButton}
          labelStyle={styles.healthButtonLabel}
        >
          View Health Status
        </Button>

        <Button
          mode="contained"
          icon="robot"
          onPress={() => navigation.navigate('AskAI')}
          style={styles.aiButton}
          labelStyle={styles.aiButtonLabel}
        >
          Virtual Fitness Coach
        </Button>

        <View style={styles.statsContainer}>
          <Surface style={styles.statsCard}>
            <View style={styles.statsIconContainer}>
              <MaterialCommunityIcons 
                name="scale-bathroom" 
                size={24} 
                color="#FF6B6B" 
              />
            </View>
            <View style={styles.statsContent}>
              <Text style={styles.statsTitle}>Current Weight</Text>
              <Text style={styles.statsValue}>
                {currentWeight}<Text style={styles.statsUnit}> kg</Text>
              </Text>
            </View>
          </Surface>
          
          <Surface style={styles.statsCard}>
            <View style={styles.statsIconContainer}>
              <MaterialCommunityIcons 
                name="human-male-height" 
                size={24} 
                color="#4ECDC4" 
              />
            </View>
            <View style={styles.statsContent}>
              <Text style={styles.statsTitle}>Height</Text>
              <Text style={styles.statsValue}>
                {(height * 100).toFixed(0)}<Text style={styles.statsUnit}> cm</Text>
              </Text>
            </View>
          </Surface>
        </View>

        <Surface style={styles.bmiCard}>
          <View style={styles.bmiContent}>
            <View>
              <Text style={styles.bmiTitle}>Current BMI</Text>
              <Text style={styles.bmiValue}>{currentBMI}</Text>
              <Text style={[styles.bmiStatus, { color: bmiStatus.color }]}>
                {bmiStatus.text}
              </Text>
            </View>
            <MaterialCommunityIcons 
              name="chart-bell-curve" 
              size={40} 
              color="#4ECDC4" 
            />
          </View>
        </Surface>

        <Text style={styles.sectionTitle}>
          <MaterialCommunityIcons name="calendar-clock" size={24} color="#333" />
          {" Upcoming Workouts"}
        </Text>
        
        {upcomingWorkouts.length > 0 ? (
          upcomingWorkouts.map((workout) => (
            <Surface key={workout.id} style={styles.upcomingCard}>
              <View style={styles.upcomingContent}>
                <View
                  style={[styles.iconContainer, { backgroundColor: "#4ECDC4" }]}
                >
                  <MaterialCommunityIcons
                    name={workout.type}
                    size={30}
                    color="white"
                  />
                </View>
                <View style={styles.upcomingInfo}>
                  <Text style={styles.upcomingName}>{workout.name}</Text>
                  <View style={styles.upcomingDetails}>
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={16}
                      color="#666"
                    />
                    <Text style={styles.upcomingTime}>{workout.time}</Text>
                  </View>
                  <View style={styles.upcomingDetails}>
                    <MaterialCommunityIcons
                      name="map-marker"
                      size={16}
                      color="#666"
                    />
                    <Text style={styles.upcomingLocation}>
                      {workout.location || 'No location set'}
                    </Text>
                  </View>
                </View>
              </View>
            </Surface>
          ))
        ) : (
          <Surface style={styles.upcomingCard}>
            <View style={styles.emptyUpcoming}>
              <MaterialCommunityIcons 
                name="calendar-blank" 
                size={40} 
                color="#666" 
              />
              <Text style={styles.emptyText}>No workouts scheduled for tomorrow</Text>
              <Button
                mode="contained"
                style={styles.scheduleButton}
                buttonColor="#4ECDC4"
                onPress={() => navigation.navigate('Schedule')}
              >
                Schedule Workout
              </Button>
            </View>
          </Surface>
        )}

        <Text style={styles.sectionTitle}>
          <MaterialCommunityIcons name="chart-line" size={24} color="#333" />
          {" Progress Tracking"}
        </Text>
        <Surface style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Weight Progress</Text>
            <View style={styles.chartIcon}>
              <MaterialCommunityIcons name="scale-bathroom" size={24} color="#FF6B6B" />
            </View>
          </View>
          {weightValues.length < 2 ? (
            <View style={styles.emptyChartContainer}>
              <Text style={styles.emptyChartText}>Not enough data</Text>
            </View>
          ) : (
            <LineChart
              data={getWeightData()}
              width={screenWidth - 100}
              height={220}
              spacing={40}
              color="#FF6B6B"
              thickness={2}
              initialSpacing={20}
              endSpacing={20}
              noOfSections={6}
              maxValue={yAxisMax}
              minValue={yAxisMin}
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
          )}
        </Surface>

        <Surface style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Heart Rate Progress</Text>
            <View style={styles.chartIcon}>
              <MaterialCommunityIcons name="heart-pulse" size={24} color="#4ECDC4" />
            </View>
          </View>
          {heartRateValues.length < 2 ? (
            <View style={styles.emptyChartContainer}>
              <Text style={styles.emptyChartText}>Not enough data</Text>
            </View>
          ) : (
            <LineChart
              data={getHeartRateData()}
              width={screenWidth - 100}
              height={220}
              spacing={40}
              color="#4ECDC4"
              thickness={2}
              initialSpacing={20}
              endSpacing={20}
              noOfSections={6}
              maxValue={yAxisMaxHR}
              minValue={yAxisMinHR}
              yAxisColor="rgba(0,0,0,0.1)"
              xAxisColor="rgba(0,0,0,0.1)"
              yAxisTextStyle={{ color: "#666" }}
              hideDataPoints={false}
              showValuesAsDataPointText={true}
              showTextOnDataPoints={true}
              textColor="#666"
              hideXAxisText={true}
              dataPointsColor="#4ECDC4"
              dataPointsRadius={5}
              curved
            />
          )}
        </Surface>

        <Text style={styles.sectionTitle}>Recent Workouts</Text>
        {getRecentWorkouts().map((workout) => (
          <Surface key={workout.id} style={styles.workoutCard}>
            <View style={styles.workoutContent}>
              <View style={[styles.iconContainer, { backgroundColor: "#4ECDC4" }]}>
                <MaterialCommunityIcons name="dumbbell" size={30} color="white" />
              </View>
              <View style={styles.workoutInfo}>
                <Text style={styles.workoutName}>{workout.type}</Text>
                <View style={styles.workoutDetails}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#666" />
                  <Text style={styles.workoutDate}>{workout.date}</Text>
                </View>
                <View style={styles.workoutStats}>
                  <View style={styles.workoutStat}>
                    <MaterialCommunityIcons name="timer" size={16} color="#4ECDC4" />
                    <Text style={styles.workoutDuration}>{workout.duration}</Text>
                  </View>
      
                </View>
              </View>
            </View>
          </Surface>
        ))}
      </ScrollView>
    </>
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
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
    marginTop: 16,
  },
  statsCard: {
    width: "47%",
    padding: 15,
    borderRadius: 15,
    backgroundColor: "white",
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  statsIconContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsContent: {
    alignItems: "flex-start",
  },
  statsTitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  statsUnit: {
    fontSize: 14,
    color: "#666",
    fontWeight: "normal",
  },
  editButton: {
    padding: 4,  // 增加点击区域
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    margin: 15,
    color: "#333",
    alignItems: "center",
  },
  chartCard: {
    margin: 15,
    padding: 15,
    paddingRight: 15,
    borderRadius: 15,
    backgroundColor: "white",
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    paddingRight: 0,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  chartIcon: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  dotLabel: {
    position: "absolute",
    backgroundColor: "white",
    padding: 4,
    borderRadius: 4,
    
  },
  dotValue: {
    fontSize: 12,
    color: "#666",
  },
  workoutCard: {
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 15,
    backgroundColor: "white",
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  workoutContent: {
    flexDirection: "row",
    padding: 15,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  workoutDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  workoutDate: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  workoutStats: {
    flexDirection: "row",
    marginTop: 8,
  },
  workoutStat: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 15,
  },
  workoutDuration: {
    marginLeft: 4,
    color: "#666",
  },
  workoutCalories: {
    marginLeft: 4,
    color: "#666",
  },
  upcomingCard: {
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 15,
    backgroundColor: "white",
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  upcomingContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 15,
  },
  upcomingInfo: {
    flex: 1,
    marginLeft: 15,
  },
  upcomingName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  upcomingDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  upcomingTime: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  upcomingLocation: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
    flex: 1,
  },
  bmiCard: {
    margin: 15,
    marginTop: 5,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "white",
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  bmiContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bmiTitle: {
    fontSize: 14,
    color: "#666",
  },
  bmiValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginTop: 5,
  },
  bmiStatus: {
    fontSize: 16,
    marginTop: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    padding: 20,
    borderRadius: 15,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalInput: {
    marginBottom: 20,
  },
  modalButton: {
    borderRadius: 8,
  },
  mapCard: {
    margin: 15,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "white",
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    paddingRight: 0,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  seeAll: {
    fontSize: 14,
    color: "#4ECDC4",
    fontWeight: "bold",
  },
  map: {
    width: "100%",
    height: 200,
    borderRadius: 10,
  },
  memoriesCard: {
    margin: 15,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "white",
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  memoryItem: {
    marginRight: 10,
    borderRadius: 10,
    overflow: "hidden",
  },
  memoryPreview: {
    width: 100,
    height: 150,
    borderRadius: 10,
  },
  memoryDate: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
  },
  emptyUpcoming: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginVertical: 10,
    textAlign: 'center',
  },
  scheduleButton: {
    marginTop: 10,
    borderRadius: 20,
  },
  noDataText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  emptyChartContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyChartText: {
    color: '#666',
    fontSize: 16,
    marginBottom: 15,
  },
  addWorkoutButton: {
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  healthButton: {
    margin: 16,
    backgroundColor: '#4ECDC4',
    borderRadius: 8,
  },
  healthButtonLabel: {
    fontSize: 16,
    paddingVertical: 4,
  },
  aiButton: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#6C63FF',
    borderRadius: 8,
  },
  aiButtonLabel: {
    fontSize: 16,
    paddingVertical: 4,
  },
});
