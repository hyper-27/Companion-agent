import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy,
  limit,
  getDocFromServer
} from "firebase/firestore";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { AnalysisLog } from "../types";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore
// Use specific database ID if configured in firebase-applet-config.json
export const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Authentication
export const auth = getAuth(app);

// Validate Connection to Firestore on Boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("[Firebase] Warning: Please check your Firebase configuration or network connection. The client is offline.");
    }
  }
}
testConnection();

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Saves or updates user profile details in Firestore.
 */
export async function saveUserProfile(
  uid: string,
  email: string,
  displayName: string,
  photoURL: string
): Promise<void> {
  const docRef = doc(db, "users", uid);
  try {
    await setDoc(docRef, {
      uid,
      email,
      displayName,
      photoURL,
      createdAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}

/**
 * Signs in a user using Google Sign-In popup.
 */
export async function loginWithGoogle(): Promise<FirebaseUser> {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    if (user) {
      // Synchronously write profile details upon login
      await saveUserProfile(
        user.uid,
        user.email || "",
        user.displayName || "User",
        user.photoURL || ""
      );
    }
    return user;
  } catch (error) {
    console.error("[Firebase Auth] Google login failed:", error);
    throw error;
  }
}

/**
 * Signs out the current authenticated user.
 */
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("[Firebase Auth] Logout failed:", error);
    throw error;
  }
}

/**
 * Saves a code analysis log to Firestore under the current user's isolated subcollection.
 */
export async function saveLogToFirestore(userId: string, log: AnalysisLog): Promise<void> {
  const docRef = doc(db, "users", userId, "analysis_logs", log.id);
  try {
    // Store the entire AnalysisLog structure
    await setDoc(docRef, {
      id: log.id,
      timestamp: log.timestamp,
      fileName: log.fileName,
      language: log.language,
      code: log.code,
      bugHunter: log.bugHunter,
      complexity: log.complexity,
      doc: log.doc
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/analysis_logs/${log.id}`);
  }
}

/**
 * Fetches saved analysis logs for a specific user from Firestore, ordered by timestamp descending.
 */
export async function fetchLogsFromFirestore(userId: string): Promise<AnalysisLog[]> {
  const logsRef = collection(db, "users", userId, "analysis_logs");
  const q = query(logsRef, orderBy("timestamp", "desc"), limit(50));
  
  try {
    const querySnapshot = await getDocs(q);
    const logs: AnalysisLog[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      logs.push({
        id: docSnap.id,
        timestamp: data.timestamp || new Date().toISOString(),
        fileName: data.fileName || "untitled",
        language: data.language || "plaintext",
        code: data.code || "",
        bugHunter: data.bugHunter || { overview: "", bugs: [] },
        complexity: data.complexity || { timeComplexity: "O(1)", spaceComplexity: "O(1)", complexityExplanation: "", optimizations: [] },
        doc: data.doc || { overview: "", documentedCode: "", components: [] }
      } as AnalysisLog);
    });
    return logs;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${userId}/analysis_logs`);
    return [];
  }
}

/**
 * Deletes an analysis log from Firestore for a specific user.
 */
export async function deleteLogFromFirestore(userId: string, id: string): Promise<void> {
  const docRef = doc(db, "users", userId, "analysis_logs", id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/analysis_logs/${id}`);
  }
}

