
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// State Management
let currentUser = null;
let currentTab = 'yt-watch';
let clickCounter = parseInt(localStorage.getItem('click_count') || '0');

// Initial Setup: Get/set Telegram User
async function initUser() {
    let tgId = localStorage.getItem('tg_id');
    let tgUsername = localStorage.getItem('tg_username');

    if (!tgId) {
        // Generate a unique ID for the user if not exists
        tgId = 'User_' + Date.now() + '_' + Math.floor(Math.random() * 99999);
        localStorage.setItem('tg_id', tgId);
    }

    if (!tgUsername) {
        // Prompt for username if not already set or not fetched from Firebase
        tgUsername = prompt("Please enter your Telegram username (e.g., @yourusername):");
        while (!tgUsername || tgUsername.trim() === '') {
            tgUsername = prompt("Telegram username cannot be empty. Please enter your Telegram username:");
        }
        if (!tgUsername.startsWith('@')) {
            tgUsername = '@' + tgUsername.trim();
        } else {
            tgUsername = tgUsername.trim();
        }
        localStorage.setItem('tg_username', tgUsername);
    }
    
    // Listen for changes to the user data in Firebase
    // This ensures real-time balance updates and user data synchronization
    onValue(ref(db, `users/${tgId}`), (snapshot) => {
        if (snapshot.exists()) {
            currentUser = snapshot.val();
            // Ensure username is consistent with what's stored locally
            if (currentUser.username !== tgUsername) {
                update(ref(db, `users/${tgId}`), { username: tgUsername });
                currentUser.username = tgUsername; // Update local state too
            }
        } else {
            // New user registration
            currentUser = {
                id: tgId,
                username: tgUsername,
                balance: 0,
                completed: {}, // Stores task IDs completed by this user
                freeLinksPosted: { 'yt-watch': 0, 'yt-sub': 0, 'fb-follow': 0, 'web-visit': 0, 'playstore': 0 }
            };
            set(ref(db, `users/${tgId}`), currentUser);
        }
        updateUI();
        // Initial render of the current tab after user data is fully loaded
        showTab(currentTab); 
    });
}

function updateUI() {
    if (!currentUser) return; // Wait for currentUser to be loaded
    document.getElementById('user-balance').innerText = currentUser.balance.toFixed(3);
    document.getElementById('display-username').innerText = currentUser.username || `@${currentUser.id}`;
    document.getElementById('user-uid').innerText = currentUser.id;
}

window.showTab = (tab) => {
    if (tab === 'add-link') {
        document.getElementById('link-modal').classList.remove('hidden');
        updateFreeLinksInfo(); // Update info when opening add link modal
        return;
    }
    
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
    document.getElementById(`btn-${tab}`).classList.add('active-tab');

    const container = document.getElementById('task-container');
    container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">Loading ${tab === 'my-links' ? 'your links' : 'tasks'}...</div>`;

    if (currentTab === 'my-links') {
        renderMyLinks();
    } else {
        renderTasks();
    }
};

const TASK_CONFIGS = {
    'yt-watch': { reward: 0.01, time: 30, freeLimit: 100, paidLimit: 550, title: "Watch Video", freePrice: 0, paidPrice: 5 },
    'yt-sub': { reward: 0.03, time: 30, freeLimit: 50, paidLimit: 260, title: "Subscribe Channel", freePrice: 0, paidPrice: 5 },
    'fb-follow': { reward: 0.01, time: 30, freeLimit: 100, paidLimit: 550, title: "Follow Page", freePrice: 0, paidPrice: 5 },
    'web-visit': { reward: 0.01, time: 15, freeLimit: 100, paidLimit: 550, title: "Visit Website", freePrice: 0, paidPrice: 5 },
    'playstore': { reward: 0.015, time: 20, freeLimit: 100, paidLimit: 550, title: "Install App", freePrice: 0, paidPrice: 5 },
    'admin': { reward: 0.03, time: 20, freeLimit: 10000, paidLimit: 10000, title: "Admin Task", freePrice: 0, paidPrice: 0 } // Admin tasks implicitly free for posting
};

function renderTasks() {
    const container = document.getElementById('task-container');
    container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">Loading links...</div>`;

    // Use onValue for real-time updates of available tasks
    onValue(ref(db, `links/${currentTab}`), (snapshot) => {
        container.innerHTML = ""; // Clear existing tasks before rendering
        const links = snapshot.val() || {};
        let foundTasks = false;

        Object.keys(links).forEach(key => {
            const task = links[key];
            // Hide if current user completed, or if max clicks reached by anyone
            const isCompletedByUser = currentUser.completed && currentUser.completed[key];
            const isMaxClicksReached = task.clicks >= task.maxClicks;

            if (!isCompletedByUser && !isMaxClicksReached) { 
                foundTasks = true;
                const card = document.createElement('div');
                card.className = "bg-gray-800 border border-gray-700 p-4 rounded-xl hover:border-yellow-500 transition cursor-pointer";
                card.onclick = () => startTask(key, task, currentTab);
                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <span class="bg-gray-700 text-[10px] px-2 py-1 rounded text-yellow-400 uppercase font-bold">${task.isFree ? 'Free Slot' : 'Paid Slot'}</span>
                        <span class="text-green-400 font-bold">₱${task.reward.toFixed(3)}</span>
                    </div>
                    <p class="text-sm text-gray-300 truncate mb-4">${task.url}</p>
                    <div class="flex justify-between items-center text-xs text-gray-500">
                        <span><i class="fas fa-clock mr-1"></i> ${task.duration}s</span>
                        <span><i class="fas fa-eye mr-1"></i> ${task.clicks}/${task.maxClicks}</span>
                    </div>
                `;
                container.appendChild(card);
            }
        });

        if (!foundTasks) {
            container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">No tasks available in this category. Check back later!</div>`;
        }
    });
}

function renderMyLinks() {
    const container = document.getElementById('task-container');
    container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">Loading your posted links...</div>`;

    const allLinkTypes = ['yt-watch', 'yt-sub', 'fb-follow', 'web-visit', 'playstore'];
    let myLinksCollection = []; // Collect all links before rendering
    let loadedCount = 0;

    // Use forEach with query to get all links owned by currentUser across categories
    allLinkTypes.forEach(type => {
        const q = query(ref(db, `links/${type}`), orderByChild('owner'), equalTo(currentUser.id));
        onValue(q, (snapshot) => { // Use onValue for real-time updates of user's own links
            loadedCount++;
            const links = snapshot.val() || {};
            
            // Remove previous entries for this type to re-render
            myLinksCollection = myLinksCollection.filter(link => link.type !== type);

            Object.keys(links).forEach(key => {
                myLinksCollection.push({ id: key, type: type, ...links[key] });
            });

            if (loadedCount === allLinkTypes.length) {
                // All link types have been fetched/updated, now render
                container.innerHTML = ''; // Clear container
                if (myLinksCollection.length === 0) {
                    container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">You haven't posted any links yet.</div>`;
                } else {
                    container.innerHTML = `<h3 class="col-span-full text-xl font-bold mb-4 text-yellow-500 my-links-header">Your Posted Links</h3>`;
                    myLinksCollection.sort((a, b) => b.postedAt - a.postedAt); // Sort by most recent
                    myLinksCollection.forEach(task => {
                        const cardId = `my-link-card-${task.type}-${task.id}`;
                        const card = document.createElement('div');
                        card.id = cardId;
                        card.className = "bg-gray-800 border border-gray-700 p-4 rounded-xl";
                        card.innerHTML = `
                            <div class="flex justify-between items-start mb-2">
                                <span class="bg-gray-700 text-[10px] px-2 py-1 rounded text-blue-400 uppercase font-bold">${task.type.replace('-', ' ')}</span>
                                <span class="text-green-400 font-bold">₱${task.reward.toFixed(3)}</span>
                            </div>
                            <p class="text-sm text-gray-300 truncate mb-2">${task.url}</p>
                            <div class="flex justify-between items-center text-xs text-gray-500 mb-2">
                                <span><i class="fas fa-eye mr-1"></i> <span class="link-clicks">${task.clicks}/${task.maxClicks}</span></span>
                                <span class="link-status ${task.clicks >= task.maxClicks ? 'text-red-400' : 'text-green-400'}">${task.clicks >= task.maxClicks ? 'Finished' : 'Active'}</span>
                            </div>
                            <p class="text-[10px] text-gray-600">Posted by you</p>
                        `;
                        container.appendChild(card);
                    });
                }
            }
        });
    });
}


// Timer Logic
function startTask(taskId, task, type) {
    // Ad logic: Every 10 clicks
    clickCounter++;
    localStorage.setItem('click_count', clickCounter);
    if (clickCounter % 10 === 0) {
        showRandomAd();
    }

    const modal = document.getElementById('timer-modal');
    const countdownText = document.getElementById('countdown-text');
    const progressCircle = document.getElementById('timer-progress');
    const taskTitle = document.getElementById('modal-task-title');

    let timeLeft = task.duration;
    taskTitle.innerText = `${TASK_CONFIGS[type].title} - Earn ₱${task.reward.toFixed(3)}`;
    modal.classList.remove('hidden');
    
    // Open the target link in a new tab/window
    window.open(task.url, '_blank');

    const circumference = 2 * Math.PI * 45; // For a circle with r=45

    const interval = setInterval(() => {
        timeLeft--;
        countdownText.innerText = timeLeft;
        
        // Update circle progress
        const offset = (timeLeft / task.duration) * circumference;
        progressCircle.style.strokeDasharray = circumference; // Ensure dasharray is set to full circumference
        progressCircle.style.strokeDashoffset = offset;

        if (timeLeft <= 0) {
            clearInterval(interval);
            completeTask(taskId, task, type);
            modal.classList.add('hidden');
        }
    }, 1000);
}

async function completeTask(taskId, task, type) {
    const userRef = ref(db, `users/${currentUser.id}`);
    const linkRef = ref(db, `links/${type}/${taskId}`); 

    // Atomically update user balance and mark task as completed for this user
    await update(userRef, {
        balance: (currentUser.balance || 0) + task.reward, // Ensure balance is a number
        [`completed/${taskId}`]: true // Mark task ID as completed by this user
    });

    // Increment click count on the task itself
    await update(linkRef, {
        clicks: (task.clicks || 0) + 1 // Ensure clicks is a number
    });

    // Update local currentUser object for immediate UI refresh
    currentUser.balance = (currentUser.balance || 0) + task.reward;
    if (!currentUser.completed) currentUser.completed = {};
    currentUser.completed[taskId] = true;
    updateUI(); // Refresh balance display

    alert(`Success! You earned ₱${task.reward.toFixed(3)}`);

    // No need to explicitly call renderTasks/renderMyLinks as onValue listeners handle real-time updates
}

// Posting Links
window.updateFreeLinksInfo = () => {
    if (!currentUser) return;
    const type = document.getElementById('link-type').value;
    const freeCount = (currentUser.freeLinksPosted && currentUser.freeLinksPosted[type]) || 0;
    const freeLinksLeft = 5 - freeCount;
    const infoText = document.getElementById('free-links-info');

    if (freeLinksLeft > 0) {
        infoText.innerText = `You have ${freeLinksLeft} free link(s) left for this category.`;
        infoText.classList.remove('text-red-400');
        infoText.classList.add('text-gray-400');
    } else {
        infoText.innerText = `No free links left for this category. Posting will cost ₱5.00.`;
        infoText.classList.remove('text-gray-400');
        infoText.classList.add('text-red-400');
    }

    // Update button text based on cost
    const submitBtn = document.querySelector('#link-modal button:last-child');
    if (freeLinksLeft > 0) {
        submitBtn.innerText = 'Post Free Link';
    } else {
        submitBtn.innerText = 'Pay ₱5 & Post';
    }
};

window.submitLink = async () => {
    const type = document.getElementById('link-type').value;
    const url = document.getElementById('link-url').value;
    const config = TASK_CONFIGS[type];

    if (!url || !url.startsWith('http')) {
        return alert("Please enter a valid URL (starting with http:// or https://).");
    }

    const freeCount = (currentUser.freeLinksPosted && currentUser.freeLinksPosted[type]) || 0;
    let isFree = freeCount < 5;
    
    let cost = 0;
    if (!isFree) {
        cost = config.paidPrice;
        if ((currentUser.balance || 0) < cost) {
            return alert(`Insufficient balance! You need ₱${cost.toFixed(2)} to post more links.`);
        }
    }

    const newTask = {
        url: url,
        reward: config.reward,
        duration: config.time,
        clicks: 0,
        maxClicks: isFree ? config.freeLimit : config.paidLimit,
        isFree: isFree,
        owner: currentUser.id,
        postedAt: Date.now() // Timestamp for sorting
    };

    const linksRef = ref(db, `links/${type}`);
    const newLinkKey = push(linksRef).key;
    
    let updates = {};
    updates[`links/${type}/${newLinkKey}`] = newTask;
    
    if (isFree) {
        updates[`users/${currentUser.id}/freeLinksPosted/${type}`] = freeCount + 1;
    } else {
        updates[`users/${currentUser.id}/balance`] = currentUser.balance - cost;
        currentUser.balance -= cost; // Update local state for immediate UI refresh
    }

    await update(ref(db), updates);
    alert("Link posted successfully!");
    closeModals();
    updateUI(); // Refresh balance display
    // No need to explicitly call renderMyLinks, onValue listener handles real-time updates
};

// Admin Functions
window.openAdmin = () => {
    const pass = prompt("Admin Password:");
    if (pass === "Propetas12") {
        const url = prompt("Enter Link URL for Admin Task (will be added to PlayStore category):");
        if (!url || !url.startsWith('http')) {
            return alert("Invalid URL provided or operation cancelled.");
        }
        
        const newTask = {
            url: url,
            reward: 0.03, // Admin tasks have specific reward
            duration: 20, // Admin tasks have specific duration
            clicks: 0,
            maxClicks: 10000,
            isFree: false, // Admin tasks are always treated as paid-tier for click counts, but free for admin to post
            owner: 'admin',
            postedAt: Date.now()
        };
        // Admin links are put into playstore category as requested
        push(ref(db, `links/playstore`), newTask);
        alert("Admin Task Added to PlayStore Category!");
    } else {
        alert("Wrong Password");
    }
};

// Ad Display Logic
function showRandomAd() {
    // Try Adsgram first
    const AdController = window.Adsgram.init({ blockId: "24438" });
    AdController.show().catch((err) => {
        console.warn("Adsgram failed, trying Libtl:", err);
        // Fallback to Libtl via the SDK logic
        if (window.show_10555663) {
            window.show_10555663();
        } else {
            console.warn("Libtl SDK function not available. Ad not shown.");
        }
    });
}

window.closeModals = () => {
    document.getElementById('link-modal').classList.add('hidden');
    document.getElementById('timer-modal').classList.add('hidden'); // Ensure timer modal is also hidden
};

// Start App
initUser();
