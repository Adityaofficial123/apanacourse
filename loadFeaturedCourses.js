// Enhanced loadFeaturedCourses function with better error handling and fallback mechanisms.
export async function loadFeaturedCourses() {
    const featuredCoursesContainer = document.getElementById('featured-courses');
    const loadingContainer = document.getElementById('featured-loading');

    try {
        console.log('Loading featured courses from Firebase...');
        const courses = await window.DatabaseAPI.getFeaturedCourses();

        if (courses.length > 0) {
            featuredCoursesContainer.innerHTML = courses.map(course => window.createCourseCard(course)).join('');
            featuredCoursesContainer.classList.remove('hidden');
            loadingContainer.classList.add('hidden');
        } else {
            console.warn('No featured courses found. Loading first 3 courses as fallback.');
            const allCourses = await window.DatabaseAPI.getAllCourses();
            const firstThree = allCourses.slice(0, 3);
            featuredCoursesContainer.innerHTML = firstThree.map(course => window.createCourseCard(course)).join('');
            featuredCoursesContainer.classList.remove('hidden');
            loadingContainer.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error loading featured courses:', error);
        loadingContainer.innerHTML = '<p class="text-red-500">Failed to load courses. Please try again later.</p>';
    }
}
