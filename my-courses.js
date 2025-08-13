let enrolledCourses = [];
let currentTab = 'all';

// DOM Elements
let authRequired, dashboardContent, coursesContainer, myCoursesLoadingElement, noCoursesElement, tabButtons;

// --- EmailJS config ---
const EMAILJS_SERVICE_ID = 'service_u414ehm';
const EMAILJS_TEMPLATE_ID = 'template_501h3k5';
const EMAILJS_PUBLIC_KEY = 'VCWqhIe6OgMzBGivR';

// Initialize DOM elements when page loads
document.addEventListener('DOMContentLoaded', function () {
  console.log('My Courses page initialized');
  
  authRequired = document.getElementById('auth-required');
  dashboardContent = document.getElementById('dashboard-content');
  coursesContainer = document.getElementById('courses-container');
  myCoursesLoadingElement = document.getElementById('loading');
  noCoursesElement = document.getElementById('no-courses');
  tabButtons = document.querySelectorAll('.tab-btn');

  // Initialize tab switching
  initializeTabSwitching();

  // Initialize login prompt
  const loginPrompt = document.getElementById('login-prompt');
  if (loginPrompt) {
    loginPrompt.addEventListener('click', showLoginModal);
  }

  // Wait for Firebase to be ready, then set up real-time enrollment listener
  waitForFirebaseAndListenEnrollments();
});

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

// FIXED: Real-time listener for enrollments with proper progress calculation
function listenForEnrollmentUpdates(user) {
  const db = firebase.firestore();
  
  showLoadingState();
  
  // Listen to enrollment changes in real-time
  db.collection('enrollments')
    .where('userId', '==', user.uid)
    .onSnapshot(async snapshot => {
      try {
        enrolledCourses = [];
        const enrollmentData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));

        // For each enrollment, get course data and calculate actual progress
        for (const enrollment of enrollmentData) {
          try {
            const courseDoc = await db.collection('courses').doc(enrollment.courseId).get();
            if (courseDoc.exists) {
              const courseData = courseDoc.data();
              
              // FIXED: Calculate progress from localStorage (where lecture completion is stored)
              const actualProgress = calculateActualProgress(user.uid, enrollment.courseId, courseData);
              
              // FIXED: Update Firestore if actual progress is different
              if (actualProgress !== (enrollment.progress || 0)) {
                await db.collection('enrollments').doc(enrollment.id).update({
                  progress: actualProgress,
                  completed: actualProgress >= 100,
                  lastAccessed: firebase.firestore.FieldValue.serverTimestamp()
                });
              }
              
              enrolledCourses.push({
                ...courseData,
                courseId: courseDoc.id,
                enrollmentId: enrollment.id,
                progress: actualProgress, // Use calculated progress
                completed: actualProgress >= 100, // Use calculated completion status
                enrolledAt: enrollment.enrolledAt
              });
            }
          } catch (error) {
            console.error('Error fetching course data:', error);
          }
        }
        
        hideLoadingState();
        displayCourses();
        updateStats();
        
      } catch (error) {
        console.error('Error in enrollment listener:', error);
        hideLoadingState();
        showErrorState('Failed to load courses. Please try again later.');
      }
    }, err => {
      hideLoadingState();
      showErrorState('Failed to load courses. Please try again later.');
      console.error('Error loading enrolled courses:', err);
    });
}

// FIXED: Calculate actual progress from localStorage
function calculateActualProgress(userId, courseId, courseData) {
  try {
    // Get completed lectures from localStorage (same key used in lecture.js)
    const key = `completedLectures_${userId}_${courseId}`;
    const completedLectures = JSON.parse(localStorage.getItem(key) || '[]');
    
    // Count total lectures in the course
    let totalLectures = 0;
    if (courseData.modules && Array.isArray(courseData.modules)) {
      courseData.modules.forEach(module => {
        if (module.lectures && Array.isArray(module.lectures)) {
          totalLectures += module.lectures.length;
        }
      });
    }
    
    // Calculate progress percentage
    if (totalLectures === 0) return 0;
    const progress = Math.round((completedLectures.length / totalLectures) * 100);
    
    console.log(`Progress calculation for ${courseId}:`, {
      completedLectures: completedLectures.length,
      totalLectures,
      progress
    });
    
    return Math.min(progress, 100); // Cap at 100%
    
  } catch (error) {
    console.error('Error calculating progress:', error);
    return 0;
  }
}

// Show loading state
function showLoadingState() {
  if (myCoursesLoadingElement) {
    myCoursesLoadingElement.classList.remove('hidden');
  }
  if (coursesContainer) {
    coursesContainer.classList.add('hidden');
  }
  if (noCoursesElement) {
    noCoursesElement.classList.add('hidden');
  }
}

// Hide loading state
function hideLoadingState() {
  if (myCoursesLoadingElement) {
    myCoursesLoadingElement.classList.add('hidden');
  }
}

// Show no courses state
function showNoCoursesState(message = 'You haven\'t enrolled in any courses yet.') {
  if (noCoursesElement) {
    noCoursesElement.classList.remove('hidden');
    const p = noCoursesElement.querySelector('p');
    if (p) p.textContent = message;
  }
  if (coursesContainer) {
    coursesContainer.classList.add('hidden');
  }
}

// Show error state
function showErrorState(message) {
  if (noCoursesElement) {
    noCoursesElement.classList.remove('hidden');
    const p = noCoursesElement.querySelector('p');
    if (p) p.textContent = message;
  }
  if (coursesContainer) {
    coursesContainer.classList.add('hidden');
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
  if (!coursesContainer || !noCoursesElement) {
    console.error('Required DOM elements not found');
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
    return;
  }

  // Show courses
  noCoursesElement.classList.add('hidden');
  coursesContainer.classList.remove('hidden');
  coursesContainer.innerHTML = coursesToShow.map(course => createEnrolledCourseCard(course)).join('');
}

// FIXED: Create enrolled course card with proper progress display
function createEnrolledCourseCard(course) {
  const progressPercentage = Math.round(course.progress || 0);
  const progressBarWidth = `${progressPercentage}%`;
  
  // Ensure we have default values for missing properties
  const courseTitle = course.title || 'Untitled Course';
  const courseDescription = course.description || 'No description available';
  const courseInstructor = course.instructor || 'Unknown Instructor';
  const courseDuration = course.duration || 'Duration not specified';
  const courseImage = course.image || 'https://placehold.co/400x200?text=Course+Image';

  let statusBadge = '';
  let actionButton = '';

  if (course.completed) {
    statusBadge = '<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">Completed ✓</span>';
    actionButton = `
      <div class="flex space-x-2">
        <a href="lecture.html?id=${course.courseId}" class="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold">
          Review Course
        </a>
        <button onclick="downloadCertificate('${course.courseId}')" class="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold">
          Get Certificate
        </button>
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
             onerror="this.src='https://placehold.co/400x200?text=Course+Image'">
        <div class="absolute top-4 right-4">
          ${statusBadge}
        </div>
        ${course.completed ? `
        <div class="absolute top-4 left-4">
          <div class="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
            100% COMPLETE
          </div>
        </div>
        ` : ''}
      </div>
      
      <div class="p-6">
        <h3 class="text-xl font-bold mb-2 text-gray-900">${courseTitle}</h3>
        <p class="text-gray-600 mb-4 line-clamp-2">${courseDescription}</p>
        
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center text-sm text-gray-600">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
            ${courseInstructor}
          </div>
          <div class="flex items-center text-sm text-gray-600">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            ${courseDuration}
          </div>
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
        
        ${course.enrolledAt ? `
        <div class="mt-3 text-xs text-gray-500">
          Enrolled: ${formatDate(course.enrolledAt)}
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

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

// Tab switching
function initializeTabSwitching() {
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons
      tabButtons.forEach(btn => {
        btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-gray-500');
      });
      
      // Add active class to clicked button
      button.classList.remove('border-transparent', 'text-gray-500');
      button.classList.add('active', 'border-blue-500', 'text-blue-600');
      
      currentTab = button.dataset.tab;
      displayCourses();
    });
  });
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