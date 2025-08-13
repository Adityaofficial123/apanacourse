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

// Initialize Firebase only if not already initialized
let app;
if (!firebase.apps.length) {
  app = firebase.initializeApp(firebaseConfig);
} else {
  app = firebase.app();
}

// Initialize services
let auth, database, db;
let firebaseServicesInitialized = false;

// Wait for Firebase to be ready
firebase.auth().onAuthStateChanged(function (user) {
  if (!firebaseServicesInitialized) {
    try {
      auth = firebase.auth();

      if (firebase.database) {
        database = firebase.database();
      }

      if (firebase.firestore) {
        db = firebase.firestore();
      }

      firebaseServicesInitialized = true;
      window.firebaseServicesInitialized = true;
      console.log('Firebase services initialized successfully');

      // Initialize courses after Firebase is ready
      // setTimeout(initializeRealCourses, 1000);
    } catch (error) {
      console.error('Error initializing Firebase services:', error);
    }
  }
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
  }
};


// Export for global use
window.DatabaseAPI = DatabaseAPI;
window.auth = () => auth;
window.db = () => db;