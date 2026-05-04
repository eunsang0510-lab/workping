import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDCUOcUZl08c8lAf10j_HlSK-PQy5N7aGU",
  authDomain: "workping-742c1.firebaseapp.com",
  projectId: "workping-742c1",
  storageBucket: "workping-742c1.firebasestorage.app",
  messagingSenderId: "1071558572970",
  appId: "1:1071558572970:web:773a71f103dc3cf59789d3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// 로그아웃 전까지 자동 로그인 유지
setPersistence(auth, browserLocalPersistence);