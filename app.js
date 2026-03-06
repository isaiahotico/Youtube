
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// Initial Setup: Simple Telegram ID simulation
// In a real app, this would be fetched via Telegram WebApp / Login Widget
function initUser() {
    let tgId = localStorage.getItem('tg_id');
    if (!tgId) {
        tgId = 'User_' + Math.floor(Math.random() * 999999);
        localStorage.setItem('tg_id', tgId);
    }
    
    onValue(ref(db, `users/${tgId}`), (snapshot) => {
        if (snapshot.exists()) {
            currentUser = snapshot.val();
        } else {
            currentUser = {
                id: tgId,
                balance: 0,
                completed: {},
                freeLinksPosted: { 'yt-watch': 0, 'yt-sub': 0, 'fb-follow': 0, 'web-visit': 0, 'playstore': 0 }
            };
            set(ref(db, `users/${tgId}`), currentUser);
        }
        updateUI();
    });
}

function updateUI() {
    document.getElementById('user-balance').innerText = currentUser.balance.toFixed(3);
    document.getElementById('display-username').innerText = `@${currentUser.id}`;
    document.getElementById('user-uid').innerText = currentUser.id;
    renderTasks();
}

window.showTab = (tab) => {
    if (tab === 'add-link') {
        document.getElementById('link-modal').classList.remove('hidden');
        return;
    }
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
    document.getElementById(`btn-${tab}`).classList.add('active-tab');
    renderTasks();
};

const TASK_CONFIGS = {
    'yt-watch': { reward: 0.01, time: 30, freeLimit: 100, paidLimit: 550, title: "Watch Video" },
    'yt-sub': { reward: 0.03, time: 30, freeLimit: 50, paidLimit: 260, title: "Subscribe Channel" },
    'fb-follow': { reward: 0.01, time: 30, freeLimit: 100, paidLimit: 550, title: "Follow Page" },
    'web-visit': { reward: 0.01, time: 15, freeLimit: 100, paidLimit: 550, title: "Visit Website" },
    'playstore': { reward: 0.015, time: 20, freeLimit: 100, paidLimit: 550, title: "Install App" },
    'admin': { reward: 0.03, time: 20, freeLimit: 10000, paidLimit: 10000, title: "Admin Task" }
};

function renderTasks() {
    const container = document.getElementById('task-container');
    container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">Loading links...</div>`;

    get(ref(db, `links/${currentTab}`)).then((snapshot) => {
        container.innerHTML = "";
        const links = snapshot.val() || {};
        let found = false;

        Object.keys(links).forEach(key => {
            const task = links[key];
            const isCompleted = currentUser.completed && currentUser.completed[key];

            if (!isCompleted && task.clicks < task.maxClicks) {
                found = true;
                const card = document.createElement('div');
                card.className = "bg-gray-800 border border-gray-700 p-4 rounded-xl hover:border-yellow-500 transition cursor-pointer";
                card.onclick = () => startTask(key, task);
                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <span class="bg-gray-700 text-[10px] px-2 py-1 rounded text-yellow-400 uppercase font-bold">${task.isFree ? 'Free' : 'Paid'}</span>
                        <span class="text-green-400 font-bold">₱${task.reward}</span>
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

        if (!found) {
            container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">No tasks available in this category.</div>`;
        }
    });
}

// Timer Logic
function startTask(taskId, task) {
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
    taskTitle.innerText = `Reward: ₱${task.reward}`;
    modal.classList.remove('hidden');
    
    // Redirect user to the link in new tab
    window.open(task.url, '_blank');

    const interval = setInterval(() => {
        timeLeft--;
        countdownText.innerText = timeLeft;
        
        // Update circle progress
        const offset = (timeLeft / task.duration) * 283;
        progressCircle.style.strokeDashoffset = offset;

        if (timeLeft <= 0) {
            clearInterval(interval);
            completeTask(taskId, task);
            modal.classList.add('hidden');
        }
    }, 1000);
}

function completeTask(taskId, task) {
    const userRef = ref(db, `users/${currentUser.id}`);
    const linkRef = ref(db, `links/${currentTab}/${taskId}`);

    // Atomically increment clicks and reward user
    update(userRef, {
        balance: currentUser.balance + task.reward,
        [`completed/${taskId}`]: true
    });

    update(linkRef, {
        clicks: task.clicks + 1
    });

    alert(`Success! You earned ₱${task.reward}`);
}

// Posting Links
window.submitLink = async () => {
    const type = document.getElementById('link-type').value;
    const url = document.getElementById('link-url').value;
    const config = TASK_CONFIGS[type];

    if (!url.startsWith('http')) return alert("Enter valid URL");

    const freeCount = (currentUser.freeLinksPosted && currentUser.freeLinksPosted[type]) || 0;
    let isFree = freeCount < 5;
    
    if (!isFree && currentUser.balance < 5) {
        return alert("Insufficient balance! You need ₱5 to post more links.");
    }

    const newTask = {
        url: url,
        reward: config.reward,
        duration: config.time,
        clicks: 0,
        maxClicks: isFree ? config.freeLimit : config.paidLimit,
        isFree: isFree,
        owner: currentUser.id
    };

    const linksRef = ref(db, `links/${type}`);
    const newLinkKey = push(linksRef).key;
    
    let updates = {};
    updates[`links/${type}/${newLinkKey}`] = newTask;
    
    if (isFree) {
        updates[`users/${currentUser.id}/freeLinksPosted/${type}`] = freeCount + 1;
    } else {
        updates[`users/${currentUser.id}/balance`] = currentUser.balance - 5;
    }

    await update(ref(db), updates);
    alert("Link posted successfully!");
    closeModals();
};

// Admin Functions
window.openAdmin = () => {
    const pass = prompt("Admin Password:");
    if (pass === "Propetas12") {
        const url = prompt("Enter Link URL:");
        if (!url) return;
        
        const newTask = {
            url: url,
            reward: 0.03,
            duration: 20,
            clicks: 0,
            maxClicks: 10000,
            isFree: false,
            owner: 'admin'
        };
        push(ref(db, `links/playstore`), newTask);
        alert("Admin Task Added to PlayStore Category!");
    } else {
        alert("Wrong Password");
    }
};

// Ad Display Logic
function showRandomAd() {
    // Try Adsgram
    const AdController = window.Adsgram.init({ blockId: "24438" });
    AdController.show().catch((err) => {
        console.log("Adsgram skip, trying Libtl");
        // Fallback to Libtl via the SDK logic
        if (window.show_10555663) window.show_10555663();
    });
}

window.closeModals = () => {
    document.getElementById('link-modal').classList.add('hidden');
};

// Start App
initUser();
