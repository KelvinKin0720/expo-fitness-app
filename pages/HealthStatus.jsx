import { StyleSheet, View, ScrollView, Dimensions } from "react-native";
import { Text, Surface, Button, ProgressBar } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { LineChart, PieChart } from "react-native-chart-kit";
import { useState } from "react";

export default function HealthStatus() {
  const userinfo = useSelector((state) => state.userinfo.userinfo);
  const workouts = useSelector((state) => state.workouts.workouts);
  const [expandedCard, setExpandedCard] = useState(null);
  
  const height = userinfo?.height || 0;
  const currentWeight = userinfo?.weight || 0;
  const targetWeight = userinfo?.targetWeight || currentWeight;
  const age = userinfo?.age || null;
  const gender = userinfo?.gender || null;
  const goal = userinfo?.goal || 'maintain';

  // Calculate BMI
  const calculateBMI = (weight, height) => {
    if (!height || !weight) return 0;
    return (weight / (height * height)).toFixed(1);
  };

  // Get BMI status and advice (English)
  const getBMIStatus = (bmi) => {
    if (bmi < 18.5) return {
      text: "Underweight",
      color: "#FFA726",
      advice: "Increase calorie intake and do strength training to build muscle mass.",
      dietAdvice: "Focus on nutrient-dense foods, increase protein, include healthy fats and complex carbs."
    };
    if (bmi < 24.9) return {
      text: "Normal",
      color: "#66BB6A",
      advice: "Maintain your healthy lifestyle and keep exercising regularly.",
      dietAdvice: "Keep a balanced diet with proteins, carbs, and healthy fats. Stay hydrated and eat fruits and vegetables."
    };
    if (bmi < 29.9) return {
      text: "Overweight",
      color: "#FF7043",
      advice: "Control your diet and increase aerobic exercise, aim for 3-4 workouts per week.",
      dietAdvice: "Control portions, choose whole foods, increase protein, reduce refined carbs and sugars."
    };
    return {
      text: "Obese",
      color: "#EF5350",
      advice: "Seek professional guidance for weight management, focus on diet and regular exercise.",
      dietAdvice: "Work with a nutritionist, focus on whole foods, lean proteins, and vegetables. Limit processed foods and sugary drinks."
    };
  };

  // Calculate workout frequency and stats (English)
  const calculateWorkoutStats = () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const recentWorkouts = workouts.filter(workout => new Date(workout.date) > lastMonth);
    const frequency = recentWorkouts.length / 4; // Average times per week

    // Calculate workout types distribution
    const workoutTypes = recentWorkouts.reduce((acc, workout) => {
      acc[workout.type] = (acc[workout.type] || 0) + 1;
      return acc;
    }, {});

    const pieData = Object.entries(workoutTypes).map(([type, count], index) => ({
      name: type,
      count,
      color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'][index % 4],
      legendFontColor: '#7F7F7F',
      legendFontSize: 12
    }));

    if (frequency >= 4) return {
      text: "Excellent",
      color: "#66BB6A",
      advice: "Keep it up! Gradually increase workout intensity.",
      pieData
    };
    if (frequency >= 2) return {
      text: "Good",
      color: "#4ECDC4",
      advice: "Try to add 1-2 more workouts per week for consistency.",
      pieData
    };
    return {
      text: "Needs Improvement",
      color: "#FF7043",
      advice: "Aim for at least 3 workouts per week, 30 minutes each.",
      pieData
    };
  };

  // 取最近7次運動紀錄（由舊到新）
  const sortedWorkouts = [...workouts].sort((a, b) => new Date(a.date) - new Date(b.date));
  const recentWorkouts = sortedWorkouts.slice(-7);

  // 體重資料
  const weightData = recentWorkouts.map(w => ({
    date: w.date.split('T')[0],
    weight: parseFloat(w.metrics?.weightAfter)
  }));

  // 心率資料
  const heartRateData = recentWorkouts.map(w => ({
    date: w.date.split('T')[0],
    heartRate: parseInt(w.metrics?.heartRateAfter)
  }));

  const currentBMI = calculateBMI(currentWeight, height);
  const bmiStatus = getBMIStatus(currentBMI);
  const workoutStats = calculateWorkoutStats();

  const screenWidth = Dimensions.get("window").width;

  // 體重y軸範圍
  const weights = weightData.map(d => d.weight).filter(v => !isNaN(v));
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const yAxisMin = weights.length > 1 ? Math.floor(minWeight - 2) : minWeight - 2;
  const yAxisMax = weights.length > 1 ? Math.ceil(maxWeight + 2) : maxWeight + 2;

  // 心率y軸範圍
  const heartRates = heartRateData.map(d => d.heartRate).filter(v => !isNaN(v));
  const minHR = Math.min(...heartRates);
  const maxHR = Math.max(...heartRates);
  const yAxisMinHR = heartRates.length > 1 ? Math.floor(minHR - 5) : minHR - 5;
  const yAxisMaxHR = heartRates.length > 1 ? Math.ceil(maxHR + 5) : maxHR + 5;

  // 参考运动记录页面的图表样式
  const chartConfig = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`, // 红色风格
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    propsForDots: {
      r: "6",
      strokeWidth: "2",
      stroke: "#fff"
    }
  };

  // 横坐标只显示日期的日部分，且只显示首尾和中间
  const labels = weightData.map((d, idx) => {
    if (idx === 0 || idx === weightData.length - 1 || idx === Math.floor(weightData.length / 2)) {
      return d.date.split('-')[2];
    }
    return '';
  });

  const weightChartData = {
    labels,
    datasets: [{
      data: weightData.map(d => d.weight),
      color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
      strokeWidth: 2
    }]
  };

  // 心率圖表資料
  const heartRateChartData = {
    labels,
    datasets: [{
      data: heartRateData.map(d => d.heartRate),
      color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
      strokeWidth: 2
    }]
  };

  // Calculate weight progress
  const calculateWeightProgress = () => {
    if (!currentWeight || !targetWeight) return 0;
    const diff = Math.abs(currentWeight - targetWeight);
    if (diff === 0) return 1;
    const progress = 1 - (diff / Math.max(currentWeight, targetWeight));
    return Math.max(0, Math.min(1, progress));
  };

  // --- 運動個性化分析 ---
  const aerobicCount = recentWorkouts.filter(w => w.type?.toLowerCase().includes('aerobic') || w.type?.toLowerCase().includes('cardio')).length;
  const anaerobicCount = recentWorkouts.filter(w => w.type?.toLowerCase().includes('strength') || w.type?.toLowerCase().includes('anaerobic')).length;
  let workoutTypeAdvice = '';
  if (aerobicCount < 2) workoutTypeAdvice += 'You have little aerobic/cardio exercise recently. Try to add more running, cycling, or swimming. ';
  if (anaerobicCount < 2) workoutTypeAdvice += 'You have little strength training recently. Try to add more weight training or resistance exercises. ';
  if (!workoutTypeAdvice) workoutTypeAdvice = 'Your workout types are well balanced!';

  // --- 飲食個性化建議 ---
  let dietAdvice = '';
  if (goal === 'lose') dietAdvice = 'Focus on calorie deficit, high protein, low sugar, more vegetables and fiber.';
  else if (goal === 'gain') dietAdvice = 'Increase calorie intake, eat more protein and complex carbs, healthy fats.';
  else dietAdvice = 'Maintain a balanced diet with enough protein, carbs, and healthy fats.';
  // 根據 BMI 狀態再補充
  if (currentWeight && height) {
    const bmi = currentWeight / (height * height);
    if (bmi > 27) dietAdvice += ' Limit processed foods, sugary drinks, and fried foods.';
    if (bmi < 18.5) dietAdvice += ' Add more healthy snacks and calorie-dense foods.';
  }

  // --- 疾病風險提示 ---
  let riskAdvice = '';
  if (currentWeight && height) {
    const bmi = currentWeight / (height * height);
    if (bmi >= 30) riskAdvice = 'You are at high risk for chronic diseases such as diabetes, hypertension, and cardiovascular disease. Please consult a healthcare professional.';
    else if (bmi >= 27) riskAdvice = 'You are at increased risk for metabolic syndrome and cardiovascular issues. Consider regular health checkups.';
    else if (bmi < 18.5) riskAdvice = 'You are at risk of malnutrition, osteoporosis, and weakened immunity. Consider increasing your calorie and nutrient intake.';
    else riskAdvice = 'Your disease risk is within a healthy range. Keep up your healthy habits!';
  }

  return (
    <ScrollView style={styles.container}>
      <Surface style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="human-male-height" size={24} color="#4ECDC4" />
          <Text style={styles.cardTitle}>Physical Data</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.label}>Height:</Text>
          <Text style={styles.value}>{(height * 100).toFixed(0)} cm</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.label}>Weight:</Text>
          <Text style={styles.value}>{currentWeight} kg</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.label}>BMI:</Text>
          <Text style={[styles.value, { color: bmiStatus.color }]}>{currentBMI}</Text>
          <Text style={[styles.status, { color: bmiStatus.color }]}>({bmiStatus.text})</Text>
        </View>
        <View style={styles.progressContainer}>
          <Text style={styles.progressLabel}>Weight Progress</Text>
          <ProgressBar
            progress={calculateWeightProgress()}
            color="#4ECDC4"
            style={styles.progressBar}
          />
          <Text style={styles.progressText}>
            {Math.abs(currentWeight - targetWeight).toFixed(1)} kg to go
          </Text>
        </View>
      </Surface>

      <Surface style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="chart-line" size={24} color="#4ECDC4" />
          <Text style={styles.cardTitle}>Weight Trend</Text>
        </View>
        {weightData.length < 2 ? (
          <Text style={{textAlign: 'center', color: '#999'}}>Not enough data</Text>
        ) : (
          <LineChart
            data={weightChartData}
            width={screenWidth - 64}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withDots={true}
            withShadow={true}
            withInnerLines={true}
            withOuterLines={true}
            fromZero={false}
            yAxisSuffix=""
            yAxisInterval={1}
            yLabelsOffset={8}
            segments={5}
            yAxisMin={yAxisMin}
            yAxisMax={yAxisMax}
          />
        )}
      </Surface>

      <Surface style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="heart-pulse" size={24} color="#4ECDC4" />
          <Text style={styles.cardTitle}>Heart Rate Trend</Text>
        </View>
        {heartRateData.length < 2 ? (
          <Text style={{textAlign: 'center', color: '#999'}}>Not enough data</Text>
        ) : (
          <LineChart
            data={heartRateChartData}
            width={screenWidth - 64}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withDots={true}
            withShadow={true}
            withInnerLines={true}
            withOuterLines={true}
            fromZero={false}
            yAxisSuffix=""
            yAxisInterval={1}
            yLabelsOffset={8}
            segments={5}
            yAxisMin={yAxisMinHR}
            yAxisMax={yAxisMaxHR}
          />
        )}
      </Surface>

      <Surface style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="run" size={24} color="#4ECDC4" />
          <Text style={styles.cardTitle}>Workout Status</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.label}>Frequency:</Text>
          <Text style={[styles.value, { color: workoutStats.color }]}>{workoutStats.text}</Text>
        </View>
        <View style={styles.chartContainer}>
          <PieChart
            data={workoutStats.pieData}
            width={screenWidth - 64}
            height={220}
            chartConfig={chartConfig}
            accessor="count"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </View>
        <Text style={styles.advice}>{workoutTypeAdvice}</Text>
      </Surface>

      <Surface style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="food-apple" size={24} color="#4ECDC4" />
          <Text style={styles.cardTitle}>Dietary Recommendations</Text>
        </View>
        <Text style={styles.advice}>{dietAdvice}</Text>
      </Surface>

      <Surface style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="alert" size={24} color="#EF5350" />
          <Text style={styles.cardTitle}>Health Risk Warning</Text>
        </View>
        <Text style={styles.advice}>{riskAdvice}</Text>
      </Surface>

      <Surface style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="trophy" size={24} color="#4ECDC4" />
          <Text style={styles.cardTitle}>Achievements</Text>
        </View>
        <View style={styles.achievementContainer}>
          <View style={styles.achievement}>
            <MaterialCommunityIcons name="fire" size={32} color="#FF6B6B" />
            <Text style={styles.achievementText}>30 Day Streak</Text>
          </View>
          <View style={styles.achievement}>
            <MaterialCommunityIcons name="weight-lifter" size={32} color="#4ECDC4" />
            <Text style={styles.achievementText}>100 Workouts</Text>
          </View>
          <View style={styles.achievement}>
            <MaterialCommunityIcons name="medal" size={32} color="#FFD93D" />
            <Text style={styles.achievementText}>Goal Achieved</Text>
          </View>
        </View>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  card: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    color: "#666",
    width: 80,
  },
  value: {
    fontSize: 16,
    fontWeight: "500",
  },
  status: {
    fontSize: 14,
    marginLeft: 8,
  },
  advice: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 8,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    textAlign: 'right',
  },
  achievementContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  achievement: {
    alignItems: 'center',
  },
  achievementText: {
    fontSize: 12,
    color: "#666",
    marginTop: 8,
    textAlign: 'center',
  },
}); 