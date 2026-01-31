// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCVRlmw3-PCtGd5s3R-a0fJQsBF1YjPRWI",
    authDomain: "uplodify-9eb07.firebaseapp.com",
    databaseURL: "https://uplodify-9eb07-default-rtdb.firebaseio.com",
    projectId: "uplodify-9eb07",
    storageBucket: "uplodify-9eb07.firebasestorage.app",
    messagingSenderId: "158848017856",
    appId: "1:158848017856:web:94aaaf14320490d52a5425",
    measurementId: "G-1PLGMECD19"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Global Variables
let currentUser = null;
let userData = null;
let timerInterval = null;
let timeLeft = 120; // 2 minutes in seconds
let timerActive = false;
let activityDetected = false;
let lastActivityTime = Date.now();

// DOM Elements
const screens = {
    loading: document.getElementById('loading-screen'),
    auth: document.getElementById('auth-screen'),
    app: document.getElementById('app-container')
};

const authForms = {
    login: document.getElementById('login-form'),
    register: document.getElementById('register-form')
};

const buttons = {
    login: document.getElementById('login-btn'),
    register: document.getElementById('register-btn'),
    logout: document.getElementById('logout-btn'),
    checkin: document.getElementById('checkin-btn'),
    closeCheckin: document.getElementById('close-checkin-btn'),
    connect: document.getElementById('connect-btn'),
    copyReferral: document.getElementById('copy-referral-btn'),
    copyLink: document.getElementById('copy-link-btn'),
    submitReward: document.getElementById('submit-reward-btn'),
    resetTimer: document.getElementById('reset-timer-btn'),
    refreshData: document.getElementById('refresh-data-btn')
};

const modals = {
    checkin: document.getElementById('checkin-modal'),
    contact: document.getElementById('contact-modal')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    checkAuthState();
    setupScrollAnimations();
    setupActivityDetection();
});

// Event Listeners
function initializeEventListeners() {
    // Auth Tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchAuthTab(tabName);
        });
    });

    // Auth Buttons
    buttons.login.addEventListener('click', handleLogin);
    buttons.register.addEventListener('click', handleRegister);
    buttons.logout.addEventListener('click', handleLogout);

    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            switchSection(link.dataset.section);
        });
    });

    // Check-in Button
    buttons.checkin.addEventListener('click', () => {
        openCheckinModal();
    });

    // Close Check-in Button
    buttons.closeCheckin.addEventListener('click', completeCheckin);

    // Connect Button
    buttons.connect.addEventListener('click', () => {
        modals.contact.classList.add('active');
    });

    // Close Contact Modal
    document.getElementById('close-contact-btn').addEventListener('click', () => {
        modals.contact.classList.remove('active');
    });

    // Copy Referral Code
    buttons.copyReferral.addEventListener('click', copyReferralCode);

    // Copy Referral Link
    buttons.copyLink.addEventListener('click', copyReferralLink);

    // Submit Reward Request
    if (buttons.submitReward) {
        buttons.submitReward.addEventListener('click', handleRewardRequest);
    }

    // Reset Timer
    if (buttons.resetTimer) {
        buttons.resetTimer.addEventListener('click', resetDailyTimer);
    }

    // Refresh Data
    if (buttons.refreshData) {
        buttons.refreshData.addEventListener('click', refreshUserData);
    }

    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Add email link functionality
    document.querySelector('.contact-email a').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'mailto:gotmprajapat00@gmail.com';
    });
}

// Auth State Check
function checkAuthState() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            loadUserData();
        } else {
            showScreen('auth');
        }
    });
}

// Switch Auth Tab
function switchAuthTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.toggle('active', form.id === `${tabName}-form`);
    });
}

// Handle Login
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorElement = document.getElementById('login-error');

    if (!email || !password) {
        errorElement.textContent = 'Please enter both email and password';
        return;
    }

    try {
        buttons.login.disabled = true;
        buttons.login.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        
        await auth.signInWithEmailAndPassword(email, password);
        errorElement.textContent = '';
    } catch (error) {
        errorElement.textContent = getErrorMessage(error);
        buttons.login.disabled = false;
        buttons.login.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    }
}

// Handle Register
async function handleRegister() {
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const referralCode = document.getElementById('referral-code').value;
    const errorElement = document.getElementById('register-error');

    if (!email || !password) {
        errorElement.textContent = 'Please enter both email and password';
        return;
    }

    if (password.length < 6) {
        errorElement.textContent = 'Password must be at least 6 characters';
        return;
    }

    try {
        buttons.register.disabled = true;
        buttons.register.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Generate referral code
        const userReferralCode = generateReferralCode();
        
        // Prepare user data
        const userData = {
            email: email,
            points: 0,
            activeDays: 0,
            lastCheckIn: null,
            rewardStatus: 'NOT_ELIGIBLE',
            rewardRequestDate: null,
            upi: null,
            referralCode: userReferralCode,
            referredBy: referralCode || null,
            referralRewarded: false,
            joinDate: new Date().toISOString(),
            referrals: 0,
            referralPoints: 0
        };

        // Save user data to database
        await database.ref(`users/${user.uid}`).set(userData);
        
        // If referral code was used, update referrer's data
        if (referralCode) {
            await handleReferralSignup(referralCode, user.uid);
        }
        
        errorElement.textContent = '';
    } catch (error) {
        errorElement.textContent = getErrorMessage(error);
        buttons.register.disabled = false;
        buttons.register.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
    }
}

// Handle Logout
async function handleLogout() {
    try {
        await auth.signOut();
        currentUser = null;
        userData = null;
        stopTimer();
        showScreen('auth');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Load User Data
async function loadUserData() {
    if (!currentUser) return;

    try {
        const snapshot = await database.ref(`users/${currentUser.uid}`).once('value');
        userData = snapshot.val();
        
        if (!userData) {
            // Create user data if it doesn't exist
            const userReferralCode = generateReferralCode();
            userData = {
                email: currentUser.email,
                points: 0,
                activeDays: 0,
                lastCheckIn: null,
                rewardStatus: 'NOT_ELIGIBLE',
                rewardRequestDate: null,
                upi: null,
                referralCode: userReferralCode,
                referredBy: null,
                referralRewarded: false,
                joinDate: new Date().toISOString(),
                referrals: 0,
                referralPoints: 0
            };
            
            await database.ref(`users/${currentUser.uid}`).set(userData);
        }
        
        updateUI();
        showScreen('app');
        
        // Check if user can check in today
        checkDailyCheckin();
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Update UI with User Data
function updateUI() {
    if (!userData) return;

    // Update points display
    document.getElementById('points-display').textContent = userData.points || 0;
    
    // Update streak and active days
    document.getElementById('streak-count').textContent = calculateStreak();
    document.getElementById('active-days').textContent = userData.activeDays || 0;
    document.getElementById('days-left').textContent = Math.max(0, 30 - (userData.activeDays || 0));
    
    // Update profile section
    document.getElementById('user-email').textContent = userData.email;
    document.getElementById('profile-active-days').textContent = `${userData.activeDays || 0} days`;
    document.getElementById('profile-streak').textContent = `${calculateStreak()} days`;
    document.getElementById('profile-points').textContent = `${userData.points || 0} points`;
    document.getElementById('profile-reward-status').textContent = getRewardStatusText(userData.rewardStatus);
    
    // Update join date
    if (userData.joinDate) {
        const joinDate = new Date(userData.joinDate);
        document.getElementById('join-date').textContent = joinDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    // Update referral section
    document.getElementById('referral-code-display').textContent = userData.referralCode || 'CK30-' + generateRandomCode(6);
    document.getElementById('referrals-count').textContent = userData.referrals || 0;
    document.getElementById('referral-points').textContent = userData.referralPoints || 0;
    document.getElementById('referral-link').value = `${window.location.origin}?ref=${userData.referralCode}`;
    
    // Update rewards section
    updateRewardsSection();
}

// Calculate Streak
function calculateStreak() {
    if (!userData || !userData.lastCheckIn) return 0;
    
    const lastCheckIn = new Date(userData.lastCheckIn);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Reset streak if last check-in was more than 2 days ago
    if (lastCheckIn.toDateString() === today.toDateString()) {
        // Already checked in today
        return userData.streak || 1;
    } else if (lastCheckIn.toDateString() === yesterday.toDateString()) {
        // Checked in yesterday - continue streak
        return (userData.streak || 1) + 1;
    } else {
        // Streak broken
        return 1;
    }
}

// Check Daily Check-in
function checkDailyCheckin() {
    if (!userData || !userData.lastCheckIn) {
        // First time user
        startTimer();
        return;
    }
    
    const lastCheckIn = new Date(userData.lastCheckIn);
    const today = new Date();
    
    // Check if already checked in today
    if (lastCheckIn.toDateString() === today.toDateString()) {
        updateCheckinButton(true);
        return;
    }
    
    // Check if streak is broken
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (lastCheckIn.toDateString() === yesterday.toDateString()) {
        // Continue streak - start timer
        startTimer();
    } else {
        // Streak broken - reset streak and start timer
        startTimer();
        resetStreak();
    }
}

// Start Timer
function startTimer() {
    if (timerActive) return;
    
    timerActive = true;
    timeLeft = 120; // 2 minutes
    
    // Update timer display
    updateTimerDisplay();
    
    // Start countdown
    timerInterval = setInterval(() => {
        if (activityDetected) {
            timeLeft--;
            
            if (timeLeft <= 0) {
                stopTimer();
                unlockCheckinButton();
            } else {
                updateTimerDisplay();
            }
        } else {
            // Pause timer if no activity
            document.getElementById('timer-message').textContent = '⏳ Timer paused - move mouse or scroll to continue';
        }
    }, 1000);
    
    // Update last activity time
    updateActivityTime();
}

// Stop Timer
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerActive = false;
}

// Update Timer Display
function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    
    document.getElementById('timer-text').textContent = `${minutes}:${seconds.toString().padStart(2, '0')} / 2:00`;
    
    // Update progress bar
    const progress = ((120 - timeLeft) / 120) * 100;
    document.getElementById('timer-bar').style.width = `${progress}%`;
    
    // Update message
    if (timeLeft > 0) {
        document.getElementById('timer-message').textContent = `⏳ Please explore the website to unlock daily check-in (${minutes}:${seconds.toString().padStart(2, '0')} left)`;
    }
}

// Setup Activity Detection
function setupActivityDetection() {
    // Mouse movement
    document.addEventListener('mousemove', () => {
        activityDetected = true;
        updateActivityTime();
    });
    
    // Touch events
    document.addEventListener('touchstart', () => {
        activityDetected = true;
        updateActivityTime();
    });
    
    // Scroll events
    document.addEventListener('scroll', () => {
        activityDetected = true;
        updateActivityTime();
    });
    
    // Click events
    document.addEventListener('click', () => {
        activityDetected = true;
        updateActivityTime();
    });
    
    // Keyboard events
    document.addEventListener('keydown', () => {
        activityDetected = true;
        updateActivityTime();
    });
}

// Update Activity Time
function updateActivityTime() {
    lastActivityTime = Date.now();
    
    // Check for inactivity every 10 seconds
    setInterval(() => {
        const inactiveTime = Date.now() - lastActivityTime;
        if (inactiveTime > 10000) { // 10 seconds of inactivity
            activityDetected = false;
        }
    }, 10000);
}

// Unlock Check-in Button
function unlockCheckinButton() {
    updateCheckinButton(false);
    document.getElementById('timer-message').textContent = '✅ Daily Check-in Available';
    buttons.checkin.disabled = false;
    buttons.checkin.innerHTML = '<i class="fas fa-check-circle"></i> Daily Check-in Available';
}

// Update Check-in Button
function updateCheckinButton(completed) {
    if (completed) {
        buttons.checkin.disabled = true;
        buttons.checkin.innerHTML = '<i class="fas fa-check"></i> Already Checked-in Today';
        document.getElementById('timer-message').textContent = '✅ Daily check-in completed';
    } else if (timerActive) {
        buttons.checkin.disabled = true;
        buttons.checkin.innerHTML = '<i class="fas fa-clock"></i> Timer Running...';
    }
}

// Open Check-in Modal
function openCheckinModal() {
    modals.checkin.classList.add('active');
    
    // Enable close button after 5 seconds
    setTimeout(() => {
        buttons.closeCheckin.disabled = false;
        buttons.closeCheckin.innerHTML = '<i class="fas fa-times"></i> Close & Complete Check-in';
    }, 5000);
}

// Complete Check-in
async function completeCheckin() {
    try {
        if (!currentUser || !userData) return;
        
        const today = new Date();
        const lastCheckIn = userData.lastCheckIn ? new Date(userData.lastCheckIn) : null;
        
        // Check if already checked in today
        if (lastCheckIn && lastCheckIn.toDateString() === today.toDateString()) {
            alert('You have already checked in today!');
            modals.checkin.classList.remove('active');
            return;
        }
        
        // Calculate points (10 points per check-in)
        const pointsEarned = 10;
        const newPoints = (userData.points || 0) + pointsEarned;
        
        // Calculate streak
        let streak = calculateStreak();
        if (lastCheckIn) {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (lastCheckIn.toDateString() === yesterday.toDateString()) {
                streak++;
            } else {
                streak = 1;
            }
        } else {
            streak = 1;
        }
        
        // Update user data
        const updates = {
            lastCheckIn: today.toISOString(),
            activeDays: (userData.activeDays || 0) + 1,
            points: newPoints,
            streak: streak
        };
        
        await database.ref(`users/${currentUser.uid}`).update(updates);
        
        // Update local userData
        Object.assign(userData, updates);
        
        // Add points history
        await addPointsHistory(pointsEarned, 'Daily check-in');
        
        // Check for referral rewards
        await checkReferralRewards();
        
        // Update UI
        updateUI();
        
        // Show success message
        alert(`✅ Daily check-in completed! +${pointsEarned} points earned.`);
        
        // Close modal
        modals.checkin.classList.remove('active');
        
        // Update check-in button
        updateCheckinButton(true);
        
        // Reset timer for next day
        stopTimer();
        
    } catch (error) {
        console.error('Error completing check-in:', error);
        alert('Error completing check-in. Please try again.');
    }
}

// Reset Streak
async function resetStreak() {
    if (!currentUser) return;
    
    try {
        await database.ref(`users/${currentUser.uid}/streak`).set(1);
        if (userData) {
            userData.streak = 1;
        }
    } catch (error) {
        console.error('Error resetting streak:', error);
    }
}

// Add Points History
async function addPointsHistory(points, reason) {
    if (!currentUser) return;
    
    try {
        const historyRef = database.ref(`users/${currentUser.uid}/pointsHistory`).push();
        await historyRef.set({
            points: points,
            reason: reason,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error adding points history:', error);
    }
}

// Check Referral Rewards
async function checkReferralRewards() {
    if (!currentUser || !userData || !userData.referredBy) return;
    
    try {
        // Find referrer by referral code
        const usersSnapshot = await database.ref('users').once('value');
        let referrerId = null;
        
        usersSnapshot.forEach((childSnapshot) => {
            const user = childSnapshot.val();
            if (user.referralCode === userData.referredBy) {
                referrerId = childSnapshot.key;
            }
        });
        
        if (!referrerId) return;
        
        // Get referrer's data
        const referrerSnapshot = await database.ref(`users/${referrerId}`).once('value');
        const referrerData = referrerSnapshot.val();
        
        if (!referrerData) return;
        
        // Check if referral already rewarded
        if (userData.referralRewarded) return;
        
        // Check if user has completed 3 check-ins
        if ((userData.activeDays || 0) >= 3) {
            // Check monthly limit
            const currentMonth = new Date().getMonth();
            const lastRewardMonth = referrerData.lastReferralRewardMonth;
            
            if (lastRewardMonth === currentMonth && (referrerData.monthlyReferrals || 0) >= 5) {
                return; // Monthly limit reached
            }
            
            // Award referral points
            const referralPoints = 5;
            const newReferrerPoints = (referrerData.points || 0) + referralPoints;
            const newReferrals = (referrerData.referrals || 0) + 1;
            const newMonthlyReferrals = (referrerData.monthlyReferrals || 0) + 1;
            
            // Update referrer's data
            await database.ref(`users/${referrerId}`).update({
                points: newReferrerPoints,
                referrals: newReferrals,
                monthlyReferrals: newMonthlyReferrals,
                lastReferralRewardMonth: currentMonth,
                referralPoints: (referrerData.referralPoints || 0) + referralPoints
            });
            
            // Update current user's data
            await database.ref(`users/${currentUser.uid}`).update({
                referralRewarded: true
            });
            
            // Add points history for referrer
            const referrerHistoryRef = database.ref(`users/${referrerId}/pointsHistory`).push();
            await referrerHistoryRef.set({
                points: referralPoints,
                reason: `Referral bonus - ${userData.email}`,
                timestamp: new Date().toISOString()
            });
            
            // Update local userData if referrer is current user
            if (referrerId === currentUser.uid && userData) {
                userData.points = newReferrerPoints;
                userData.referrals = newReferrals;
                userData.referralPoints = (userData.referralPoints || 0) + referralPoints;
                updateUI();
            }
        }
    } catch (error) {
        console.error('Error checking referral rewards:', error);
    }
}

// Update Rewards Section
function updateRewardsSection() {
    if (!userData) return;
    
    const progressDays = userData.activeDays || 0;
    const progressPercent = Math.min(100, (progressDays / 30) * 100);
    
    document.getElementById('progress-days').textContent = progressDays;
    document.getElementById('progress-percent').textContent = `${Math.round(progressPercent)}%`;
    document.getElementById('reward-progress').style.width = `${progressPercent}%`;
    
    const statusDisplay = document.getElementById('reward-status-display');
    const requestForm = document.getElementById('reward-request-form');
    
    let statusHTML = '';
    
    switch (userData.rewardStatus) {
        case 'NOT_ELIGIBLE':
            if (progressDays < 30) {
                statusHTML = `
                    <div class="status-message status-not-eligible">
                        <i class="fas fa-clock"></i>
                        <p>Complete ${30 - progressDays} more days to become eligible for reward.</p>
                    </div>
                `;
            } else {
                statusHTML = `
                    <div class="status-message status-success">
                        <i class="fas fa-check-circle"></i>
                        <p>Congratulations! You're eligible for reward. Click the button below to request.</p>
                        <button id="request-reward-btn" class="btn btn-primary" style="margin-top: 15px;">
                            <i class="fas fa-gift"></i> Request Reward
                        </button>
                    </div>
                `;
                
                // Add event listener to the new button
                setTimeout(() => {
                    document.getElementById('request-reward-btn')?.addEventListener('click', () => {
                        requestForm.style.display = 'block';
                    });
                }, 100);
            }
            requestForm.style.display = 'none';
            break;
            
        case 'PENDING':
            const requestDate = new Date(userData.rewardRequestDate);
            const deliveryDate = new Date(requestDate);
            deliveryDate.setDate(deliveryDate.getDate() + 3);
            
            statusHTML = `
                <div class="status-message status-pending">
                    <i class="fas fa-hourglass-half"></i>
                    <p>Reward request sent on ${requestDate.toLocaleDateString()}.<br>
                    Reward will be sent by ${deliveryDate.toLocaleDateString()}.</p>
                </div>
            `;
            requestForm.style.display = 'none';
            break;
            
        case 'COMPLETED':
            statusHTML = `
                <div class="status-message status-success">
                    <i class="fas fa-trophy"></i>
                    <p>🎉 Reward sent successfully to ${userData.upi || 'your UPI ID'}.</p>
                </div>
            `;
            requestForm.style.display = 'none';
            break;
    }
    
    statusDisplay.innerHTML = statusHTML;
    
    // Update points history
    updatePointsHistory();
}

// Update Points History
async function updatePointsHistory() {
    if (!currentUser) return;
    
    try {
        const historySnapshot = await database.ref(`users/${currentUser.uid}/pointsHistory`).once('value');
        const historyList = document.getElementById('points-history-list');
        
        if (!historySnapshot.exists()) {
            historyList.innerHTML = '<p class="no-history">No points history yet.</p>';
            return;
        }
        
        let historyHTML = '';
        const historyArray = [];
        
        historySnapshot.forEach((childSnapshot) => {
            historyArray.push(childSnapshot.val());
        });
        
        // Sort by timestamp (newest first)
        historyArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Show last 10 entries
        historyArray.slice(0, 10).forEach(entry => {
            const date = new Date(entry.timestamp);
            historyHTML += `
                <div class="points-item">
                    <div>
                        <strong>${entry.reason}</strong>
                        <small>${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                    </div>
                    <span class="points-change ${entry.points > 0 ? 'positive' : 'negative'}">
                        ${entry.points > 0 ? '+' : ''}${entry.points} points
                    </span>
                </div>
            `;
        });
        
        historyList.innerHTML = historyHTML;
    } catch (error) {
        console.error('Error loading points history:', error);
    }
}

// Handle Reward Request
async function handleRewardRequest() {
    const upiId = document.getElementById('upi-id').value;
    
    if (!upiId) {
        alert('Please enter your UPI ID');
        return;
    }
    
    // Simple UPI validation
    if (!upiId.includes('@')) {
        alert('Please enter a valid UPI ID (e.g., name@upi)');
        return;
    }
    
    if (!currentUser || !userData) return;
    
    // Check if eligible
    if (userData.activeDays < 30) {
        alert('You need to complete 30 active days to request reward.');
        return;
    }
    
    // Check if already requested
    if (userData.rewardStatus === 'PENDING' || userData.rewardStatus === 'COMPLETED') {
        alert('You have already requested or received your reward.');
        return;
    }
    
    try {
        buttons.submitReward.disabled = true;
        buttons.submitReward.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        // Deduct points (100 points for reward)
        const pointsDeducted = 100;
        const newPoints = Math.max(0, (userData.points || 0) - pointsDeducted);
        
        // Update user data
        const updates = {
            rewardStatus: 'PENDING',
            rewardRequestDate: new Date().toISOString(),
            upi: upiId,
            points: newPoints
        };
        
        await database.ref(`users/${currentUser.uid}`).update(updates);
        
        // Update local userData
        Object.assign(userData, updates);
        
        // Add points history
        await addPointsHistory(-pointsDeducted, 'Reward request processing fee');
        
        // Update UI
        updateUI();
        
        alert('✅ Reward request submitted successfully! Reward will be sent within 3 days.');
        
        // Hide form
        document.getElementById('reward-request-form').style.display = 'none';
        
    } catch (error) {
        console.error('Error submitting reward request:', error);
        alert('Error submitting request. Please try again.');
    } finally {
        buttons.submitReward.disabled = false;
        buttons.submitReward.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Reward Request';
    }
}

// Copy Referral Code
function copyReferralCode() {
    const referralCode = document.getElementById('referral-code-display').textContent;
    copyToClipboard(referralCode);
    showToast('Referral code copied to clipboard!');
}

// Copy Referral Link
function copyReferralLink() {
    const referralLink = document.getElementById('referral-link').value;
    copyToClipboard(referralLink);
    showToast('Referral link copied to clipboard!');
}

// Copy to Clipboard
function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}

// Show Toast Notification
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #2ecc71;
        color: white;
        padding: 12px 24px;
        border-radius: 10px;
        z-index: 3000;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Switch Section
function switchSection(sectionId) {
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.section === sectionId);
    });
    
    // Update sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.toggle('active', section.id === `${sectionId}-section`);
    });
    
    // Scroll to top
    window.scrollTo(0, 0);
}

// Show Screen
function showScreen(screenName) {
    Object.keys(screens).forEach(key => {
        screens[key].classList.toggle('active', key === screenName);
    });
}

// Setup Scroll Animations
function setupScrollAnimations() {
    const fadeElements = document.querySelectorAll('.fade-in');
    const slideElements = document.querySelectorAll('.slide-up');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    fadeElements.forEach(el => observer.observe(el));
    slideElements.forEach(el => observer.observe(el));
}

// Generate Referral Code
function generateReferralCode() {
    const prefix = 'CK30-';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return prefix + code;
}

// Generate Random Code
function generateRandomCode(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return code;
}

// Handle Referral Signup
async function handleReferralSignup(referralCode, newUserId) {
    try {
        // Find user with this referral code
        const usersSnapshot = await database.ref('users').once('value');
        let referrerId = null;
        
        usersSnapshot.forEach((childSnapshot) => {
            const user = childSnapshot.val();
            if (user.referralCode === referralCode) {
                referrerId = childSnapshot.key;
            }
        });
        
        if (!referrerId) return;
        
        // Update new user's referredBy field
        await database.ref(`users/${newUserId}/referredBy`).set(referralCode);
        
    } catch (error) {
        console.error('Error handling referral signup:', error);
    }
}

// Get Reward Status Text
function getRewardStatusText(status) {
    switch (status) {
        case 'NOT_ELIGIBLE': return 'Not Eligible';
        case 'PENDING': return 'Processing';
        case 'COMPLETED': return 'Completed';
        default: return 'Not Eligible';
    }
}

// Get Error Message
function getErrorMessage(error) {
    switch (error.code) {
        case 'auth/email-already-in-use':
            return 'Email already registered';
        case 'auth/invalid-email':
            return 'Invalid email address';
        case 'auth/weak-password':
            return 'Password is too weak';
        case 'auth/wrong-password':
            return 'Incorrect password';
        case 'auth/user-not-found':
            return 'User not found';
        default:
            return error.message;
    }
}

// Reset Daily Timer
function resetDailyTimer() {
    if (confirm('Reset timer? This will restart the 2-minute wait period.')) {
        stopTimer();
        timeLeft = 120;
        updateTimerDisplay();
        updateCheckinButton(false);
        startTimer();
        showToast('Timer reset successfully!');
    }
}

// Refresh User Data
async function refreshUserData() {
    if (!currentUser) return;
    
    try {
        const snapshot = await database.ref(`users/${currentUser.uid}`).once('value');
        userData = snapshot.val();
        updateUI();
        showToast('Data refreshed successfully!');
    } catch (error) {
        console.error('Error refreshing data:', error);
        showToast('Error refreshing data');
    }
}

// Add CSS for toast animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .points-change.positive {
        color: #2ecc71;
        font-weight: bold;
    }
    
    .points-change.negative {
        color: #e74c3c;
        font-weight: bold;
    }
    
    .no-history {
        text-align: center;
        color: #999;
        padding: 20px;
    }
`;
document.head.appendChild(style);

// Initialize with animations
setTimeout(() => {
    setupScrollAnimations();
}, 1000);
