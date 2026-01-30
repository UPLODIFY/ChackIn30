// App Configuration
const CONFIG = {
    DAILY_POINTS: 10,
    REQUIRED_DAYS: 30,
    TIMER_DURATION: 120, // seconds
    REWARD_POPUP_DELAY: 3600000, // 1 hour in milliseconds
    TELEGRAM_BOT_TOKEN: 'YOUR_BOT_TOKEN',
    TELEGRAM_CHAT_ID: 'YOUR_CHAT_ID',
    BANNER_ADS: {
        top: 'YOUR_TOP_BANNER_ID',
        mid: 'YOUR_MID_BANNER_ID',
        bottom: 'YOUR_BOTTOM_BANNER_ID'
    }
};

// State Management
let currentUser = null;
let userData = null;
let timerInterval = null;
let remainingTime = CONFIG.TIMER_DURATION;
let isTimerRunning = false;

// DOM Elements
const pageContainer = document.getElementById('page-container');
const navLinks = document.querySelector('.nav-links');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    loadBanners();
});

// Initialize Firebase Auth State Listener
function initApp() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            loadUserData();
            updateNavigation(true);
            showPage('dashboard');
        } else {
            currentUser = null;
            userData = null;
            updateNavigation(false);
            showPage('login');
        }
    });
}

// Update Navigation Based on Auth State
function updateNavigation(isLoggedIn) {
    const authLinks = document.querySelectorAll('.auth-link');
    const userLinks = document.querySelectorAll('.user-link');
    
    if (isLoggedIn) {
        authLinks.forEach(link => link.style.display = 'none');
        userLinks.forEach(link => link.style.display = 'flex');
    } else {
        authLinks.forEach(link => link.style.display = 'flex');
        userLinks.forEach(link => link.style.display = 'none');
    }
}

// Load User Data from Firebase
async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const userRef = database.ref('users/' + currentUser.uid);
        const snapshot = await userRef.once('value');
        
        if (snapshot.exists()) {
            userData = snapshot.val();
        } else {
            // Create new user data
            userData = {
                email: currentUser.email,
                points: 0,
                activeDays: 0,
                lastActivityDate: null,
                rewardRequested: false,
                rewardStatus: null,
                upiID: '',
                requestTime: null,
                createdAt: Date.now()
            };
            await userRef.set(userData);
        }
        
        // Check if reward popup should be shown
        checkRewardPopup();
        
        // Update UI
        updateUserStats();
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Page Navigation System
async function showPage(pageName) {
    // Clear current page
    pageContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Loading...</p>
        </div>
    `;
    
    // Load page content
    let html = '';
    switch(pageName) {
        case 'login':
            html = await loadLoginPage();
            break;
        case 'dashboard':
            html = await loadDashboardPage();
            break;
        case 'activity':
            html = await loadActivityPage();
            break;
        case 'completion':
            html = await loadCompletionPage();
            break;
        case 'reward':
            html = await loadRewardPage();
            break;
        case 'terms':
            html = await loadTermsPage();
            break;
        case 'privacy':
            html = await loadPrivacyPage();
            break;
        case 'disclaimer':
            html = await loadDisclaimerPage();
            break;
        default:
            html = await loadDashboardPage();
    }
    
    pageContainer.innerHTML = html;
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[onclick="showPage('${pageName}')"]`)?.classList.add('active');
    
    // Load banners for the page
    setTimeout(loadBanners, 100);
    
    // Initialize page-specific functionality
    initPage(pageName);
}

// Load Login Page
async function loadLoginPage() {
    return `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-header">
                    <div class="logo" style="justify-content: center; margin-bottom: 20px;">
                        <i class="fas fa-calendar-check"></i>
                        <span>CheckIn30</span>
                    </div>
                    <h1>Welcome Back</h1>
                    <p>Sign in to continue your daily check-in streak</p>
                </div>
                
                <div id="loginForm">
                    <div class="form-group">
                        <label class="form-label" for="email">Email</label>
                        <input type="email" id="email" class="form-input" placeholder="Enter your email" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="password">Password</label>
                        <input type="password" id="password" class="form-input" placeholder="Enter your password" required>
                    </div>
                    
                    <button onclick="loginWithEmail()" class="btn btn-primary btn-block">
                        <i class="fas fa-sign-in-alt"></i> Sign In
                    </button>
                    
                    <div class="divider">
                        <span>Or continue with</span>
                    </div>
                    
                    <button onclick="loginWithGoogle()" class="btn btn-google btn-block">
                        <i class="fab fa-google"></i> Google
                    </button>
                    
                    <div class="auth-footer">
                        <p>Don't have an account? <a href="#" onclick="showRegisterForm()">Sign up</a></p>
                    </div>
                </div>
                
                <div id="registerForm" style="display: none;">
                    <div class="form-group">
                        <label class="form-label" for="regEmail">Email</label>
                        <input type="email" id="regEmail" class="form-input" placeholder="Enter your email" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="regPassword">Password</label>
                        <input type="password" id="regPassword" class="form-input" placeholder="Create a password (min. 6 characters)" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="confirmPassword">Confirm Password</label>
                        <input type="password" id="confirmPassword" class="form-input" placeholder="Confirm your password" required>
                    </div>
                    
                    <button onclick="registerWithEmail()" class="btn btn-primary btn-block">
                        <i class="fas fa-user-plus"></i> Create Account
                    </button>
                    
                    <div class="auth-footer">
                        <p>Already have an account? <a href="#" onclick="showLoginForm()">Sign in</a></p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Load Dashboard Page
async function loadDashboardPage() {
    const progress = userData ? Math.min((userData.activeDays / CONFIG.REQUIRED_DAYS) * 100, 100) : 0;
    
    return `
        <div class="dashboard-container">
            <div class="banner-ad mid-banner">
                <div class="banner-content">
                    <div class="ad-placeholder">Mid-content Banner Ad</div>
                    <button class="close-ad" onclick="closeBanner('mid')">×</button>
                </div>
            </div>
            
            <h1 class="mb-20">Dashboard</h1>
            <p class="text-center mb-40">Track your daily progress and earn rewards</p>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <i class="fas fa-coins"></i>
                    <h3>${userData?.points || 0}</h3>
                    <p>Total Points</p>
                </div>
                
                <div class="stat-card">
                    <i class="fas fa-calendar-day"></i>
                    <h3>${userData?.activeDays || 0}/${CONFIG.REQUIRED_DAYS}</h3>
                    <p>Active Days</p>
                </div>
                
                <div class="stat-card">
                    <i class="fas fa-trophy"></i>
                    <h3>${userData?.rewardStatus || 'Not Eligible'}</h3>
                    <p>Reward Status</p>
                </div>
            </div>
            
            <div class="progress-section">
                <div class="progress-header">
                    <h2>30-Day Progress</h2>
                    <span class="status-badge ${userData?.rewardRequested ? 'pending' : ''}">
                        <i class="fas ${userData?.rewardRequested ? 'fa-clock' : 'fa-calendar-check'}"></i>
                        ${userData?.rewardRequested ? 'Reward Pending' : 'In Progress'}
                    </span>
                </div>
                
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${progress}%"></div>
                </div>
                
                <div class="progress-text">
                    <span>Start</span>
                    <span>${Math.round(progress)}% Complete</span>
                    <span>30 Days</span>
                </div>
            </div>
            
            ${userData?.rewardRequested ? `
            <div class="reward-status">
                <h3 class="mb-20">Reward Status</h3>
                <div class="status-badge ${userData.rewardStatus === 'SUCCESS' ? 'success' : 'pending'}">
                    <i class="fas ${userData.rewardStatus === 'SUCCESS' ? 'fa-check-circle' : 'fa-clock'}"></i>
                    ${userData.rewardStatus || 'PENDING'}
                </div>
                <p class="mt-20">Your reward will be sent within 3 working days.</p>
            </div>
            ` : ''}
            
            <div class="text-center mt-40">
                <button onclick="showPage('activity')" class="btn btn-primary btn-lg">
                    <i class="fas fa-play-circle"></i> Start Daily Activity
                </button>
            </div>
        </div>
    `;
}

// Load Activity Page
async function loadActivityPage() {
    const today = new Date().toDateString();
    const canStartActivity = !userData?.lastActivityDate || userData.lastActivityDate !== today;
    
    return `
        <div class="activity-container">
            <h1 class="mb-20">Daily Activity</h1>
            <p class="text-center mb-40">Complete your daily check-in to earn points</p>
            
            <div class="timer-card">
                <h2 class="mb-20">Daily Timer</h2>
                <p class="mb-20">Stay on this page for 2 minutes to complete today's activity</p>
                
                <div class="timer-progress">
                    <svg class="timer-circle" viewBox="0 0 100 100">
                        <circle class="timer-circle-bg" cx="50" cy="50" r="45"></circle>
                        <circle class="timer-circle-progress" cx="50" cy="50" r="45" 
                                stroke-dasharray="283" 
                                stroke-dashoffset="${283 - (283 * (remainingTime / CONFIG.TIMER_DURATION))}">
                        </circle>
                    </svg>
                    <div class="timer-display" id="timerDisplay">
                        ${formatTime(remainingTime)}
                    </div>
                </div>
                
                <div class="timer-instructions">
                    <h4 class="mb-10">Important Instructions:</h4>
                    <ul>
                        <li>Stay on this page until timer completes</li>
                        <li>Do not refresh or close the page</li>
                        <li>Points will be awarded automatically</li>
                        <li>Only one completion allowed per day</li>
                    </ul>
                </div>
                
                <button onclick="${canStartActivity ? 'startTimer()' : 'alert(\'You have already completed today\\'s activity!\')'}" 
                        class="btn btn-primary btn-block" 
                        ${!canStartActivity ? 'disabled' : ''}
                        id="startTimerBtn">
                    <i class="fas ${canStartActivity ? 'fa-play' : 'fa-check'}"></i>
                    ${canStartActivity ? 'Start Timer' : 'Already Completed Today'}
                </button>
            </div>
        </div>
    `;
}

// Load Completion Page
async function loadCompletionPage() {
    return `
        <div class="completion-container">
            <div class="banner-ad top-banner">
                <div class="banner-content">
                    <div class="ad-placeholder">Daily Completion Banner Ad</div>
                    <button class="close-ad" onclick="closeBanner('completion-top')">×</button>
                </div>
            </div>
            
            <div class="completion-card">
                <div class="completion-icon">
                    <i class="fas fa-trophy"></i>
                </div>
                
                <h2>Daily Check-In Complete! 🎉</h2>
                <p class="mt-20">Congratulations! You have successfully completed today's activity.</p>
                
                <div class="points-earned mt-20">
                    +${CONFIG.DAILY_POINTS} Points
                </div>
                
                <p class="mt-20">Your points have been added to your account.</p>
                
                <div class="mt-40">
                    <button onclick="showPage('dashboard')" class="btn btn-primary btn-block">
                        <i class="fas fa-arrow-left"></i> Return to Dashboard
                    </button>
                </div>
            </div>
            
            <div class="banner-ad bottom-banner">
                <div class="banner-content">
                    <div class="ad-placeholder">Completion Page Footer Ad</div>
                    <button class="close-ad" onclick="closeBanner('completion-bottom')">×</button>
                </div>
            </div>
        </div>
    `;
}

// Load Reward Page
async function loadRewardPage() {
    const canRequest = userData?.activeDays >= CONFIG.REQUIRED_DAYS && !userData?.rewardRequested;
    
    return `
        <div class="dashboard-container">
            <h1 class="mb-20">Reward Request</h1>
            
            ${!canRequest ? `
                <div class="reward-info">
                    <h3>Eligibility Requirements</h3>
                    <p>To request a reward, you need:</p>
                    <ul style="margin-left: 20px; margin-top: 10px;">
                        <li>Complete ${CONFIG.REQUIRED_DAYS} active days</li>
                        <li>Not have a pending reward request</li>
                    </ul>
                    <p class="mt-20">Your progress: ${userData?.activeDays || 0}/${CONFIG.REQUIRED_DAYS} days</p>
                </div>
            ` : `
                <div class="reward-form">
                    <div class="reward-info">
                        <h3>🎉 Congratulations!</h3>
                        <p>You have completed ${CONFIG.REQUIRED_DAYS} days of active participation.</p>
                        <p class="mt-10"><strong>Reward will be sent within 3 working days.</strong></p>
                    </div>
                    
                    <div class="disclaimer">
                        <p><strong>Note:</strong> Submitting a request does not guarantee the top reward.</p>
                        <p class="mt-10">All users may receive a discretionary bonus based on platform earnings.</p>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="emailField">Email Address</label>
                        <input type="email" id="emailField" class="form-input" value="${userData?.email || ''}" readonly>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="upiID">UPI ID</label>
                        <input type="text" id="upiID" class="form-input" placeholder="Enter your UPI ID (e.g., username@upi)" required>
                        <small style="color: var(--gray); margin-top: 5px; display: block;">Enter valid UPI ID to receive reward</small>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="pointsInfo">Points to be Deducted</label>
                        <input type="text" id="pointsInfo" class="form-input" value="50 points will be deducted" readonly>
                    </div>
                    
                    <button onclick="submitRewardRequest()" class="btn btn-success btn-block mt-20">
                        <i class="fas fa-paper-plane"></i> Submit Reward Request
                    </button>
                </div>
            `}
        </div>
    `;
}

// Load Legal Pages
async function loadTermsPage() {
    return `
        <div class="dashboard-container">
            <h1>Terms of Service</h1>
            <div class="reward-info mt-20">
                <h3>Last Updated: ${new Date().toLocaleDateString()}</h3>
                <p>By using CheckIn30, you agree to these terms:</p>
                <ul style="margin-left: 20px; margin-top: 10px;">
                    <li>Users must complete daily activities honestly</li>
                    <li>One account per user is allowed</li>
                    <li>Rewards are discretionary and not guaranteed</li>
                    <li>We reserve the right to suspend accounts for abuse</li>
                    <li>All decisions regarding rewards are final</li>
                </ul>
            </div>
        </div>
    `;
}

async function loadPrivacyPage() {
    return `
        <div class="dashboard-container">
            <h1>Privacy Policy</h1>
            <div class="reward-info mt-20">
                <h3>Data Collection and Usage</h3>
                <p>We collect and use your data as follows:</p>
                <ul style="margin-left: 20px; margin-top: 10px;">
                    <li>Email address for account identification</li>
                    <li>Activity data for progress tracking</li>
                    <li>UPI ID for reward distribution (when requested)</li>
                    <li>Data is stored securely in Firebase</li>
                    <li>We don't share your data with third parties</li>
                </ul>
            </div>
        </div>
    `;
}

async function loadDisclaimerPage() {
    return `
        <div class="dashboard-container">
            <h1>Disclaimer</h1>
            <div class="disclaimer mt-20" style="margin: 0;">
                <h3>Important Information</h3>
                <p><strong>CheckIn30 is an engagement tracking platform.</strong></p>
                <p class="mt-10">Rewards are discretionary and not guaranteed income.</p>
                <p class="mt-10">The platform is for entertainment and engagement purposes.</p>
             
