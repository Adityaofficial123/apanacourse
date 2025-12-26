// Navbar scroll effect
window.addEventListener('scroll', function() {
  const navbar = document.getElementById('navbar');
  if (navbar) {
    if (window.scrollY > 50) {
      navbar.classList.add('bg-white/95', 'backdrop-blur-sm');
    } else {
      navbar.classList.remove('bg-white/95', 'backdrop-blur-sm');
    }
  }
});

// Authentication UI
function updateAuthUI(user) {
  const authButtons = document.getElementById('auth-buttons');
  const userInfo = document.getElementById('user-info');
  const userName = document.getElementById('user-name');
  const userPhoto = document.getElementById('user-photo');
  // Mobile elements
  const authButtonsSm = document.getElementById('auth-buttons-sm');
  const userInfoSm = document.getElementById('user-info-sm');
  const userNameSm = document.getElementById('user-name-sm');
  const userPhotoSm = document.getElementById('user-photo-sm');

  if (user) {
    if (authButtons) { authButtons.classList.add('hidden'); authButtons.classList.remove('flex'); }
    if (userInfo) { userInfo.classList.remove('hidden'); userInfo.classList.add('flex'); }
    if (userName) userName.textContent = user.displayName || user.email;
    if (userPhoto) {
      if (user.photoURL) {
        userPhoto.src = user.photoURL;
        userPhoto.alt = user.displayName || user.email || 'User photo';
        userPhoto.classList.remove('hidden');
      } else {
        userPhoto.classList.add('hidden');
      }
    }
    // Mobile
    if (authButtonsSm) { authButtonsSm.classList.add('hidden'); authButtonsSm.classList.remove('flex'); }
    if (userInfoSm) { userInfoSm.classList.remove('hidden'); userInfoSm.classList.add('flex'); }
    if (userNameSm) userNameSm.textContent = user.displayName || user.email;
    if (userPhotoSm) {
      if (user.photoURL) {
        userPhotoSm.src = user.photoURL;
        userPhotoSm.alt = user.displayName || user.email || 'User photo';
        userPhotoSm.classList.remove('hidden');
      } else {
        userPhotoSm.classList.add('hidden');
      }
    }
    // currentUser is managed by firebase.js
  } else {
    if (authButtons) { authButtons.classList.remove('hidden'); authButtons.classList.add('flex'); }
    if (userInfo) { userInfo.classList.add('hidden'); userInfo.classList.remove('flex'); }
    if (userName) userName.textContent = '';
    if (userPhoto) {
      userPhoto.src = '';
      userPhoto.alt = '';
      userPhoto.classList.add('hidden');
    }
    // Mobile
    if (authButtonsSm) { authButtonsSm.classList.remove('hidden'); authButtonsSm.classList.add('flex'); }
    if (userInfoSm) { userInfoSm.classList.add('hidden'); userInfoSm.classList.remove('flex'); }
    if (userNameSm) userNameSm.textContent = '';
    if (userPhotoSm) {
      userPhotoSm.src = '';
      userPhotoSm.alt = '';
      userPhotoSm.classList.add('hidden');
    }
  }
}

// Show login modal
function showLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

// Hide login modal
function hideLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Google login (delegates to firebase.js global which handles popup/redirect)
async function signInWithGoogle() {
  try {
    if (typeof window.signInWithGoogle === 'function') {
      await window.signInWithGoogle();
    } else {
      // Fallback to redirect if globals missing
      await firebase.auth().signInWithRedirect(googleProvider);
    }
  } catch (error) {
    console.error('Error starting Google sign-in:', error);
    alert('Error starting Google sign-in. Please try again.');
  }
}

// Logout (delegate to firebase.js)
async function signOut() {
  try {
    if (typeof window.signOut === 'function') {
      await window.signOut();
    } else {
      await firebase.auth().signOut();
    }
    console.log('User signed out');
    // Redirect to home page after logout
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Error signing out:', error);
  }
}

// Email/Password Login
async function signInWithEmail(email, password) {
  try {
    if (typeof window.signInWithEmail === 'function') {
      return await window.signInWithEmail(email, password);
    }
    const auth = firebase.auth();
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Error details during sign in:', {
      code: error.code,
      message: error.message,
      email: email,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

// Send password reset email
async function sendPasswordResetEmail(email) {
  try {
    if (typeof window.sendPasswordResetEmail === 'function') {
      return await window.sendPasswordResetEmail(email);
    }
    await firebase.auth().sendPasswordResetEmail(email);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
}

// Toggle loading state for buttons
function setLoading(button, isLoading) {
  const spinner = button.querySelector('svg');
  const text = button.querySelector('span');
  
  if (isLoading) {
    button.disabled = true;
    spinner.classList.remove('hidden');
    if (text) text.style.opacity = '0.7';
  } else {
    button.disabled = false;
    spinner.classList.add('hidden');
    if (text) text.style.opacity = '1';
  }
}

// Show/hide forgot password modal
function showForgotPasswordModal() {
  const modal = document.getElementById('forgot-password-modal');
  if (modal) {
    modal.classList.remove('hidden');
    document.getElementById('reset-email').focus();
  }
}

function hideForgotPasswordModal() {
  const modal = document.getElementById('forgot-password-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Initialize login form
function initLoginForm() {
  const loginForm = document.getElementById('login-form');
  const forgotPasswordBtn = document.getElementById('forgot-password');
  const sendResetBtn = document.getElementById('send-reset-link');
  const cancelResetBtn = document.getElementById('cancel-reset');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginSubmit = document.getElementById('login-submit');

  // Enable/disable login button based on form validity
  function updateLoginButtonState() {
    if (loginEmail && loginPassword && loginSubmit) {
      loginSubmit.disabled = !loginEmail.validity.valid || !loginPassword.value.trim();
    }
  }

  // Email/Password login form submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = loginEmail.value.trim();
      const password = loginPassword.value;
      const errorElement = document.getElementById('login-error');
      
      if (!email || !password) {
        showError(errorElement, 'Please enter both email and password');
        return;
      }
      
      try {
        setLoading(loginSubmit, true);
        
        // First check account status
        const accountStatus = await checkAccountStatus(email);
        console.log('Account status:', accountStatus);
        
        if (!accountStatus.exists) {
          showError(errorElement, accountStatus.message);
          return;
        }
        
        // Try to sign in
        try {
          await signInWithEmail(email, password);
          hideLoginModal();
          // Reset form
          loginForm.reset();
          errorElement.classList.add('hidden');
        } catch (error) {
          let errorMessage = 'Failed to sign in. Please try again.';
          switch (error.code) {
            case 'auth/wrong-password':
              errorMessage = 'Incorrect password. Please try again or use "Forgot password" to reset it.';
              break;
            case 'auth/too-many-requests':
              errorMessage = 'Too many failed attempts. Please try again later or reset your password.';
              break;
            case 'auth/user-disabled':
              errorMessage = 'This account has been disabled. Please contact support.';
              break;
            default:
              errorMessage = `Error: ${error.message}`;
          }
          showError(errorElement, errorMessage);
        }
      } catch (error) {
        console.error('Unexpected error during login:', error);
        showError(errorElement, 'An unexpected error occurred. Please try again.');
      } finally {
        setLoading(loginSubmit, false);
      }
    });
  }

  // Forgot password button click
  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const email = loginEmail.value.trim();
      if (email) {
        document.getElementById('reset-email').value = email;
      }
      showForgotPasswordModal();
    });
  }

  // Send reset link button click
  if (sendResetBtn) {
    sendResetBtn.addEventListener('click', async () => {
      const email = document.getElementById('reset-email').value.trim();
      const errorElement = document.getElementById('forgot-error');
      const successElement = document.getElementById('forgot-success');
      
      if (!email) {
        showError(errorElement, 'Please enter your email address');
        return;
      }
      
      try {
        setLoading(sendResetBtn, true);
        errorElement.classList.add('hidden');
        successElement.classList.add('hidden');
        
        await sendPasswordResetEmail(email);
        
        // Show success message
        successElement.textContent = `Password reset email sent to ${email}. Please check your inbox.`;
        successElement.classList.remove('hidden');
        
        // Hide success message after 5 seconds
        setTimeout(() => {
          successElement.classList.add('hidden');
          hideForgotPasswordModal();
        }, 5000);
        
      } catch (error) {
        let errorMessage = 'Failed to send reset email. Please try again.';
        if (error.code === 'auth/user-not-found') {
          errorMessage = 'No account found with this email address';
        }
        showError(errorElement, errorMessage);
      } finally {
        setLoading(sendResetBtn, false);
      }
    });
  }

  // Cancel reset button
  if (cancelResetBtn) {
    cancelResetBtn.addEventListener('click', hideForgotPasswordModal);
  }

  // Close modal when clicking outside
  const forgotModal = document.getElementById('forgot-password-modal');
  if (forgotModal) {
    forgotModal.addEventListener('click', (e) => {
      if (e.target === forgotModal) {
        hideForgotPasswordModal();
      }
    });
  }

  // Close button for forgot password modal
  const closeForgotModalBtn = document.getElementById('close-forgot-modal');
  if (closeForgotModalBtn) {
    closeForgotModalBtn.addEventListener('click', hideForgotPasswordModal);
  }

  // Update login button state on input
  if (loginEmail && loginPassword) {
    [loginEmail, loginPassword].forEach(input => {
      input.addEventListener('input', updateLoginButtonState);
    });
  }
}

// Check user account status
async function checkAccountStatus(email) {
  try {
    console.log('Checking account status for:', email);
    const methods = await firebase.auth().fetchSignInMethodsForEmail(email);
    console.log('Available sign-in methods:', methods);
    
    if (methods.length === 0) {
      return { exists: false, message: 'No account found with this email. Please sign up first.' };
    }
    
    if (!methods.includes('password')) {
      return { 
        exists: true, 
        message: 'This email is registered but not with a password. Try signing in with Google or another method.'
      };
    }
    
    return { exists: true, message: 'Account exists and password sign-in is enabled.' };
  } catch (error) {
    console.error('Error checking account status:', error);
    return { 
      exists: false, 
      message: `Error checking account: ${error.message}` 
    };
  }
}

// Helper function to show error messages
function showError(element, message) {
  if (element) {
    element.textContent = message;
    element.classList.remove('hidden');
    // Hide error after 5 seconds
    setTimeout(() => {
      element.classList.add('hidden');
    }, 5000);
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
  console.log('Script.js loaded');
  
  // Initialize login form and related functionality
  initLoginForm();
  
  // Login button in navigation: show login modal
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      const loginModal = document.getElementById('login-modal');
      if (loginModal) {
        loginModal.classList.remove('hidden');
        document.getElementById('login-email').focus();
      }
    });
  }
  
  // Google login button in modal
  const googleLoginBtn = document.getElementById('google-login');
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', signInWithGoogle);
  }
  // Mobile navbar login button
  const loginBtnSm = document.getElementById('login-btn-sm');
  if (loginBtnSm) {
    loginBtnSm.addEventListener('click', signInWithGoogle);
  }
  
  // Close modal button
  const closeModalBtn = document.getElementById('close-modal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', hideLoginModal);
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', signOut);
  }
  // Mobile logout button
  const logoutBtnSm = document.getElementById('logout-btn-sm');
  if (logoutBtnSm) {
    logoutBtnSm.addEventListener('click', signOut);
  }
  
  // Close modal when clicking outside
  const loginModal = document.getElementById('login-modal');
  if (loginModal) {
    loginModal.addEventListener('click', function(e) {
      if (e.target === loginModal) {
        hideLoginModal();
      }
    });
  }
  
  // Close modal when pressing Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      hideLoginModal();
      hideForgotPasswordModal();
    }
  });
  
  // Wait for Firebase to initialize before handling redirect result and setting up auth
  waitForFirebaseAndSetupAuth();
});

// Wait for Firebase to be ready then setup authentication
function waitForFirebaseAndSetupAuth() {
  const interval = setInterval(() => {
    if (window.firebaseServicesInitialized) {
      clearInterval(interval);
      // Handle redirect result once after returning from Google
      handleRedirectResult().finally(() => {
        setupAuthListener();
        // Immediately sync UI if current user is already available
        try {
          if (typeof window.getCurrentUser === 'function') {
            updateAuthUI(window.getCurrentUser());
          }
        } catch (e) {}
      });
    }
  }, 100);
}

// Process Google sign-in redirect result (runs once after init)
async function handleRedirectResult() {
  try {
    const result = await firebase.auth().getRedirectResult();
    if (result && result.user) {
      console.log('Redirect sign-in success:', result.user.email);
      updateAuthUI(result.user);
    }
  } catch (error) {
    // Common benign case: no redirect result available
    if (error && error.code) {
      console.warn('No redirect result or sign-in error:', error.code);
    } else {
      console.warn('No redirect result.');
    }
  }
}

// Setup authentication state listener
function setupAuthListener() {
  if (typeof window.onAuthStateChanged === 'function') {
    window.onAuthStateChanged(function(user) {
      console.log('Auth state changed in script.js:', user ? user.email : 'No user');
      updateAuthUI(user);
      // Load featured courses on homepage
      const currentPage = window.location.pathname;
      if (currentPage.includes('index.html') || currentPage === '/' || currentPage === '') {
        loadFeaturedCourses();
      }
    });
  } else {
    // Fallback directly to Firebase listener
    firebase.auth().onAuthStateChanged(function(user) {
      console.log('Auth state changed in script.js (fallback):', user ? user.email : 'No user');
      updateAuthUI(user);
      const currentPage = window.location.pathname;
      if (currentPage.includes('index.html') || currentPage === '/' || currentPage === '') {
        loadFeaturedCourses();
      }
    });
  }
}

// Load featured courses for homepage
async function loadFeaturedCourses() {
  // Resolve container once at the start
  const featuredCoursesContainer = document.getElementById('featured-courses');
  if (!featuredCoursesContainer) {
    console.warn('featured-courses container not found on this page. Skipping featured courses render.');
    return;
  }
  try {
    // Prefer cached API to reduce reads
    if (!window.DatabaseAPI) {
      console.log('DatabaseAPI not ready yet for featured courses');
      featuredCoursesContainer.innerHTML = '<p class="text-center text-gray-600">Loading featured courses...</p>';
      return;
    }

    console.log('Loading featured courses (cached if available)...');
    const courses = await window.DatabaseAPI.getFeaturedCourses();

    console.log('Featured courses loaded:', courses.length);
    
    if (courses.length > 0) {
      featuredCoursesContainer.innerHTML = courses.map(course => createFeaturedCourseCard(course)).join('');
    } else {
      featuredCoursesContainer.innerHTML = '<p class="text-center text-gray-600">No featured courses available at the moment.</p>';
    }
  } catch (error) {
    console.error('Error loading featured courses:', error);
    if (featuredCoursesContainer) {
      featuredCoursesContainer.innerHTML = '<p class="text-center text-red-600">Error loading featured courses.</p>';
    }
  }
}

// Create featured course card for homepage
function createFeaturedCourseCard(course) {
  const priceHTML = course.price === 0 
    ? '<span class="text-green-600 font-bold text-lg">Free</span>'
    : `<span class="text-blue-600 font-bold text-lg">${course.price}</span>`;
    
  const ratingHTML = generateStarRating(course.rating || 0);
  
  return `
    <div class="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
      <div class="relative">
        <img src="${course.image}" alt="${course.title}" class="w-full h-48 object-cover">
        <div class="absolute top-4 right-4">
          ${course.price === 0 ? '<span class="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold">FREE</span>' : '<span class="bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-semibold">PREMIUM</span>'}
        </div>
      </div>
      
      <div class="p-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-gray-500">${course.category || 'General'}</span>
          <span class="text-sm text-gray-500">${course.level || 'All Levels'}</span>
        </div>
        
        <h3 class="text-xl font-bold mb-2 text-gray-900">${course.title}</h3>
        <p class="text-gray-600 mb-4 line-clamp-2">${course.description || 'Course description not available'}</p>
        
        <div class="flex items-center mb-4">
          <div class="flex text-yellow-400 mr-2">${ratingHTML}</div>
          <span class="text-sm text-gray-600">${course.rating || '0.0'} (${course.reviews || 0})</span>
        </div>
        
        <div class="flex items-center justify-between">
          ${priceHTML}
          <a href="course-details.html?id=${course.id}" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
            Learn More
          </a>
        </div>
      </div>
    </div>
  `;
}

// Create course card HTML
function createCourseCard(course) {
    const priceHTML = course.price === 0 || course.price === '0' || course.price === 'Free'
        ? '<span class="text-green-600 font-bold text-lg">Free</span>'
        : `<span class="text-blue-600 font-bold text-lg">${course.price}</span>`;

    const ratingHTML = generateStarRating(course.rating || 4.5);
    const imageUrl = course.image || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=200&fit=crop';
    const isFree = course.price === 0 || course.price === '0' || (typeof course.price === 'string' && course.price.toLowerCase() === 'free');

    return `
        <div class="course-card bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300" data-course-id="${course.id}">
            <div class="relative overflow-hidden">
                <img src="${imageUrl}" alt="${course.title}" class="w-full h-48 object-cover transition-transform duration-300 hover:scale-110" onerror="this.src='https://via.placeholder.com/400x200/667eea/ffffff?text=${encodeURIComponent(course.title)}'">
                <div class="absolute top-4 right-4 bg-white bg-opacity-90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold text-gray-800">
                    ${course.price === 0 || course.price === '0' || course.price === 'Free' ? 'FREE' : `${course.price}`}
                </div>
                <div class="absolute top-4 left-4">
                    <span class="bg-${course.level === 'Beginner' ? 'green' : course.level === 'Intermediate' ? 'yellow' : 'red'}-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                        ${course.level || 'All Levels'}
                    </span>
                </div>
            </div>
            <div class="p-6">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm text-purple-600 font-medium">${course.category || 'General'}</span>
                    <span class="text-sm text-gray-500">${course.duration || '8 weeks'}</span>
                </div>

                <h3 class="text-xl font-bold text-gray-900 mb-2 line-clamp-2">${course.title}</h3>
                <p class="text-gray-600 mb-4 text-sm line-clamp-2">${course.description || 'Comprehensive course content designed to help you master new skills.'}</p>

                <div class="flex items-center mb-4">
                    <div class="flex text-yellow-400 mr-2">${ratingHTML}</div>
                    <span class="text-sm text-gray-600">${course.rating || '4.5'} (${course.reviews || course.students || '0'})</span>
                </div>

                <div class="flex items-center justify-between mb-4">
                    <div class="text-sm text-gray-600">
                        <span class="font-medium">${course.students || 0} students</span>
                    </div>
                    ${priceHTML}
                </div>

                <div class="flex gap-2">
                    <a href="course-details.html?id=${course.id}" class="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-semibold text-center text-sm">
                        View Details
                    </a>
                    ${isFree ? `<button onclick="homepage.enrollCourse('${course.id}')" class="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm">Enroll Free</button>` : ''}
                </div>
            </div>
        </div>
    `;
}

// Attach createCourseCard to window object
window.createCourseCard = createCourseCard;

// Generate star rating HTML
function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = (rating % 1) >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let starsHTML = '';

    for (let i = 0; i < fullStars; i++) {
        starsHTML += '<svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';
    }

    if (hasHalfStar) {
        starsHTML += '<svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><defs><linearGradient id="half"><stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="transparent"/></linearGradient></defs><path fill="url(#half)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';
    }

    for (let i = 0; i < emptyStars; i++) {
        starsHTML += '<svg class="w-4 h-4 text-gray-300 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';
    }

    return starsHTML;
}

// Smooth scrolling for anchor links
document.addEventListener('DOMContentLoaded', function() {
  const links = document.querySelectorAll('a[href^="#"]');
  
  links.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      const targetSection = document.querySelector(targetId);
      
      if (targetSection) {
        targetSection.scrollIntoView({
          behavior: 'smooth'
        });
      }
    });
  });
});

// Add animation classes on scroll
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animate-fade-in');
    }
  });
}, observerOptions);

// Observe elements for animations
document.addEventListener('DOMContentLoaded', function() {
  const animateElements = document.querySelectorAll('.course-card, .feature-card');
  animateElements.forEach(el => observer.observe(el));
});




// Enhanced Interactive JavaScript for SmartLearn
class EnhancedInteractions {
    constructor() {
        this.init();
    }

    init() {
        this.createCustomCursor();
        this.setupScrollAnimations();
        this.setupMagneticButtons();
        this.setupParallaxEffects();
        this.setupCardHoverEffects();
        this.setupNavigationEffects();
        this.setupLoadingAnimations();
        this.setupSmoothScrolling();
        this.setupGlitchEffects();
        this.setupFloatingElements();
    }

    // // Custom Cursor
    // createCustomCursor() {
    //     const cursor = document.createElement('div');
    //     cursor.className = 'cursor';
    //     document.body.appendChild(cursor);

    //     const cursorFollower = document.createElement('div');
    //     cursorFollower.className = 'cursor-follower';
    //     document.body.appendChild(cursorFollower);

    //     let mouseX = 0, mouseY = 0;
    //     let cursorX = 0, cursorY = 0;
    //     let followerX = 0, followerY = 0;

    //     document.addEventListener('mousemove', (e) => {
    //         mouseX = e.clientX;
    //         mouseY = e.clientY;
    //     });

    //     const animateCursor = () => {
    //         const distX = mouseX - cursorX;
    //         const distY = mouseY - cursorY;
            
    //         cursorX = cursorX + (distX * 0.3);
    //         cursorY = cursorY + (distY * 0.3);

    //         const distFollowerX = mouseX - followerX;
    //         const distFollowerY = mouseY - followerY;
            
    //         followerX = followerX + (distFollowerX * 0.1);
    //         followerY = followerY + (distFollowerY * 0.1);

    //         cursor.style.left = cursorX + 'px';
    //         cursor.style.top = cursorY + 'px';
    //         cursorFollower.style.left = followerX + 'px';
    //         cursorFollower.style.top = followerY + 'px';

    //         requestAnimationFrame(animateCursor);
    //     };

    //     animateCursor();

    //     // Cursor interactions
    //     const interactiveElements = document.querySelectorAll('a, button, .interactive, .card, .course-card');
        
    //     interactiveElements.forEach(el => {
    //         el.addEventListener('mouseenter', () => {
    //             cursor.style.transform = 'scale(1.5)';
    //             cursorFollower.style.transform = 'scale(1.5)';
    //             cursorFollower.style.border = '2px solid rgba(59, 130, 246, 0.6)';
    //         });

    //         el.addEventListener('mouseleave', () => {
    //             cursor.style.transform = 'scale(1)';
    //             cursorFollower.style.transform = 'scale(1)';
    //             cursorFollower.style.border = '2px solid rgba(59, 130, 246, 0.3)';
    //         });
    //     });

    //     // Hide cursor on touch devices
    //     document.addEventListener('touchstart', () => {
    //         cursor.style.display = 'none';
    //         cursorFollower.style.display = 'none';
    //     });
    // }

    // // Scroll Animations
    // setupScrollAnimations() {
    //     const observerOptions = {
    //         threshold: 0.1,
    //         rootMargin: '0px 0px -50px 0px'
    //     };

    //     const observer = new IntersectionObserver((entries) => {
    //         entries.forEach(entry => {
    //             if (entry.isIntersecting) {
    //                 entry.target.classList.add('revealed');
    //             }
    //         });
    //     }, observerOptions);

    //     // Add scroll-reveal class to elements
    //     const animateElements = document.querySelectorAll(
    //         '.card, .course-card, .feature-card, .stats-card, h1, h2, h3, .btn, .form-input'
    //     );

    //     animateElements.forEach((el, index) => {
    //         el.classList.add('scroll-reveal');
    //         el.style.transitionDelay = `${index * 0.1}s`;
    //         observer.observe(el);
    //     });

    //     // Navbar scroll effect
    //     let lastScrollY = window.scrollY;
    //     const navbar = document.querySelector('nav');

    //     window.addEventListener('scroll', () => {
    //         const currentScrollY = window.scrollY;
            
    //         if (currentScrollY > 100) {
    //             navbar.classList.add('scrolled');
    //         } else {
    //             navbar.classList.remove('scrolled');
    //         }

    //         if (currentScrollY > lastScrollY && currentScrollY > 200) {
    //             navbar.style.transform = 'translateY(-100%)';
    //         } else {
    //             navbar.style.transform = 'translateY(0)';
    //         }

    //         lastScrollY = currentScrollY;
    //     });
    // }

    // // Magnetic Button Effects
    // setupMagneticButtons() {
    //     const magneticElements = document.querySelectorAll('.btn, button, .magnetic');

    //     magneticElements.forEach(element => {
    //         element.addEventListener('mousemove', (e) => {
    //             const rect = element.getBoundingClientRect();
    //             const x = e.clientX - rect.left - rect.width / 2;
    //             const y = e.clientY - rect.top - rect.height / 2;
                
    //             const intensity = 0.3;
    //             element.style.transform = `translate(${x * intensity}px, ${y * intensity}px)`;
    //         });

    //         element.addEventListener('mouseleave', () => {
    //             element.style.transform = 'translate(0, 0)';
    //         });
    //     });
    // }

    // // Parallax Effects
    // setupParallaxEffects() {
    //     const parallaxElements = document.querySelectorAll('.parallax-bg');
        
    //     window.addEventListener('scroll', () => {
    //         const scrolled = window.pageYOffset;
            
    //         parallaxElements.forEach(element => {
    //             const rate = scrolled * -0.5;
    //             element.style.transform = `translate3d(0, ${rate}px, 0)`;
    //         });
    //     });

    //     // Floating elements
    //     const floatingElements = document.querySelectorAll('.animate-float');
    //     floatingElements.forEach((el, index) => {
    //         el.style.animationDelay = `${index * 0.5}s`;
    //     });
    // }

    // // Enhanced Card Hover Effects
    // setupCardHoverEffects() {
    //     const cards = document.querySelectorAll('.card, .course-card, .feature-card');

    //     cards.forEach(card => {
    //         card.addEventListener('mousemove', (e) => {
    //             const rect = card.getBoundingClientRect();
    //             const x = e.clientX - rect.left;
    //             const y = e.clientY - rect.top;
                
    //             const centerX = rect.width / 2;
    //             const centerY = rect.height / 2;
                
    //             const rotateX = (y - centerY) / 10;
    //             const rotateY = (centerX - x) / 10;
                
    //             card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(20px)`;
                
    //             // Create light effect
    //             const lightX = (x / rect.width) * 100;
    //             const lightY = (y / rect.height) * 100;
    //             card.style.background = `
    //                 radial-gradient(circle at ${lightX}% ${lightY}%, 
    //                 rgba(59, 130, 246, 0.1) 0%, 
    //                 transparent 50%), 
    //                 rgba(255, 255, 255, 0.9)
    //             `;
    //         });

    //         card.addEventListener('mouseleave', () => {
    //             card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
    //             card.style.background = '';
    //         });
    //     });
    // }

    // Navigation Effects
    setupNavigationEffects() {
        const navLinks = document.querySelectorAll('.nav-link, nav a');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // Create ripple effect
                this.createRipple(e, link);
            });
        });

        // Mobile menu animations
        const mobileToggle = document.querySelector('.mobile-menu-toggle');
        const mobileMenu = document.querySelector('.mobile-menu');
        
        if (mobileToggle && mobileMenu) {
            mobileToggle.addEventListener('click', () => {
                mobileMenu.classList.toggle('open');
                this.animateMobileMenu(mobileMenu);
            });
        }
    }

    // Loading Animations
    setupLoadingAnimations() {
        // Skeleton loading
        const loadingElements = document.querySelectorAll('.loading, .skeleton');
        
        loadingElements.forEach(element => {
            this.createSkeletonAnimation(element);
        });

        // Page load animation
        window.addEventListener('load', () => {
            this.pageLoadAnimation();
        });
    }

    // Smooth Scrolling
    setupSmoothScrolling() {
        const links = document.querySelectorAll('a[href^="#"]');
        
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                const targetId = link.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    const offsetTop = targetElement.offsetTop - 80;
                    
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // Glitch Effects
    setupGlitchEffects() {
        const glitchElements = document.querySelectorAll('.glitch-effect');
        
        glitchElements.forEach(element => {
            element.addEventListener('mouseenter', () => {
                this.createGlitchEffect(element);
            });
        });
    }

    // Floating Elements
    setupFloatingElements() {
        const floatingElements = document.querySelectorAll('.float-element');
        
        floatingElements.forEach((element, index) => {
            const amplitude = Math.random() * 20 + 10;
            const frequency = Math.random() * 0.02 + 0.01;
            const phase = Math.random() * Math.PI * 2;
            
            let time = 0;
            
            const animate = () => {
                time += frequency;
                const y = Math.sin(time + phase) * amplitude;
                element.style.transform = `translateY(${y}px)`;
                requestAnimationFrame(animate);
            };
            
            setTimeout(() => animate(), index * 200);
        });
    }

    // Helper Functions
    createRipple(event, element) {
        const ripple = document.createElement('span');
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(59, 130, 246, 0.3);
            transform: scale(0);
            left: ${x}px;
            top: ${y}px;
            width: ${size}px;
            height: ${size}px;
            pointer-events: none;
            animation: ripple 0.6s ease-out;
        `;
        
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    createSkeletonAnimation(element) {
        element.style.backgroundImage = `
            linear-gradient(90deg, 
                #f0f0f0 25%, 
                #e0e0e0 50%, 
                #f0f0f0 75%
            )
        `;
        element.style.backgroundSize = '200% 100%';
        element.style.animation = 'loading 1.5s infinite';
    }

    createGlitchEffect(element) {
        const originalText = element.textContent;
        const glitchChars = '!<>-_\\/[]{}—=+*^?#________';
        
        let iteration = 0;
        const maxIterations = 10;
        
        const glitchInterval = setInterval(() => {
            element.textContent = originalText
                .split('')
                .map((char, index) => {
                    if (index < iteration) {
                        return originalText[index];
                    }
                    return glitchChars[Math.floor(Math.random() * glitchChars.length)];
                })
                .join('');
            
            if (iteration >= originalText.length) {
                clearInterval(glitchInterval);
                element.textContent = originalText;
            }
            
            iteration += 1 / 3;
        }, 30);
    }

    pageLoadAnimation() {
        const elements = document.querySelectorAll('main > *');
        
        elements.forEach((element, index) => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(50px)';
            
            setTimeout(() => {
                element.style.transition = 'all 0.6s ease';
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    animateMobileMenu(menu) {
        const menuItems = menu.querySelectorAll('a');
        
        menuItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateX(-50px)';
            
            setTimeout(() => {
                item.style.transition = 'all 0.3s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateX(0)';
            }, index * 100);
        });
    }

    // Notification System
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="flex items-center space-x-3 p-4">
                <div class="flex-shrink-0">
                    ${this.getNotificationIcon(type)}
                </div>
                <div class="flex-1">
                    <p class="text-sm font-medium">${message}</p>
                </div>
                <button class="flex-shrink-0 text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.remove()">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 400px;
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Auto remove
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                notification.remove();
            }, 400);
        }, duration);
    }

    getNotificationIcon(type) {
        const icons = {
            success: '<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414L10 11.414l4.293 4.293a1 1 0 001.414-1.414L11.414 10l4.293-4.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>',
            error: '<svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>',
            info: '<svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>',
            warning: '<svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>'
        };
        return icons[type] || icons.info;
    }

    // Particle System
    createParticles(container, count = 50) {
        const particles = [];
        
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.cssText = `
                position: absolute;
                width: 2px;
                height: 2px;
                background: rgba(59, 130, 246, 0.6);
                border-radius: 50%;
                pointer-events: none;
            `;
            
            container.appendChild(particle);
            
            particles.push({
                element: particle,
                x: Math.random() * container.offsetWidth,
                y: Math.random() * container.offsetHeight,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: Math.random() * 100
            });
        }
        
        const animateParticles = () => {
            particles.forEach(particle => {
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.life--;
                
                if (particle.life <= 0 || 
                    particle.x < 0 || 
                    particle.x > container.offsetWidth ||
                    particle.y < 0 || 
                    particle.y > container.offsetHeight) {
                    
                    particle.x = Math.random() * container.offsetWidth;
                    particle.y = Math.random() * container.offsetHeight;
                    particle.life = Math.random() * 100;
                }
                
                particle.element.style.left = particle.x + 'px';
                particle.element.style.top = particle.y + 'px';
                particle.element.style.opacity = particle.life / 100;
            });
            
            requestAnimationFrame(animateParticles);
        };
        
        animateParticles();
    }

    // Form Enhancement
    enhanceforms() {
        const inputs = document.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                input.classList.add('form-input');
                this.createInputRipple(input);
            });
            
            input.addEventListener('blur', () => {
                if (!input.value) {
                    input.classList.remove('filled');
                } else {
                    input.classList.add('filled');
                }
            });
        });
    }

    createInputRipple(input) {
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent);
            transform: translateX(-100%);
            animation: inputRipple 0.6s ease;
            pointer-events: none;
        `;
        
        input.style.position = 'relative';
        input.parentElement.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    // Initialize everything
    static init() {
        document.addEventListener('DOMContentLoaded', () => {
            new EnhancedInteractions();
        });
    }
}

// Add required CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    @keyframes inputRipple {
        to {
            transform: translateX(100%);
        }
    }
    
    @keyframes loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }
    
    .particle {
        z-index: 1;
    }
    
    .notification {
        transform: translateX(100%);
        transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .notification.show {
        transform: translateX(0);
    }
`;
document.head.appendChild(style);

// Initialize the enhanced interactions
EnhancedInteractions.init();

// Export for global use
window.EnhancedInteractions = EnhancedInteractions;
