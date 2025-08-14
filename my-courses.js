let enrolledCourses = [];
let currentTab = 'all';

// Track the current enrollment listener for cleanup
let enrollmentListener = null;

// DOM Elements
let authRequired, dashboardContent, coursesContainer, myCoursesLoadingElement, noCoursesElement, tabButtons;

// --- EmailJS config ---
const EMAILJS_SERVICE_ID = 'service_u414ehm';
const EMAILJS_TEMPLATE_ID = 'template_501h3k5';
const EMAILJS_PUBLIC_KEY = 'VCWqhIe6OgMzBGivR';

// Initialize Firebase and ensure it's ready
async function initializeFirebase() {
  try {
    // Check if Firebase is already initialized
    if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
      console.log('Firebase already initialized');
      return Promise.resolve();
    }
    
    // Wait for firebase.js to load
    if (!window.firebase) {
      await new Promise((resolve) => {
        const checkFirebase = setInterval(() => {
          if (window.firebase) {
            clearInterval(checkFirebase);
            resolve();
          }
        }, 100);
      });
    }
    
    // Wait for firebaseServicesInitialized flag
    if (!window.firebaseServicesInitialized) {
      await new Promise((resolve) => {
        const checkInitialized = setInterval(() => {
          if (window.firebaseServicesInitialized) {
            clearInterval(checkInitialized);
            resolve();
          }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInitialized);
          resolve();
        }, 5000);
      });
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
}

// Handle authentication state changes
function handleAuthStateChange(user) {
  try {
    if (user) {
      // User is signed in
      authRequired?.classList.add('hidden');
      dashboardContent?.classList.remove('hidden');
      
      // Show user info
      const userNameEl = document.getElementById('user-name');
      if (userNameEl) {
        userNameEl.textContent = user.displayName || 'User';
      }
      
      const userInfoEl = document.getElementById('user-info');
      if (userInfoEl) userInfoEl.classList.remove('hidden');
      
      const authButtonsEl = document.getElementById('auth-buttons');
      if (authButtonsEl) authButtonsEl.classList.add('hidden');
      
      // Clean up any existing listener
      if (enrollmentListener) {
        enrollmentListener();
        enrollmentListener = null;
      }
      
      // Listen for enrollment updates
      enrollmentListener = listenForEnrollmentUpdates(user);
      
    } else {
      // User is signed out
      authRequired?.classList.remove('hidden');
      dashboardContent?.classList.add('hidden');
      
      const userInfoEl = document.getElementById('user-info');
      if (userInfoEl) userInfoEl.classList.add('hidden');
      
      const authButtonsEl = document.getElementById('auth-buttons');
      if (authButtonsEl) authButtonsEl.classList.remove('hidden');
      
      // Clear enrolled courses when signed out
      enrolledCourses = [];
      if (coursesContainer) coursesContainer.innerHTML = '';
      updateStats();
      
      // Clean up enrollment listener
      if (enrollmentListener) {
        enrollmentListener();
        enrollmentListener = null;
      }
    }
  } catch (error) {
    console.error('Error in auth state change handler:', error);
    hideLoadingState();
    showErrorState('An error occurred. Please refresh the page.');
  } finally {
    hideLoadingState();
  }
}

// Initialize the page
async function init() {
  try {
    // Get DOM elements with null checks
    authRequired = document.getElementById('auth-required');
    dashboardContent = document.getElementById('dashboard-content');
    coursesContainer = document.getElementById('courses-container');
    myCoursesLoadingElement = document.getElementById('my-courses-loading');
    noCoursesElement = document.getElementById('no-courses');
    tabButtons = document.querySelectorAll('.tab-btn');
    
    // Show loading state
    showLoadingState();
    
    // Initialize tab switching
    initializeTabSwitching();
    
    // Wait for Firebase to be ready
    try {
      await initializeFirebase();
      
      // Ensure firebase is properly initialized
      if (!window.firebase || !window.firebase.auth) {
        throw new Error('Firebase not properly initialized');
      }
      
      // Initialize auth state listener
      const auth = firebase.auth();
      if (!auth) {
        throw new Error('Failed to initialize Firebase Auth');
      }
      
      // Set up auth state change listener
      auth.onAuthStateChanged(handleAuthStateChange);
      
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      hideLoadingState();
      showErrorState('Failed to initialize the application. Please refresh the page.');
      return;
    }
    
    // Clean up any existing listener before setting up a new one
    if (enrollmentListener) {
      enrollmentListener();
      enrollmentListener = null;
    }
    
    // Setup login button
    const loginBtn = document.getElementById('login-btn');
    const googleLoginBtn = document.getElementById('google-login');
    
    const handleLogin = () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      
      firebase.auth().signInWithPopup(provider)
        .then((result) => {
          console.log('Login successful:', result.user);
          // Close login modal if it exists
          const loginModal = document.getElementById('login-modal');
          if (loginModal) {
            loginModal.classList.add('hidden');
          }
        })
        .catch((error) => {
          console.error('Login error:', error);
          alert('Login failed. Please try again.');
        });
    };
    
    if (loginBtn) {
      loginBtn.addEventListener('click', handleLogin);
    }
    
    if (googleLoginBtn) {
      googleLoginBtn.addEventListener('click', handleLogin);
    }

    // Setup logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        firebase.auth().signOut()
          .then(() => {
            console.log('Logout successful');
          })
          .catch((error) => {
            console.error('Logout error:', error);
          });
      });
    }
    
    // Setup login prompt button
    const loginPrompt = document.getElementById('login-prompt');
    if (loginPrompt) {
      loginPrompt.addEventListener('click', () => {
        showLoginModal();
      });
    }
    
    // Add cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (enrollmentListener) {
        enrollmentListener();
        enrollmentListener = null;
      }
    });
    
  } catch (error) {
    console.error('Error initializing my-courses page:', error);
    showErrorState('An error occurred while initializing the page. Please refresh and try again.');
  }
}

// Initialize DOM elements when page loads
document.addEventListener('DOMContentLoaded', init);

// --- Listen for completed enrollments and send certificate ---
function listenForCompletedCertificates(user) {
  const db = firebase.firestore();
  db.collection('enrollments')
    .where('userId', '==', user.uid)
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        const data = change.doc.data();
        // Only act if completed just became true and not already sent
        if (
          change.type === 'modified' &&
          data.completed === true &&
          !data.certificateSent
        ) {
          // Mark as sent immediately to avoid duplicate emails
          change.doc.ref.update({ certificateSent: true });
          generateAndSendCertificate(user, data);
        }
      });
    });
}

// --- Generate certificate and send via EmailJS ---
async function generateAndSendCertificate(user, enrollment) {
  // Get course details for certificate
  try {
    const courseDoc = await firebase.firestore().collection('courses').doc(enrollment.courseId).get();
    const courseData = courseDoc.exists ? courseDoc.data() : {};
    
    const certData = {
      studentName: user.displayName || user.email,
      courseName: courseData.title || enrollment.courseId,
      instructor: courseData.instructor || 'SmartLearn Team',
      completionDate: new Date().toLocaleDateString(),
      certificateId: `CERT-${enrollment.courseId}-${user.uid.substring(0, 8)}`
    };
    
    const base64Png = await createPremiumCertificate(certData);
    sendCertificateEmail({
      to_email: user.email,
      to_name: certData.studentName,
      course_name: certData.courseName,
      certificate_base64: base64Png,
    });
  } catch (error) {
    console.error('Error generating certificate:', error);
  }
}

// --- Canvas certificate generation (premium design) ---
async function createPremiumCertificate(data) {
  return new Promise(resolve => {
    const width = 1000, height = 700;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#fffbe6';
    ctx.fillRect(0, 0, width, height);

    // Gold border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 16;
    ctx.strokeRect(16, 16, width - 32, height - 32);

    // Inner border
    ctx.strokeStyle = '#bfa14a';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, width - 80, height - 80);

    // Title
    ctx.font = 'bold 48px serif';
    ctx.fillStyle = '#bfa14a';
    ctx.textAlign = 'center';
    ctx.fillText('Certificate of Completion', width / 2, 140);

    // Subtitle
    ctx.font = 'italic 28px serif';
    ctx.fillStyle = '#333';
    ctx.fillText('This is to certify that', width / 2, 220);

    // Student Name
    ctx.font = 'bold 40px serif';
    ctx.fillStyle = '#222';
    ctx.fillText(data.studentName, width / 2, 290);

    // Course info
    ctx.font = 'italic 26px serif';
    ctx.fillStyle = '#333';
    ctx.fillText('has successfully completed the course', width / 2, 350);

    // Course Name
    ctx.font = 'bold 36px serif';
    ctx.fillStyle = '#bfa14a';
    ctx.fillText(data.courseName, width / 2, 410);

    // Instructor
    ctx.font = '24px serif';
    ctx.fillStyle = '#555';
    ctx.fillText(`Instructor: ${data.instructor}`, width / 2, 470);

    // Completion Date
    ctx.font = '20px serif';
    ctx.fillStyle = '#555';
    ctx.fillText(`Date: ${data.completionDate}`, width / 2, 520);

    // Certificate ID
    ctx.font = '16px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText(`Certificate ID: ${data.certificateId}`, width / 2, 560);

    // Footer
    ctx.font = 'bold 28px serif';
    ctx.fillStyle = '#bfa14a';
    ctx.fillText('SmartLearn', width / 2, 640);

    // Convert to base64 PNG
    setTimeout(() => {
      resolve(canvas.toDataURL('image/png').split(',')[1]); // Only base64 part
    }, 100);
  });
}

// --- Send email with EmailJS (with base64 PNG attachment) ---
function sendCertificateEmail({ to_email, to_name, course_name, certificate_base64 }) {
  // Load EmailJS if not already loaded
  if (!window.emailjs) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js';
    script.onload = () => sendCertificateEmail({ to_email, to_name, course_name, certificate_base64 });
    document.body.appendChild(script);
    return;
  }
  emailjs.init(EMAILJS_PUBLIC_KEY);

  // Prepare template params
  const templateParams = {
    to_email,
    to_name,
    course_name,
    message: `Congratulations! You have successfully completed the course "${course_name}". Please find your certificate attached.`,
    subject: `Your Certificate for ${course_name}`,
    certificate_attachment: certificate_base64
  };

  // Send email
  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
    .then(() => {
      console.log('Certificate email sent to', to_email);
    })
    .catch(err => {
      console.error('Failed to send certificate email:', err);
    });
}

// Wait for Firebase, then listen for real-time enrollment changes
function waitForFirebaseAndListenEnrollments() {
  const interval = setInterval(() => {
    if (window.firebaseServicesInitialized) {
      clearInterval(interval);
      firebase.auth().onAuthStateChanged(function(user) {
        window.currentUser = user;
        
        // Update auth UI if function exists
        if (typeof updateAuthUI === 'function') {
          updateAuthUI(user);
        }
        
        if (user) {
          authRequired.classList.add('hidden');
          dashboardContent.classList.remove('hidden');
          // Start listening for enrollment updates AND certificate completion
          listenForEnrollmentUpdates(user);
          listenForCompletedCertificates(user);
        } else {
          authRequired.classList.remove('hidden');
          dashboardContent.classList.add('hidden');
        }
      });
    }
  }, 200);
}

// FIXED: Real-time listener for enrollments with proper progress calculation and UI updates
function listenForEnrollmentUpdates(user) {
  console.log('Setting up enrollment listener for user:', user.uid);
  
  // Ensure Firebase is initialized
  if (!firebase || !firebase.firestore) {
    console.error('Firebase Firestore is not properly initialized');
    showErrorState('Error: Firebase not initialized. Please refresh the page.');
    return () => {}; // Return empty cleanup function
  }
  
  const db = firebase.firestore();
  
  // Show loading state
  showLoadingState();
  
  // Track active promises to avoid race conditions
  let isProcessing = false;
  let pendingUpdate = false;
  
  // Listen to enrollment changes in real-time
  const unsubscribe = db.collection('enrollments')
    .where('userId', '==', user.uid)
    .onSnapshot(async snapshot => {
      // If already processing, mark that an update is pending
      if (isProcessing) {
        pendingUpdate = true;
        return;
      }
      
      isProcessing = true;
      
      try {
        do {
          pendingUpdate = false;
          
          const enrollmentData = snapshot.docs.map(doc => ({
            id: doc.id, 
            ...doc.data() 
          }));
          
          // If no enrollments, show empty state and exit
          if (enrollmentData.length === 0) {
            enrolledCourses = [];
            hideLoadingState();
            showNoCoursesState();
            updateStats();
            break;
          }
          
          // Get unique course IDs
          const uniqueCourseIds = Array.from(new Set(enrollmentData.map(e => e.courseId))).filter(Boolean);
          
          // Fetch course data using the getCoursesByIds function
          let courses = [];
          if (uniqueCourseIds.length > 0) {
            try {
              // Use the local getCoursesByIds function
              courses = await getCoursesByIds(uniqueCourseIds);
              console.log(`Fetched ${courses.length} courses (${uniqueCourseIds.length} unique IDs)`);
            } catch (error) {
              console.error('Failed to fetch courses:', error);
              // Continue with empty courses array to show partial data
            }
          }
          
          const courseMap = new Map(courses.map(c => [c.id, c]));
          const now = Date.now();
          if (!window.__progressUpdateTs) window.__progressUpdateTs = new Map();
          const debounceMs = 15 * 1000; // 15s no-op window for identical value
          const updatePromises = [];
          
          // Process each enrollment
          enrolledCourses = [];
          for (const enrollment of enrollmentData) {
            const courseData = courseMap.get(enrollment.courseId) || {};
            
            // Calculate progress from localStorage (where lecture completion is stored)
            const actualProgress = calculateActualProgress(user.uid, enrollment.courseId, courseData);
            const currentProgress = enrollment.progress || 0;
            
            // Update Firestore only if value changed and we haven't updated very recently
            if (actualProgress !== currentProgress) {
              const key = `${enrollment.id}:${actualProgress}`;
              const lastTs = window.__progressUpdateTs.get(key) || 0;
              
              if (now - lastTs > debounceMs) {
                updatePromises.push(
                  db.collection('enrollments').doc(enrollment.id).update({
                    progress: actualProgress,
                    completed: actualProgress >= 100,
                    lastAccessed: firebase.firestore.FieldValue.serverTimestamp()
                  }).then(() => {
                    window.__progressUpdateTs.set(key, now);
                  })
                );
              }
            }
            
            // Add to enrolled courses with all necessary data
            enrolledCourses.push({
              ...courseData,
              courseId: enrollment.courseId,
              enrollmentId: enrollment.id,
              progress: actualProgress,
              completed: actualProgress >= 100,
              enrolledAt: enrollment.enrolledAt || firebase.firestore.Timestamp.now(),
              title: courseData.title || 'Untitled Course',
              description: courseData.description || 'No description available',
              instructor: courseData.instructor || 'Unknown Instructor',
              duration: courseData.duration || 'Duration not specified',
              image: courseData.image || null,
              modules: courseData.modules || []
            });
          }
          
          // Wait for all updates to complete before refreshing UI
          await Promise.all(updatePromises);
          
          // Sort courses by last accessed or enrollment date
          enrolledCourses.sort((a, b) => {
            const dateA = a.lastAccessed?.toDate?.() || a.enrolledAt?.toDate?.() || new Date(0);
            const dateB = b.lastAccessed?.toDate?.() || b.enrolledAt?.toDate?.() || new Date(0);
            return dateB - dateA; // Newest first
          });
          
          hideLoadingState();
          displayCourses();
          updateStats();
          
        } while (pendingUpdate);
        
      } catch (error) {
        console.error('Error in enrollment listener:', error);
        hideLoadingState();
        showErrorState('Failed to load courses. Please try again later.');
      } finally {
        isProcessing = false;
      }
    }, err => {
      console.error('Error in enrollment listener:', err);
      hideLoadingState();
      showErrorState('Failed to load courses. Please try again later.');
    });
    
    // Return cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
        

}

// FIXED: Calculate actual progress from localStorage with better error handling
function calculateActualProgress(userId, courseId, courseData) {
    try {
        let completedLectures = [];
        const key = `completedLectures_${userId}_${courseId}`;
        const storedData = localStorage.getItem(key);
        if (storedData) {
            completedLectures = JSON.parse(storedData);
        }

        const totalLectures = courseData.modules?.reduce((total, module) => total + (module.lectures?.length || 0), 0) || 0;
        if (totalLectures === 0) return 0;

        const progress = Math.round((completedLectures.length / totalLectures) * 100);
        return Math.min(progress, 100);
    } catch (error) {
        console.error('Error in calculateActualProgress:', error);
        return 0;
    }
}

// --- Get courses by IDs with batching and error handling ---
async function getCoursesByIds(courseIds) {
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
}

// Show loading state
function showLoadingState() {
  console.log('Showing loading state');
  const loadingElement = document.getElementById('my-courses-loading');
  const coursesContainer = document.getElementById('courses-container');
  const noCoursesElement = document.getElementById('no-courses');
  
  if (loadingElement) {
    loadingElement.classList.remove('hidden');
  }
  if (coursesContainer) {
    coursesContainer.innerHTML = '';
  }
  if (noCoursesElement) {
    noCoursesElement.classList.add('hidden');
  }
}

// Hide loading state
function hideLoadingState() {
  console.log('Hiding loading state');
  const loadingElement = document.getElementById('my-courses-loading');
  if (loadingElement) {
    loadingElement.classList.add('hidden');
  }
}

// Show no courses state
function showNoCoursesState(message = 'You haven\'t enrolled in any courses yet.') {
  console.log('Showing no courses state:', message);
  const noCoursesElement = document.getElementById('no-courses');
  if (noCoursesElement) {
    noCoursesElement.classList.remove('hidden');
    const messageElement = noCoursesElement.querySelector('p');
    if (messageElement) {
      messageElement.textContent = message;
    }
  }
  const coursesContainer = document.getElementById('courses-container');
  if (coursesContainer) {
    coursesContainer.classList.add('hidden');
  }
}

// Show error state
function showErrorState(message) {
  console.log('Showing error state:', message);
  const coursesContainer = document.getElementById('courses-container');
  if (coursesContainer) {
    coursesContainer.innerHTML = `
      <div class="text-center py-8">
        <div class="text-red-600 text-lg font-semibold mb-2">Error</div>
        <p class="text-gray-600">${message}</p>
        <button onclick="location.reload()" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh Page</button>
      </div>
    `;
  }
  const noCoursesElement = document.getElementById('no-courses');
  if (noCoursesElement) {
    noCoursesElement.classList.add('hidden');
  }
}

// Update statistics
function updateStats() {
  const total = enrolledCourses.length;
  const completed = enrolledCourses.filter(c => c.completed).length;
  const inProgress = enrolledCourses.filter(c => !c.completed && c.progress > 0).length;
  const certificates = completed;

  const elements = {
    'total-courses': total,
    'completed-courses': completed,
    'progress-courses': inProgress,
    'certificates-count': certificates
  };

  Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });
}

// Display courses based on current tab
function displayCourses() {
  console.log('displayCourses called, currentTab:', currentTab, 'enrolledCourses:', enrolledCourses.length);
  
  const coursesContainer = document.getElementById('courses-container');
  const noCoursesElement = document.getElementById('no-courses');
  
  if (!coursesContainer) {
    console.error('courses-container element not found');
    return;
  }

  let coursesToShow = [];

  switch (currentTab) {
    case 'all':
      coursesToShow = enrolledCourses;
      break;
    case 'in-progress':
      coursesToShow = enrolledCourses.filter(course => !course.completed && course.progress > 0);
      break;
    case 'completed':
      coursesToShow = enrolledCourses.filter(course => course.completed);
      break;
  }

  console.log(`Displaying courses for tab: ${currentTab}, Count: ${coursesToShow.length}`);

  if (coursesToShow.length === 0) {
    let message = 'No courses found.';
    switch (currentTab) {
      case 'all':
        message = 'You haven\'t enrolled in any courses yet.';
        break;
      case 'in-progress':
        message = 'No courses in progress.';
        break;
      case 'completed':
        message = 'No completed courses yet.';
        break;
    }
    showNoCoursesState(message);
    coursesContainer.innerHTML = '';
    if (noCoursesElement) {
      noCoursesElement.classList.remove('hidden');
      const messageElement = noCoursesElement.querySelector('p');
      if (messageElement) {
        messageElement.textContent = message;
      }
    }
  } else {
    if (noCoursesElement) {
      noCoursesElement.classList.add('hidden');
    }
    coursesContainer.innerHTML = coursesToShow.map(createEnrolledCourseCard).join('');
  }
}

// FIXED: Create enrolled course card with proper progress display and image handling
function createEnrolledCourseCard(course) {
    const courseImage = course.image || 'https://via.placeholder.com/400x200?text=Course+Image';
    const progressPercentage = Math.round(course.progress || 0);
    const progressBarWidth = `${progressPercentage}%`;
    const courseTitle = course.title || 'Untitled Course';
    const courseDescription = course.description || 'No description available';
    const courseInstructor = course.instructor || 'Unknown Instructor';
    
    let statusBadge = '';
    let actionButton = '';
    
    if (course.completed) {
        statusBadge = '<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">Completed ✓</span>';
        actionButton = `
            <div class="flex flex-wrap gap-2 items-center">
                <button onclick="openReviewModal('${course.courseId}')" class="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold">
                    Review Course
                </button>
                <button onclick="downloadCertificate('${course.courseId}')" class="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold">
                    Get Certificate
                </button>
                <a href="lecture.html?id=${course.courseId}" class="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold">
                    Continue Learning
                </a>
            </div>
        `;
    } else if (course.progress > 0) {
        statusBadge = '<span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-semibold">In Progress</span>';
        actionButton = `
            <a href="lecture.html?id=${course.courseId}" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold">
                Continue Learning
            </a>
        `;
    } else {
        statusBadge = '<span class="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-semibold">Not Started</span>';
        actionButton = `
            <a href="lecture.html?id=${course.courseId}" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold">
                Start Learning
            </a>
        `;
    }

    return `
        <div class="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
            <div class="relative">
                <img src="${courseImage}" alt="${courseTitle}" class="w-full h-48 object-cover" 
                     onerror="this.src='https://via.placeholder.com/400x200?text=Course+Image'">
                <div class="absolute top-4 right-4">
                    ${statusBadge}
                </div>
            </div>
            <div class="p-6">
                <h3 class="text-xl font-bold mb-2 text-gray-900">${courseTitle}</h3>
                <p class="text-gray-600 mb-4 line-clamp-2">${courseDescription}</p>
                
                <div class="flex items-center mb-4 text-sm text-gray-600">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                    ${courseInstructor}
                </div>
                
                <!-- Progress Bar -->
                <div class="mb-4">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-sm text-gray-600">Progress</span>
                        <span class="text-sm font-semibold ${course.completed ? 'text-green-600' : 'text-gray-900'}">${progressPercentage}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="${course.completed ? 'bg-green-500' : 'bg-blue-600'} h-2 rounded-full transition-all duration-300" style="width: ${progressBarWidth}"></div>
                    </div>
                </div>
                
                <div class="flex items-center justify-between">
                    ${actionButton}
                    <a href="course-details.html?id=${course.courseId}" class="text-blue-600 hover:text-blue-700 transition-colors text-sm font-semibold">
                        View Details
                    </a>
                </div>
            </div>
        </div>
    `;
}

// --- Review Modal Handlers ---
function openReviewModal(courseId) {
  const modal = document.getElementById('review-modal');
  if (!modal) return;
  const hiddenInput = document.getElementById('review-course-id');
  if (hiddenInput) hiddenInput.value = courseId;
  const ratingInput = document.getElementById('review-rating');
  const text = document.getElementById('review-text');
  if (ratingInput) ratingInput.value = '5';
  if (text) text.value = '';
  // Render stars default to 5
  renderReviewStars(5);
  modal.classList.remove('hidden');
}

function closeReviewModal() {
  const modal = document.getElementById('review-modal');
  if (modal) modal.classList.add('hidden');
}

async function submitReview() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      alert('Please log in to submit a review.');
      return;
    }
    const courseId = document.getElementById('review-course-id')?.value;
    const rating = parseInt(document.getElementById('review-rating')?.value || '5', 10);
    const text = document.getElementById('review-text')?.value?.trim() || '';
    if (!courseId) return;

    const review = {
      userId: user.uid,
      userName: user.displayName || user.email || 'Anonymous',
      rating: Math.min(5, Math.max(1, rating)),
      text,
      approved: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await firebase.firestore()
      .collection('courses')
      .doc(courseId)
      .collection('reviews')
      .add(review);

    alert('Thank you for your review!');
    closeReviewModal();
  } catch (err) {
    console.error('Failed to submit review:', err);
    alert('Failed to submit review. Please try again.');
  }
}

// Expose for inline handlers
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.submitReview = submitReview;

// --- Star UI helpers ---
function setReviewRating(n) {
  const ratingInput = document.getElementById('review-rating');
  if (ratingInput) ratingInput.value = String(n);
  renderReviewStars(n);
}

function renderReviewStars(n) {
  const container = document.getElementById('review-stars');
  if (!container) return;
  const stars = container.querySelectorAll('.star');
  stars.forEach(star => {
    const val = parseInt(star.getAttribute('data-star'), 10);
    if (val <= n) {
      star.classList.add('text-yellow-400');
      star.classList.remove('text-gray-300');
    } else {
      star.classList.remove('text-yellow-400');
      star.classList.add('text-gray-300');
    }
  });
}

window.setReviewRating = setReviewRating;

// Format date helper
function formatDate(timestamp) {
  if (!timestamp) return 'Unknown';
  
  // Handle Firestore timestamp
  if (timestamp && timestamp.toDate) {
    return timestamp.toDate().toLocaleDateString();
  }
  
  // Handle regular timestamp
  return new Date(timestamp).toLocaleDateString();
}

// FIXED: Download certificate function with proper completion check
function downloadCertificate(courseId) {
  const course = enrolledCourses.find(c => c.courseId === courseId);
  if (!course) {
    alert('Course not found.');
    return;
  }
  
  if (!course.completed || course.progress < 100) {
    alert('You must complete the course (100%) to download the certificate.');
    return;
  }

  const certificateData = {
    studentName: window.currentUser?.displayName || window.currentUser?.email || 'Student',
    courseName: course.title,
    instructor: course.instructor || 'SmartLearn Team',
    completionDate: new Date().toLocaleDateString(),
    certificateId: `CERT-${courseId}-${window.currentUser?.uid?.substring(0, 8) || 'UNKNOWN'}`
  };

  generateCertificate(certificateData);
}

// Make it available to inline onclick calls
window.downloadCertificate = downloadCertificate;

// Generate a professional certificate
function generateCertificate(data) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Size for better quality
  canvas.width = 1200;
  canvas.height = 850;

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#fdfcfb");
  gradient.addColorStop(1, "#e2d1c3");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border
  ctx.strokeStyle = "#bfa14a";
  ctx.lineWidth = 10;
  ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

  // Title
  ctx.font = "bold 60px Georgia";
  ctx.fillStyle = "#333";
  ctx.textAlign = "center";
  ctx.fillText("Certificate of Excellence", canvas.width / 2, 150);

  // Subtitle
  ctx.font = "24px Arial";
  ctx.fillText("This certifies that", canvas.width / 2, 250);

  // Student Name
  ctx.font = "bold 50px Georgia";
  ctx.fillStyle = "#0d47a1";
  ctx.fillText(data.studentName, canvas.width / 2, 320);

  // Statement
  ctx.font = "24px Arial";
  ctx.fillStyle = "#333";
  ctx.fillText(`has successfully completed the`, canvas.width / 2, 380);

  // Course Name
  ctx.font = "bold 36px Arial";
  ctx.fillStyle = "#1b5e20";
  ctx.fillText(data.courseName, canvas.width / 2, 430);

  // Decorative line
  ctx.strokeStyle = "#bfa14a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(300, 460);
  ctx.lineTo(900, 460);
  ctx.stroke();

  // Instructor & Date
  ctx.font = "20px Arial";
  ctx.fillStyle = "#555";
  ctx.fillText(`Instructor: ${data.instructor}`, canvas.width / 2, 520);
  ctx.fillText(`Completion Date: ${data.completionDate}`, canvas.width / 2, 560);
  ctx.fillText(`Certificate ID: ${data.certificateId}`, canvas.width / 2, 590);

  // SmartLearn branding
  ctx.font = "bold 32px Arial";
  ctx.fillStyle = "#0d47a1";
  ctx.fillText("SmartLearn", canvas.width / 2, 720);

  // Download certificate
  setTimeout(() => {
    canvas.toBlob(function (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.courseName.replace(/[^a-z0-9]/gi, '_')}_Certificate.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }, 100);
}

// Initialize tab switching
function initializeTabSwitching() {
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      currentTab = button.dataset.tab;
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      displayCourses();
    });
  });
}
