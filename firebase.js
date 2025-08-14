// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCIJvPL0APLWgTXyvS6qQEHkM8kYbOrsIE",
  authDomain: "smartlearn-b0420.firebaseapp.com",
  databaseURL: "https://smartlearn-b0420-default-rtdb.firebaseio.com",
  projectId: "smartlearn-b0420",
  storageBucket: "smartlearn-b0420.firebasestorage.app",
  messagingSenderId: "579725044941",
  appId: "1:579725044941:web:027a24924970cb96c7cd84"
};

// Firebase initialization state
let app;
let auth, database, db;
let firebaseServicesInitialized = false;
let firebaseInitializationPromise = null;

// Initialize Firebase
function initializeFirebase() {
  if (firebaseInitializationPromise) {
    return firebaseInitializationPromise;
  }

  firebaseInitializationPromise = new Promise((resolve, reject) => {
    try {
      // Initialize Firebase if not already initialized
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      app = firebase.app();

      // Initialize services
      auth = firebase.auth();
      database = firebase.database ? firebase.database() : null;
      db = firebase.firestore ? firebase.firestore() : null;

      // Mark as initialized immediately since services are ready
      firebaseServicesInitialized = true;
      window.firebaseServicesInitialized = true;
      
      // Expose services globally for admin panel
      window.auth = auth;
      window.db = db;
      window.database = database;
      
      console.log('Firebase services initialized successfully');
      resolve({ auth, db, database });
      
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      reject(error);
    }
  });

  return firebaseInitializationPromise;
}

// Initialize Firebase immediately
initializeFirebase().catch(error => {
  console.error('Failed to initialize Firebase:', error);
});

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Database API
const DatabaseAPI = {
  async getAllCourses() {
    try {
      if (!db) {
        return [];
      }

      const snapshot = await db.collection('courses').get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting courses:', error);
      return [];
    }
  },

  // Get multiple courses by their IDs with batch processing and fallback
  async getCoursesByIds(courseIds) {
    try {
      const db = firebase.firestore();
      const courses = [];
      for (const id of courseIds) {
        const doc = await db.collection('courses').doc(id).get();
        if (doc.exists) {
          courses.push({ id: doc.id, ...doc.data() });
        }
      }
      return courses;
    } catch (error) {
      console.error('Error fetching courses:', error);
      throw error;
    }
  },

  // Get all pending enrollments (for admin panel)
  async getAllPendingEnrollmentsOnce() {
    try {
      if (!db) {
        console.error('Firestore not initialized');
        return [];
      }

      const snapshot = await db.collection('enrollments')
        .where('paymentStatus', '==', 'pending')
        .orderBy('enrolledAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting pending enrollments:', error);
      throw error;
    }
  },

  // Keep the payment/enrollment proof function for admin panel
  async submitPaidEnrollmentProof(payload) {
    try {
      if (!db) throw new Error('Database not initialized');
      
      // Check if a proof already exists for this user and course
      const existingProofQuery = await db.collection('enrollment-proofs')
        .where('userId', '==', payload.userId)
        .where('courseId', '==', payload.courseId)
        .where('status', 'in', ['pending', 'approved'])
        .get();
      
      if (!existingProofQuery.empty) {
        console.log('Enrollment proof already exists for this user and course');
        // Return the existing proof ID instead of creating a duplicate
        return existingProofQuery.docs[0].id;
      }
      
      const proofData = {
        ...payload,
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        verified: false
      };

      const docRef = await db.collection('enrollment-proofs').add(proofData);
      console.log('Enrollment proof submitted with ID:', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('Error submitting enrollment proof:', error);
      throw error;
    }
  },

  // Get all enrollment proofs for admin panel
  async getAllEnrollmentProofs() {
    try {
      if (!db) return [];
      
      const snapshot = await db.collection('enrollment-proofs').orderBy('submittedAt', 'desc').get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting enrollment proofs:', error);
      return [];
    }
  },

  // Update enrollment proof status for admin panel
  async updateEnrollmentProofStatus(proofId, status, verified = false) {
    try {
      if (!db) throw new Error('Database not initialized');
      
      await db.collection('enrollment-proofs').doc(proofId).update({
        status: status,
        verified: verified,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('Enrollment proof status updated');
    } catch (error) {
      console.error('Error updating enrollment proof status:', error);
      throw error;
    }
  },

  // Realtime Database functions for admin panel
  async getAllPendingEnrollmentsOnce() {
    try {
      if (!database) {
        console.error('Realtime Database not initialized');
        return [];
      }
      
      const snapshot = await database.ref('pending_enrollments').once('value');
      const data = snapshot.val();
      
      if (!data) return [];
      
      // Convert object to array with IDs
      return Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
    } catch (error) {
      console.error('Error getting pending enrollments from RTDB:', error);
      return [];
    }
  },

  // Get approved enrollments from Realtime Database
  async getAllApprovedEnrollmentsOnce() {
    try {
      if (!database) {
        console.error('Realtime Database not initialized');
        return [];
      }
      
      const snapshot = await database.ref('approved_enrollments').once('value');
      const data = snapshot.val();
      
      if (!data) return [];
      
      // Convert object to array with IDs
      return Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
    } catch (error) {
      console.error('Error getting approved enrollments from RTDB:', error);
      return [];
    }
  },

  // Get all enrollments from Firestore (without complex queries to avoid index issues)
  async getAllEnrollmentsSimple() {
    try {
      if (!db) {
        console.error('Firestore not initialized');
        return [];
      }
      
      const snapshot = await db.collection('enrollments').get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting enrollments from Firestore:', error);
      return [];
    }
  },

  // Approve payment request - move from pending to approved and create Firestore enrollment
  async approvePaymentRequest(pendingId) {
    try {
      if (!database || !db) {
        throw new Error('Database not initialized');
      }
      
      // Get the pending request
      const pendingSnapshot = await database.ref(`pending_enrollments/${pendingId}`).once('value');
      const pendingData = pendingSnapshot.val();
      
      if (!pendingData) {
        throw new Error('Pending request not found');
      }
      
      // Create enrollment in Firestore
      const enrollmentData = {
        userId: pendingData.userId,
        courseId: pendingData.courseId,
        userName: pendingData.userName,
        userEmail: pendingData.userEmail,
        progress: 0,
        completed: false,
        enrolledAt: firebase.firestore.FieldValue.serverTimestamp(),
        paymentVerified: true,
        approvedBy: 'admin',
        approvedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      await db.collection('enrollments').add(enrollmentData);
      
      // Move to approved in RTDB
      const approvedData = {
        ...pendingData,
        status: 'approved',
        approvedAt: firebase.database.ServerValue.TIMESTAMP,
        approvedBy: 'admin'
      };
      
      await database.ref(`approved_enrollments/${pendingId}`).set(approvedData);
      
      // Remove from pending
      await database.ref(`pending_enrollments/${pendingId}`).remove();
      
      console.log('Payment request approved successfully');
      return true;
    } catch (error) {
      console.error('Error approving payment request:', error);
      throw error;
    }
  },

  // Reject payment request
  async rejectPaymentRequest(pendingId) {
    try {
      if (!database) {
        throw new Error('Database not initialized');
      }
      
      // Get the pending request
      const pendingSnapshot = await database.ref(`pending_enrollments/${pendingId}`).once('value');
      const pendingData = pendingSnapshot.val();
      
      if (!pendingData) {
        throw new Error('Pending request not found');
      }
      
      // Move to rejected in RTDB
      const rejectedData = {
        ...pendingData,
        status: 'rejected',
        rejectedAt: firebase.database.ServerValue.TIMESTAMP,
        rejectedBy: 'admin'
      };
      
      await database.ref(`rejected_enrollments/${pendingId}`).set(rejectedData);
      
      // Remove from pending
      await database.ref(`pending_enrollments/${pendingId}`).remove();
      
      console.log('Payment request rejected successfully');
      return true;
    } catch (error) {
      console.error('Error rejecting payment request:', error);
      throw error;
    }
  },

  async getCourse(courseId) {
    try {
      if (!db) {
        return null;
      }
      const doc = await db.collection('courses').doc(courseId).get();
      if (!doc.exists) return null;
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      console.error('Error getting course:', error);
      return null;
    }
  },

  async getFeaturedCourses() {
    try {
      if (!db) {
        return [];
      }
      const snapshot = await db.collection('courses').where('featured', '==', true).limit(3).get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting featured courses:', error);
      return [];
    }
  },

  async enrollInCourse(userId, courseId, userName, userEmail) {
    try {
      if (!db) throw new Error('Database not initialized');

      // Check if already enrolled
      const existingEnrollment = await this.checkEnrollment(userId, courseId);
      if (existingEnrollment) {
        throw new Error('Already enrolled in this course');
      }

      const enrollmentData = {
        userId: userId,
        courseId: courseId,
        userName: userName || '',
        userEmail: userEmail || '',
        enrolledAt: firebase.firestore.FieldValue.serverTimestamp(),
        progress: 0,
        completed: false
      };

      const docRef = await db.collection('enrollments').add(enrollmentData);

      // Update course students count
      const courseRef = db.collection('courses').doc(courseId);
      await courseRef.update({
        students: firebase.firestore.FieldValue.increment(1)
      });

      return docRef.id;
    } catch (error) {
      console.error('Error enrolling in course:', error);
      throw error;
    }
  },

  async getUserEnrollments(userId) {
    try {
      if (!db) return [];

      const snapshot = await db.collection('enrollments').where('userId', '==', userId).get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting user enrollments:', error);
      return [];
    }
  },

  async updateEnrollmentProgress(enrollmentId, progress) {
    try {
      if (!db) throw new Error('Database not initialized');

      const completed = progress >= 100;
      await db.collection('enrollments').doc(enrollmentId).update({
        progress: progress,
        completed: completed,
        lastAccessed: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating enrollment progress:', error);
      throw error;
    }
  },

  async checkEnrollment(userId, courseId) {
    try {
      if (!db) return null;

      const snapshot = await db.collection('enrollments')
        .where('userId', '==', userId)
        .where('courseId', '==', courseId)
        .limit(1)
        .get();

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      console.error('Error checking enrollment:', error);
      return null;
    }
  },

  // Save user profile function
  async saveUserProfile(user) {
    try {
      if (!db) throw new Error('Database not initialized');

      const userRef = db.collection('users').doc(user.uid);
      const userDoc = await userRef.get();

      const userData = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (!userDoc.exists) {
        // New user - create profile with default values
        userData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        userData.enrolledCourses = 0;
        userData.completedCourses = 0;
        await userRef.set(userData);
        console.log('New user profile created');
      } else {
        // Existing user - update last login and profile info
        await userRef.update({
          displayName: user.displayName,
          photoURL: user.photoURL,
          lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('User profile updated');
      }
    } catch (error) {
      console.error('Error saving user profile:', error);
    }
  }
};

// Simple auth state management without complex AuthManager class
let currentUser = null;
let authCallbacks = [];

// Setup auth listener
firebase.auth().onAuthStateChanged(async (user) => {
  currentUser = user;
  
  if (user) {
    // Save/update user profile
    await DatabaseAPI.saveUserProfile(user);
  }

  // Notify all callbacks
  authCallbacks.forEach(callback => {
    try {
      callback(user);
    } catch (error) {
      console.error('Error in auth callback:', error);
    }
  });
});

// Auth functions
window.onAuthStateChanged = function(callback) {
  authCallbacks.push(callback);
  // Immediately call with current state if available
  if (currentUser !== null) {
    callback(currentUser);
  }
};

window.getCurrentUser = function() {
  return currentUser;
};

window.signInWithGoogle = async function() {
  if (!auth) {
    throw new Error('Authentication service not available');
  }

  try {
    // Try popup first, fallback to redirect on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      await auth.signInWithRedirect(googleProvider);
    } else {
      const result = await auth.signInWithPopup(googleProvider);
      return result.user;
    }
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};

window.signOut = async function() {
  if (!auth) {
    throw new Error('Authentication service not available');
  }

  try {
    await auth.signOut();
    currentUser = null;
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

// Email/Password Authentication
window.signInWithEmail = async function(email, password) {
  if (!auth) {
    throw new Error('Authentication service not available');
  }

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Email sign in error:', error);
    throw error;
  }
};

window.createUserWithEmail = async function(email, password, displayName) {
  if (!auth) {
    throw new Error('Authentication service not available');
  }

  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    // Update user profile with display name
    if (userCredential.user) {
      await userCredential.user.updateProfile({
        displayName: displayName
      });
      // Update local user state
      currentUser = {
        ...currentUser,
        displayName: displayName,
        email: userCredential.user.email
      };
      // Notify listeners
      authCallbacks.forEach(cb => cb(currentUser));
    }
    return userCredential.user;
  } catch (error) {
    console.error('Email sign up error:', error);
    throw error;
  }
};

window.sendPasswordResetEmail = async function(email) {
  if (!auth) {
    throw new Error('Authentication service not available');
  }

  try {
    await auth.sendPasswordResetEmail(email);
    return true;
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
};

// Export for global use
window.DatabaseAPI = DatabaseAPI;
window.auth = () => auth;
window.db = () => db;
window.database = () => database;
window.rtdb = () => database;
window.googleProvider = googleProvider;

// Make current user accessible globally
Object.defineProperty(window, 'currentUser', {
  get() {
    return currentUser;
  }
});

// Global function to show login modal
window.showLoginModal = function() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.classList.remove('hidden');
    return true;
  }
  console.warn('Login modal element not found');
  return false;
};

// Expose DatabaseAPI globally
window.DatabaseAPI = DatabaseAPI;

// Also expose individual services for backward compatibility
window.firebase = firebase;

console.log('Firebase configuration loaded successfully');
