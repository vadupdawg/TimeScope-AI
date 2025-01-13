// State management
let tracking = false;
let screenshotInterval;

// DOM Elements
const loginButton = document.getElementById('loginButton');
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');
const logoutButton = document.getElementById('logoutButton');
const trackingControls = document.getElementById('trackingControls');
const startButton = document.getElementById('startTracking');
const stopButton = document.getElementById('stopTracking');
const trackingStatus = document.getElementById('trackingStatus');
const lastActivity = document.getElementById('lastActivity');
const captureInterval = document.getElementById('captureInterval');
const autoStart = document.getElementById('autoStart');

// Auth state observer
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        loginButton.parentElement.style.display = 'none';
        trackingControls.style.display = 'block';
        userInfo.style.display = 'flex';
        userName.textContent = user.displayName || user.email;
        
        // Load user settings
        loadUserSettings(user.uid);
        
        // Start tracking if autoStart is enabled
        if (autoStart.checked) {
            startTracking();
        }
    } else {
        loginButton.parentElement.style.display = 'block';
        trackingControls.style.display = 'none';
        userInfo.style.display = 'none';
        stopTracking();
    }
});

// Login/Logout handlers
loginButton.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider);
});

logoutButton.addEventListener('click', () => {
    firebase.auth().signOut();
});

// Login handlers
document.getElementById('googleLogin').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider);
});

document.getElementById('emailLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
    } catch (error) {
        showNotification('Login mislukt: ' + error.message, 'error');
    }
});

// Forgot password
document.getElementById('forgotPassword').addEventListener('click', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    
    if (!email) {
        showNotification('Vul eerst je email in', 'warning');
        return;
    }

    firebase.auth().sendPasswordResetEmail(email)
        .then(() => {
            showNotification('Reset link verzonden naar je email', 'success');
        })
        .catch((error) => {
            showNotification('Error: ' + error.message, 'error');
        });
});

// Register link - opent in browser
document.getElementById('registerLink').addEventListener('click', (e) => {
    e.preventDefault();
    // Check of we in Electron zijn
    if (window.electron) {
        window.electron.openExternal('https://timescope-ai.web.app/register');
    } else {
        window.open('https://timescope-ai.web.app/register', '_blank');
    }
});

// Capture screenshot using Electron
async function captureScreen() {
    try {
        // Gebruik de veilige electron bridge voor screenshots
        const screenshot = await window.electron.takeScreenshot();
        
        // Upload screenshot
        await uploadScreenshot(screenshot);
    } catch (err) {
        console.error('Error capturing screen:', err);
        showNotification('Error bij het maken van screenshot', 'error');
    }
}

// Upload screenshot naar backend
async function uploadScreenshot(screenshot) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const formData = new FormData();
    formData.append('screenshot', new Blob([screenshot], { type: 'image/png' }));
    formData.append('userId', user.uid);

    try {
        const token = await user.getIdToken();
        const response = await fetch(`${config.BASE_API_URL}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        lastActivity.innerHTML = `
            <strong>Laatste activiteit:</strong><br>
            ${data.activity}<br>
            <small>${new Date().toLocaleTimeString()}</small>
        `;
    } catch (err) {
        console.error('Error uploading screenshot:', err);
        showNotification('Error bij het uploaden van screenshot', 'error');
    }
}

// Start tracking
function startTracking() {
    tracking = true;
    startButton.style.display = 'none';
    stopButton.style.display = 'block';
    trackingStatus.className = 'status active';
    trackingStatus.innerHTML = `
        <div class="status-indicator"></div>
        <span>Tracking actief</span>
    `;
    
    const interval = captureInterval.value * 60 * 1000; // Convert to milliseconds
    screenshotInterval = setInterval(captureScreen, interval);
    captureScreen(); // Direct eerste screenshot
    
    // Save user settings
    saveUserSettings();
}

// Stop tracking
function stopTracking() {
    tracking = false;
    startButton.style.display = 'block';
    stopButton.style.display = 'none';
    trackingStatus.className = 'status inactive';
    trackingStatus.innerHTML = `
        <div class="status-indicator"></div>
        <span>Tracking inactief</span>
    `;
    
    clearInterval(screenshotInterval);
}

// Save user settings to Firestore
async function saveUserSettings() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const settings = {
        captureInterval: parseInt(captureInterval.value),
        autoStart: autoStart.checked
    };

    try {
        await firebase.firestore().collection('user_settings')
            .doc(user.uid)
            .set(settings);
        
        // Update auto-launch setting in Electron
        if (window.electron) {
            await window.electron.toggleAutoLaunch(settings.autoStart);
        }
    } catch (err) {
        console.error('Error saving settings:', err);
    }
}

// Load user settings from Firestore
async function loadUserSettings(userId) {
    try {
        const doc = await firebase.firestore()
            .collection('user_settings')
            .doc(userId)
            .get();

        if (doc.exists) {
            const settings = doc.data();
            captureInterval.value = settings.captureInterval || 5;
            autoStart.checked = settings.autoStart || false;
            
            // Update auto-launch setting in Electron
            if (window.electron) {
                await window.electron.toggleAutoLaunch(settings.autoStart);
            }
        }
    } catch (err) {
        console.error('Error loading settings:', err);
    }
}

// Event listeners
startButton.addEventListener('click', startTracking);
stopButton.addEventListener('click', stopTracking);
captureInterval.addEventListener('change', saveUserSettings);
autoStart.addEventListener('change', saveUserSettings);

// Handle system tray events (alleen in Electron)
if (window.electron) {
    window.electron.onStartTracking(() => {
        if (!tracking) startTracking();
    });
    
    window.electron.onStopTracking(() => {
        if (tracking) stopTracking();
    });
}

// Handle app closing
window.addEventListener('beforeunload', () => {
    if (tracking) {
        stopTracking();
    }
});

// Helper function voor notificaties
function showNotification(message, type = 'info') {
    // Implementeer een notificatie systeem
    console.log(`${type}: ${message}`);
}