import { StyleSheet, View, TouchableOpacity } from "react-native";
import { Text, Surface, Button, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateUserinfo } from "../redux/reducers/userinfoSlice";
import Toast from "react-native-toast-message";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const USERS_COLLECTION = "users";

export default function ChangePassword({ navigation }) {
  const dispatch = useDispatch();
  const userinfo = useSelector((state) => state.userinfo.userinfo);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleChangePassword = async () => {
    try {
      setError("");
      setLoading(true);

      if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
        setError("Please fill in all fields");
        setLoading(false);
        return;
      }

      // Get the current user document from Firestore
      const userDocRef = doc(db, USERS_COLLECTION, userinfo.id);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        setError("User not found");
        setLoading(false);
        return;
      }
      
      const userData = userDoc.data();
      
      // Verify current password
      if (passwordForm.currentPassword !== userData.password) {
        setError("Current password is incorrect");
        setLoading(false);
        return;
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setError("New passwords do not match");
        setLoading(false);
        return;
      }

      if (passwordForm.newPassword.length < 3) {
        setError("New password must be at least 3 characters");
        setLoading(false);
        return;
      }

      // Update the password in Firestore
      await updateDoc(userDocRef, {
        password: passwordForm.newPassword
      });

      // Update current user information in AsyncStorage for local usage
      const updatedUserInfo = {
        ...userinfo,
        password: passwordForm.newPassword
      };
      await AsyncStorage.setItem('userinfo', JSON.stringify(updatedUserInfo));
      
      // Update Redux
      dispatch(updateUserinfo(updatedUserInfo));

      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Password changed successfully. Please login again.",
      });

      // Clear user information and redirect to login page
      await AsyncStorage.removeItem('userinfo');
      dispatch(updateUserinfo(null));
      navigation.replace('Login');

    } catch (error) {
      console.error('Error changing password:', error);
      setError("Failed to change password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#FF6B6B", "#4ECDC4"]}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Change Password</Text>
          <Text style={styles.headerSubtitle}>Keep your account secure</Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <Surface style={styles.formCard}>
          <TextInput
            mode="outlined"
            label="Current Password"
            value={passwordForm.currentPassword}
            onChangeText={(text) => setPasswordForm({
              ...passwordForm,
              currentPassword: text
            })}
            secureTextEntry
            style={styles.input}
            theme={{ colors: { primary: "#4ECDC4" } }}
          />

          <TextInput
            mode="outlined"
            label="New Password"
            value={passwordForm.newPassword}
            onChangeText={(text) => setPasswordForm({
              ...passwordForm,
              newPassword: text
            })}
            secureTextEntry
            style={styles.input}
            theme={{ colors: { primary: "#4ECDC4" } }}
          />

          <TextInput
            mode="outlined"
            label="Confirm New Password"
            value={passwordForm.confirmPassword}
            onChangeText={(text) => setPasswordForm({
              ...passwordForm,
              confirmPassword: text
            })}
            secureTextEntry
            style={styles.input}
            theme={{ colors: { primary: "#4ECDC4" } }}
          />

          {error ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle" size={20} color="#FF6B6B" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            mode="contained"
            onPress={handleChangePassword}
            style={styles.button}
            buttonColor="#4ECDC4"
            loading={loading}
            disabled={loading}
          >
            Update Password
          </Button>
        </Surface>
      </View>
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
    height: 180,
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
  formCard: {
    padding: 20,
    borderRadius: 15,
    backgroundColor: "white",
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  input: {
    marginBottom: 15,
  },
  button: {
    marginTop: 10,
    borderRadius: 8,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 8,
    zIndex: 1,
  },
  headerTextContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  errorText: {
    color: '#FF6B6B',
    marginLeft: 8,
    fontSize: 14,
  },
}); 
