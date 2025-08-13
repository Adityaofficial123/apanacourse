document.addEventListener('DOMContentLoaded', () => {
    console.log('Lecture page loaded');
    
    // Wait for Firebase and user to be ready
    waitForAuth();
});

function waitForAuth() {
    const interval = setInterval(() => {
        if (window.firebaseServicesInitialized && typeof window.db === 'function') {
            clearInterval(interval);
            console.log('Firebase ready, setting up auth listener');
            
            // Set up auth state listener
            firebase.auth().onAuthStateChanged(function(user) {
                console.log('Auth state in lecture:', user ? user.email : 'No user');
                window.currentUser = user;
                
                // Update auth UI
                if (typeof updateAuthUI === 'function') {
                    updateAuthUI(user);
                }
                
                // Initialize lecture page when user is authenticated
                if (user) {
                    initializeLecturePage();
                } else {
                    showAuthRequired();
                }
            });
        }
    }, 100);
}

function showAuthRequired() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.innerHTML = `
            <div class="text-center py-20">
                <h2 class="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
                <p class="text-gray-600 mb-6">Please log in to access this course.</p>
                <a href="my-courses.html" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
                    Go to My Courses
                </a>
            </div>
        `;
    }
}

async function initializeLecturePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('course-player-content');

    console.log('Initializing lecture page for course:', courseId);

    if (!courseId) {
        console.log('No course ID provided');
        window.location.href = 'my-courses.html';
        return;
    }

    // Check if user is logged in
    if (!window.currentUser) {
        console.log('No user found');
        showAuthRequired();
        return;
    }

    try {
        console.log('Checking enrollment for user:', window.currentUser.uid, 'course:', courseId);
        
        // 1. Verify the user is enrolled in this course
        const enrollmentSnapshot = await window.db()
            .collection('enrollments')
            .where('userId', '==', window.currentUser.uid)
            .where('courseId', '==', courseId)
            .limit(1)
            .get();

        if (enrollmentSnapshot.empty) {
            console.log('User not enrolled in this course');
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <div class="text-center py-20">
                        <h2 class="text-2xl font-bold text-gray-900 mb-4">Enrollment Required</h2>
                        <p class="text-gray-600 mb-6">You are not enrolled in this course.</p>
                        <a href="my-courses.html" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
                            Go to My Courses
                        </a>
                    </div>
                `;
            }
            return;
        }

        console.log('User is enrolled, fetching course data');

        // 2. Fetch the course data
        const courseDoc = await window.db().collection('courses').doc(courseId).get();
        if (!courseDoc.exists) {
            throw new Error("Course not found");
        }
        
        const course = courseDoc.data();
        console.log('Course data loaded:', course.title);
        
        // 3. Update course title
        const courseTitleEl = document.getElementById('course-title');
        if (courseTitleEl) {
            courseTitleEl.textContent = course.title;
        }

        // 4. Render the modules in the sidebar
        const modulesList = document.getElementById('modules-list');
        if (modulesList) {
            modulesList.innerHTML = ''; // Clear existing content

            if (!course.modules || course.modules.length === 0) {
                modulesList.innerHTML = '<div class="p-4 text-gray-500">No course content available yet.</div>';
            } else {
                console.log('Rendering modules:', course.modules.length);
                renderModules(course.modules, modulesList);
            }
        }

        // Store course data globally for the displayContent function
        window.courseData = course;

        // --- Real-time progress/completed listener ---
        setupEnrollmentRealtimeListener(window.currentUser.uid, courseId);

        // Hide loading and show content
        if (loadingEl) loadingEl.classList.add('hidden');
        if (contentEl) contentEl.classList.remove('hidden');

        console.log('Lecture page initialized successfully');
// Listen for real-time enrollment progress/completed and update UI
function setupEnrollmentRealtimeListener(userId, courseId) {
    const db = window.db();
    db.collection('enrollments')
      .where('userId', '==', userId)
      .where('courseId', '==', courseId)
      .limit(1)
      .onSnapshot(snapshot => {
        if (snapshot.empty) return;
        const enrollment = snapshot.docs[0].data();
        // Update progress bar and completed state in UI
        updateProgressUI(enrollment.progress || 0, enrollment.completed || false);
      });
}

// Update progress bar and completed state in lecture page UI
function updateProgressUI(progress, completed) {
    // Update progress bar if present
    const progressBar = document.querySelector('.progress-bar');
    const progressLabel = document.querySelector('.progress-label');
    if (progressBar) progressBar.style.width = progress + '%';
    if (progressLabel) progressLabel.textContent = progress + '%';

    // Optionally, update completed state (e.g., disable mark-completed button)
    const btn = document.getElementById('mark-completed-btn');
    if (btn && completed) {
        btn.disabled = true;
        btn.textContent = 'Completed';
        btn.classList.add('bg-gray-400', 'cursor-not-allowed');
        btn.classList.remove('bg-green-600', 'hover:bg-green-700');
    }
}

    } catch (error) {
        console.error("Error loading course player:", error);
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div class="text-center py-20">
                    <h2 class="text-2xl font-bold text-red-600 mb-4">Error Loading Course</h2>
                    <p class="text-gray-600 mb-6">${error.message}</p>
                    <a href="my-courses.html" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
                        Go Back
                    </a>
                </div>
            `;
        }
    }
}
function renderModules(modules, modulesList) {
  modulesList.innerHTML = '';

  modules.forEach((module, moduleIndex) => {
    const moduleId = `module-${moduleIndex}`;
    const moduleEl = document.createElement('div');
    moduleEl.className = 'border-b border-gray-300 rounded-md overflow-hidden shadow-sm mb-3';

    let lecturesHTML = '';
    if (module.lectures && module.lectures.length > 0) {
      lecturesHTML = `
        <div class="mb-3">
          <h4 class="text-sm font-semibold text-gray-600 mb-2 flex items-center">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Lectures (${module.lectures.length})
          </h4>
          <ul class="space-y-1">
            ${module.lectures.map((lecture, lectureIndex) => `
              <li class="lecture-item flex items-center p-2 rounded hover:bg-blue-50 cursor-pointer transition-colors"
                  data-module="${moduleIndex}" data-lecture="${lectureIndex}">
                <svg class="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="text-sm text-gray-800 truncate flex-1">
                  Part ${lectureIndex + 1}: ${lecture.title}
                </div>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    let notesHTML = '';
    if (module.notes && module.notes.length > 0) {
      notesHTML = `
        <div class="mb-3">
          <h4 class="text-sm font-semibold text-gray-600 mb-2 flex items-center">
            <svg class="w-4 h-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Notes (${module.notes.length})
          </h4>
          <ul class="space-y-1">
            ${module.notes.map((note, noteIndex) => `
              <li class="note-item flex items-center p-2 rounded hover:bg-green-50 cursor-pointer transition-colors"
                  data-module="${moduleIndex}" data-note="${noteIndex}">
                <div class="text-sm text-gray-800">${note.title}</div>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    moduleEl.innerHTML = `
      <button onclick="toggleModule('${moduleId}')" class="w-full text-left px-4 py-3 bg-blue-100 hover:bg-blue-200 font-bold text-blue-700">
        📂 ${module.title}
      </button>
      <div id="${moduleId}" class="hidden px-4 pb-4 bg-white">
        ${lecturesHTML}
        ${notesHTML}
      </div>
    `;

    modulesList.appendChild(moduleEl);
  });

  attachEventListeners();
}


function attachEventListeners() {
    // Attach event listeners for lectures
    document.querySelectorAll('.lecture-item').forEach(item => {
        item.addEventListener('click', () => {
            // Remove active from all
            document.querySelectorAll('.lecture-item').forEach(i => i.classList.remove('bg-blue-100', 'font-semibold'));
            item.classList.add('bg-blue-100', 'font-semibold');
            const moduleIndex = parseInt(item.getAttribute('data-module'));
            const lectureIndex = parseInt(item.getAttribute('data-lecture'));
            displayContent(moduleIndex, lectureIndex, 'lecture');
            item.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
    });
    // Attach event listeners for notes
    document.querySelectorAll('.note-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.note-item').forEach(i => i.classList.remove('bg-green-100', 'font-semibold'));
            item.classList.add('bg-green-100', 'font-semibold');
            const moduleIndex = parseInt(item.getAttribute('data-module'));
            const noteIndex = parseInt(item.getAttribute('data-note'));
            displayContent(moduleIndex, noteIndex, 'note');
        });
    });
}

function displayContent(moduleIndex, itemIndex, type) {
    console.log('Displaying content:', type, moduleIndex, itemIndex);
    
    const videoContainer = document.getElementById('video-container');
    const notesContainer = document.getElementById('notes-container');
    const welcomeMessage = document.getElementById('welcome-message');

    // Hide all containers first
    if (videoContainer) videoContainer.classList.add('hidden');
    if (notesContainer) notesContainer.classList.add('hidden');
    if (welcomeMessage) welcomeMessage.classList.add('hidden');

    if (!window.courseData || !window.courseData.modules) {
        console.error('Course data not available');
        return;
    }

    const module = window.courseData.modules[moduleIndex];
    if (!module) {
        console.error('Module not found:', moduleIndex);
        return;
    }

    if (type === 'lecture' && module.lectures) {
        const lecture = module.lectures[itemIndex];
        if (!lecture) return;
               displayLecture(lecture, videoContainer, moduleIndex, itemIndex);
        // filepath: e:\smartlearnV1-main\smartlearnV1-main\lecture.js
    } else if (type === 'note' && module.notes) {
        const note = module.notes[itemIndex];
        if (!note) {
            console.error('Note not found:', itemIndex);
            return;
        }

        console.log('Displaying note:', note.title);
        displayNote(note, notesContainer);
    }
}

// FIXED: Updated displayLecture function with better completion tracking
function displayLecture(lecture, videoContainer, moduleIndex, lectureIndex) {
  if (!videoContainer) return;

  // Remove previous title
  const existingTitle = videoContainer.querySelector('h3');
  if (existingTitle) existingTitle.remove();

  // Add lecture title
  const lectureTitle = document.createElement('h3');
  lectureTitle.className = 'text-2xl font-bold mb-4 text-gray-800 text-center';
  lectureTitle.textContent = lecture.title;

  // Remove previous video elements
  videoContainer.innerHTML = '';
  videoContainer.appendChild(lectureTitle);

  // Google Drive video detection
  // Google Drive video detection with pop-out blocker
if (lecture.videoUrl && lecture.videoUrl.includes('drive.google.com')) {
    const match = lecture.videoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
        const fileId = match[1];
        
        // Create iframe
        const iframe = document.createElement('iframe');
        iframe.src = `https://drive.google.com/file/d/${fileId}/preview`;
        iframe.width = "100%";
        iframe.height = "480";
        iframe.allow = "autoplay";
        iframe.allowFullscreen = true;
        iframe.frameBorder = "0";
        iframe.className = "rounded-lg shadow-md";

        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = "flex justify-center w-full";
        wrapper.style.position = "relative"; // allow overlay positioning
        wrapper.appendChild(iframe);

        // Create overlay to hide pop-out button
        const overlay = document.createElement('div');
        overlay.style.position = "absolute";
        overlay.style.top = "0";
        overlay.style.right = "0";
        overlay.style.width = "60px"; // adjust size if needed
        overlay.style.height = "60px";
        overlay.style.backgroundColor = "white"; // match background to hide icon
        overlay.style.zIndex = "10";
        overlay.style.pointerEvents = "auto"; // block clicks

        wrapper.appendChild(overlay);

        videoContainer.appendChild(wrapper);
        videoContainer.classList.remove('hidden');

        // Add completion button
        addCompletionButton(videoContainer, moduleIndex, lectureIndex);
        return;
    } else {
        videoContainer.innerHTML += "<p class='text-red-600'>Invalid Google Drive URL</p>";
        return;
    }
}


  // Cloudinary video detection
  if (lecture.videoUrl && lecture.videoUrl.includes('res.cloudinary.com')) {
    const cloudName = 'dxwhobraz';
    let publicId = '';
    const match = lecture.videoUrl.match(/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
    if (match) publicId = match[1];

    // Create video element
    const videoEl = document.createElement('video');
    videoEl.id = 'cloudinary-player';
    videoEl.className = 'cld-video-player rounded-lg shadow-md w-full';
    videoEl.setAttribute('controls', '');
    videoEl.setAttribute('playsinline', '');
    videoContainer.appendChild(videoEl);

    // Initialize player
    if (typeof cloudinary !== 'undefined') {
      const player = cloudinary.videoPlayer('cloudinary-player', {
        cloud_name: cloudName,
        controls: true,
        autoplay: false,
        keyboardShortcuts: true,
        width: '100%',
        height: 400,
        preload: 'auto',
        playbackRates: [0.5, 1, 1.25, 1.5, 2, 2.5, 3],
        showJumpControls: true,
        jumpSeconds: 10,
        qualitySelector: true,
        showVolumeWidget: true,
        showFullscreenToggle: true,
        showPlayToggle: true,
        showPictureInPictureToggle: true,
        showSettings: true
      });
      player.source(publicId);

      // Optional: Sync speed selector dropdown
      const speedDropdown = document.getElementById('playback-speed');
      if (speedDropdown) {
        speedDropdown.onchange = function() {
          player.playbackRate(parseFloat(this.value));
        };
      }
    }

    videoContainer.classList.remove('hidden');
    addCompletionButton(videoContainer, moduleIndex, lectureIndex);
    return;
  }

  // Handle other video URLs (YouTube, etc.)
  if (lecture.videoUrl && (lecture.videoUrl.includes('youtube.com') || lecture.videoUrl.includes('youtu.be'))) {
    console.log('Loading YouTube video:', lecture.videoUrl);

    // Create new iframe
    let embedUrl = lecture.videoUrl;
    if (embedUrl.includes('watch?v=')) {
      embedUrl = embedUrl.replace('watch?v=', 'embed/');
    } else if (embedUrl.includes('youtu.be/')) {
      embedUrl = embedUrl.replace('youtu.be/', 'youtube.com/embed/');
    }

    const iframe = document.createElement('iframe');
    iframe.width = "100%";
    iframe.height = "400";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.className = "rounded-lg shadow-md";
    iframe.src = embedUrl;
    videoContainer.appendChild(iframe);

    videoContainer.classList.remove('hidden');
    addCompletionButton(videoContainer, moduleIndex, lectureIndex);
    return;
  } else if (lecture.videoUrl) {
    console.log('Loading regular video:', lecture.videoUrl);
    
    // Create regular video element
    const video = document.createElement('video');
    video.src = lecture.videoUrl;
    video.controls = true;
    video.className = "w-full rounded-lg shadow-md";
    video.style.maxHeight = "400px";
    videoContainer.appendChild(video);
  }

  addCompletionButton(videoContainer, moduleIndex, lectureIndex);
  videoContainer.classList.remove('hidden');
}

// FIXED: Improved function to handle lecture completion and sync progress to Firestore
async function handleLectureCompletedAndSyncProgress(moduleIndex, lectureIndex) {
  try {
    // Validate inputs
    if (!window.courseData || !window.courseData.modules || !window.currentUser) {
      console.error('Missing required data for progress sync');
      return;
    }

    // Get course ID from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');
    if (!courseId) {
      console.error('No course ID found');
      return;
    }

    // Mark lecture as completed in localStorage
    const key = `completedLectures_${window.currentUser.uid}_${courseId}`;
    let completedLectures = JSON.parse(localStorage.getItem(key) || '[]');
    const lectureId = `${moduleIndex}-${lectureIndex}`;
    
    if (!completedLectures.includes(lectureId)) {
      completedLectures.push(lectureId);
      localStorage.setItem(key, JSON.stringify(completedLectures));
      console.log('Lecture marked as completed in localStorage:', lectureId);
    }

    // Calculate total lectures and progress
    let totalLectures = 0;
    window.courseData.modules.forEach(module => {
      if (Array.isArray(module.lectures)) {
        totalLectures += module.lectures.length;
      }
    });

    const progress = totalLectures > 0 ? Math.round((completedLectures.length / totalLectures) * 100) : 0;
    const isCompleted = progress >= 100;

    console.log('Progress calculation:', {
      completedLectures: completedLectures.length,
      totalLectures,
      progress,
      isCompleted
    });

    // Update progress in Firestore
    const db = firebase.firestore();
    
    // Find the enrollment document
    const enrollmentSnapshot = await db.collection('enrollments')
      .where('userId', '==', window.currentUser.uid)
      .where('courseId', '==', courseId)
      .limit(1)
      .get();

    if (!enrollmentSnapshot.empty) {
      const enrollmentDoc = enrollmentSnapshot.docs[0];
      const updateData = {
        progress: progress,
        completed: isCompleted,
        lastAccessed: firebase.firestore.FieldValue.serverTimestamp()
      };

      // If completed, also store completion timestamp
      if (isCompleted) {
        updateData.completedAt = firebase.firestore.FieldValue.serverTimestamp();
      }

      await enrollmentDoc.ref.update(updateData);
      console.log('Progress updated in Firestore:', updateData);

      // Show success message
      showNotification(`Progress updated: ${progress}%${isCompleted ? ' - Course Completed! 🎉' : ''}`, 'success');
    } else {
      console.error('Enrollment document not found');
      showNotification('Error updating progress', 'error');
    }

    // Update button state
    const btn = document.getElementById('mark-completed-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Completed ✓';
      btn.className = 'mt-4 bg-gray-400 text-white px-4 py-2 rounded cursor-not-allowed font-semibold';
      btn.onclick = null;
    }

    // If course is completed, trigger celebration
    if (isCompleted) {
      setTimeout(() => {
        showCourseCompletedModal(courseId);
      }, 1000);
    }

  } catch (error) {
    console.error('Error updating progress:', error);
    showNotification('Failed to update progress', 'error');
  }
}
// FIXED: Helper function to add completion button with proper state
function addCompletionButton(container, moduleIndex, lectureIndex) {
  // Check if lecture is already completed
  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get('id');
  if (!courseId || !window.currentUser) return;

  const key = `completedLectures_${window.currentUser.uid}_${courseId}`;
  const completedLectures = JSON.parse(localStorage.getItem(key) || '[]');
  const lectureId = `${moduleIndex}-${lectureIndex}`;
  const isCompleted = completedLectures.includes(lectureId);

  // Remove existing button if any
  const existingBtn = container.querySelector('#mark-completed-btn');
  if (existingBtn) existingBtn.remove();

  // Create completion button
  const completeBtn = document.createElement('button');
  completeBtn.id = 'mark-completed-btn';
  
  if (isCompleted) {
    completeBtn.className = 'mt-4 bg-gray-400 text-white px-4 py-2 rounded cursor-not-allowed font-semibold';
    completeBtn.textContent = 'Completed ✓';
    completeBtn.disabled = true;
  } else {
    completeBtn.className = 'mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors font-semibold';
    completeBtn.textContent = 'Mark as Completed';
    completeBtn.onclick = () => handleLectureCompletedAndSyncProgress(moduleIndex, lectureIndex);
  }
  
  container.appendChild(completeBtn);
}

// FIXED: Show course completion modal
function showCourseCompletedModal(courseId) {
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
      <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
        </svg>
      </div>
      <h3 class="text-2xl font-bold text-gray-900 mb-4">🎉 Congratulations!</h3>
      <p class="text-gray-600 mb-6">You have successfully completed this course! Your certificate will be available in your dashboard.</p>
      <div class="flex space-x-3">
        <button onclick="this.closest('.fixed').remove()" class="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors">
          Continue Learning
        </button>
        <a href="my-courses.html" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          View Dashboard
        </a>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
  }, 10000);
}

// FIXED: Notification system
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.notification-toast');
  existingNotifications.forEach(n => n.remove());

  const notification = document.createElement('div');
  notification.className = `notification-toast fixed top-20 right-6 z-50 px-6 py-3 rounded-lg shadow-lg transition-all transform translate-x-full max-w-sm`;
  
  const colors = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    info: 'bg-blue-500 text-white',
    warning: 'bg-yellow-500 text-white'
  };
  
  notification.className += ` ${colors[type] || colors.info}`;
  notification.innerHTML = `
    <div class="flex items-center">
      <span class="flex-1">${message}</span>
      <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white hover:text-gray-200">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4-4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
        </svg>
      </button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.classList.remove('translate-x-full');
  }, 100);
  
  // Animate out and remove after 5 seconds
  setTimeout(() => {
    notification.classList.add('translate-x-full');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 5000);
}

// Make functions available globally
window.handleLectureCompletedAndSyncProgress = handleLectureCompletedAndSyncProgress;
window.showNotification = showNotification;

function displayNote(note, notesContainer) {
    if (!notesContainer) {
        console.error('Notes container not found');
        return;
    }

    const notesTitle = document.getElementById('notes-title');
    const notesContent = document.getElementById('notes-content');
    
    if (notesTitle) {
        notesTitle.textContent = note.title;
    }
    
    if (notesContent) {
        // Check if note has a PDF URL
        if (note.pdfUrl) {
            notesContent.innerHTML = `
                <a href="${note.pdfUrl}" target="_blank" class="text-blue-600 underline">View PDF Note</a>
                <a href="${note.pdfUrl}" download class="ml-4 bg-blue-500 text-white px-3 py-1 rounded">Download PDF</a>
                <br>
                <iframe src="${note.pdfUrl}" width="100%" height="600px"></iframe>
            `;
        } else {
            notesContent.innerHTML = note.content || '<p>Note content not available.</p>';
        }
    }
    
    notesContainer.classList.remove('hidden');
}

document.addEventListener('keydown', function(e) {
    const activeLecture = document.querySelector('.lecture-item.bg-blue-100');
    const activeNote = document.querySelector('.note-item.bg-green-100');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        let items = [];
        let idx = -1;
        if (activeLecture) {
            items = Array.from(document.querySelectorAll('.lecture-item'));
            idx = items.indexOf(activeLecture);
        } else if (activeNote) {
            items = Array.from(document.querySelectorAll('.note-item'));
            idx = items.indexOf(activeNote);
        }
        if (items.length > 0 && idx !== -1) {
            let nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
            if (nextIdx >= 0 && nextIdx < items.length) {
                items[nextIdx].click();
            }
        }
    }
});

document.getElementById('playback-speed').addEventListener('change', function() {
    const video = document.getElementById('video-player');
    if (video) video.playbackRate = parseFloat(this.value);
});

let ytPlayer; // Global variable

function onYouTubeIframeAPIReady() {
  ytPlayer = new YT.Player('youtube-player', {
    events: {
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerStateChange(event) {
  // 0 means video ended
  if (event.data === YT.PlayerState.ENDED) {
    handleVideoCompleted();
  }
}

// Call this after rendering the iframe for a lecture
function setupYouTubeProgressTracking() {
  if (window.YT && window.YT.Player) {
    ytPlayer = new YT.Player('youtube-player', {
      events: {
        'onStateChange': onPlayerStateChange
      }
    });
  }
}

// Call setupYouTubeProgressTracking() after displaying a new lecture

async function handleLectureCompleted(moduleIndex, lectureIndex) {
  // Get enrollmentId for this user/course
  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get('id');
  const userId = window.currentUser?.uid;
  if (!userId || !courseId) return;

  // Find enrollment
  const enrollmentSnapshot = await window.db()
    .collection('enrollments')
    .where('userId', '==', userId)
    .where('courseId', '==', courseId)
    .limit(1)
    .get();

  if (enrollmentSnapshot.empty) return;
  const enrollmentId = enrollmentSnapshot.docs[0].id;

  // Calculate progress: count completed lectures
  if (!window.courseData) return;
  const modules = window.courseData.modules || [];
  let totalLectures = 0;
  modules.forEach(m => totalLectures += (m.lectures?.length || 0));

  // Store completed lectures in localStorage (or Firestore for more accuracy)
  const completedKey = `completedLectures_${userId}_${courseId}`;
  let completedLectures = JSON.parse(localStorage.getItem(completedKey) || '[]');
  const lectureId = `${moduleIndex}-${lectureIndex}`;
  if (!completedLectures.includes(lectureId)) {
    completedLectures.push(lectureId);
    localStorage.setItem(completedKey, JSON.stringify(completedLectures));
  }

  const progress = Math.round((completedLectures.length / totalLectures) * 100);

  // Update progress in Firestore
  await window.DatabaseAPI.updateEnrollmentProgress(enrollmentId, progress);

  alert('Lecture marked as completed! Progress updated.');
}

function toggleModule(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden');
}
