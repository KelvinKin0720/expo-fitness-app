import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBkc3sOq81IEH_qys1r_GsWrl2MkhNpYrQ",
  authDomain: "fitness-9902b.firebaseapp.com",
  projectId: "fitness-9902b",
  storageBucket: "fitness-9902b.firebasestorage.app",
  messagingSenderId: "1044402913663",
  appId: "1:1044402913663:web:cf4372eadd174e60a69a4a",
  measurementId: "G-FSG7EWBDQC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
export default app;