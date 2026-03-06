
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, get, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
const tg = window.Telegram.WebApp;
tg.expand();

// TASK MAP & CONFIGURATION
const CAT_SETTINGS = {
    yt_watch:   { label: "Watch Video", reward: 0.01, time: 30, freeV: 100, paidV: 550, cost: 5, dbKey: 'f_yt_w' },
    yt_sub:     { label: "Subscribe Channel", reward: 0.03, time: 30, freeV: 50,  paidV: 260,  cost: 5, dbKey: 'f_yt_s' },
    yt_like:    { label: "Like Video", reward: 0.01, time: 30, freeV: 100, paidV: 550, cost: 5, dbKey: 'f_yt_l' },
    yt_comm:    { label: "Comment Video", reward: 0.01, time: 30, freeV: 100, paidV: 550, cost: 5, dbKey: 'f_yt_c' },
    fb_follow:  { label: "Follow FB Page", reward: 0.01, time: 30, freeV: 100, paidV: 550, cost: 5, dbKey: 'f_fb_f' },
    web_visit:  { label: "Visit Website", reward: 0.01, time: 15, freeV: 100, paidV: 550, cost: 5, dbKey: 'f_web' },
    playstore:  { label: "Visit Playstore", reward: 0.015, time: 20, freeV: 100, paidV: 550, cost: 5, dbKey: 'f_ps' },
    admin_any:  { label: "Admin Promo", reward: 0.03, time: 20, freeV: 10000, paidV: 10000, cost: 0, dbKey: 'admin' }
};

const user = tg.initDataUnsafe?.user || { id: "dev_test", username: "Developer" }; // Fallback for local testing
let currentCategory = 'yt_watch'; // Default category for the "Add Link" section
let userData = {};
let player = null; // YouTube player instance
let activeTimer = null; // Interval for the task timer

// --- INITIALIZATION & USER DATA SYNC ---
const uRef = ref(db, 'users/' + user.id);
onValue(uRef, (snap) => {
    userData = snap.val() || { balance: 0, completed: {}, username: user.username, totalClicks: 0 };
    if (!snap.exists()) set(uRef, userData); // Initialize new user
    document.getElementById('userBalance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('tgUser').innerText = `@${user.username}`;
    refreshUI(); // Update UI after user data sync
});

// --- MAIN NAVIGATION (Tasks/Profile) ---
document.getElementById('tabTasks').onclick = () => toggleView('tasks');
document.getElementById('tabProfile').onclick = () => {
    toggleView('profile');
    renderProfile(); // Render user's promotions when profile is active
};

function toggleView(view) {
    const isTasks = view === 'tasks';
    document.getElementById('viewTasks').classList.toggle('hidden', !isTasks);
    document.getElementById('viewProfile').classList.toggle('hidden', isTasks);
    document.getElementById('tabTasks').classList.toggle('tab-active', isTasks);
    document.getElementById('tabProfile').classList.toggle('tab-active', !isTasks);
}

// --- CATEGORY SELECTION (for Add Link section) ---
window.changeCat = (c) => {
    currentCategory = c;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('cat-active'));
    event.target.classList.add('cat-active');
    refreshUI(); // Update UI based on new category
};

// --- ADMIN ACCESS ---
window.promptAdmin = () => {
    if (prompt("Admin Password:") === "Propetas12") changeCat('admin_any');
    else alert("Incorrect password!");
};

// --- UI REFRESH ---
function refreshUI() {
    const s = CAT_SETTINGS[currentCategory];
    const used = userData[s.dbKey] || 0;

    // Update "Add Link" section
    document.getElementById('formTitle').innerText = `Add ${s.label}`;
    document.getElementById('slotBadge').innerText = (currentCategory === 'admin_any') ? 'UNLIMITED' : `${Math.max(0, 5-used)} FREE SLOTS`;
    document.getElementById('infoPrice').innerHTML = `<span class="text-green-500">✔</span> After 5 free links, price is ₱${s.cost.toFixed(2)} for ${s.paidV} clicks. Reward per user: ₱${s.reward.toFixed(3)}`;
    
    renderAllTasks(); // Display ALL tasks in the task list
}

// --- YOUTUBE LINK PARSER (supports various formats including Shorts, mobile, live) ---
function getYTId(url) {
    const patterns = [
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/|)([\w-]{11})/,
        /^[\w-]{11}$/ // Direct ID
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }
    return false;
}

// --- RENDER ALL AVAILABLE TASKS ---
function renderAllTasks() {
    const container = document.getElementById('queueContainer');
    onValue(ref(db, `queue`), (allCategoriesSnap) => { // Listen to the root 'queue' node
        container.innerHTML = "";
        let taskCount = 0;

        allCategoriesSnap.forEach(categorySnap => { // Iterate through each category (e.g., 'yt_watch', 'fb_follow')
            const categoryKey = categorySnap.key;
            const categorySettings = CAT_SETTINGS[categoryKey];
            if (!categorySettings) return; // Skip if category is not configured

            categorySnap.forEach(taskSnap => { // Iterate through each task within the category
                const taskKey = taskSnap.key;
                const item = taskSnap.val();

                // Check if user has already completed this specific task OR if no slots left
                if (userData.completed?.[taskKey] || item.rem <= 0) return;

                const targetIdentifier = item.vid || item.url; // Use vid for YT, url for others

                const div = document.createElement('div');
                div.className = "bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-lg";
                div.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-xs font-black text-slate-500 italic">GO</div>
                        <div>
                            <p class="text-[9px] text-blue-400 font-bold uppercase">@${item.owner}</p>
                            <p class="text-[9px] text-slate-500 uppercase">${categorySettings.label}</p> <!-- Display category name -->
                            <p class="text-xs font-black">${item.rem} slots available</p>
                        </div>
                    </div>
                    <button onclick="executeTask('${categoryKey}', '${taskKey}', '${targetIdentifier}')" class="bg-red-600 text-[10px] font-black px-5 py-2 rounded-xl active:scale-90 transition-all">START</button>
                `;
                container.appendChild(div);
                taskCount++;
            });
        });

        if (taskCount === 0) {
            container.innerHTML = `<p class="text-center text-slate-600 py-20 text-xs font-bold italic">No tasks currently available in any category.</p>`;
        }
    });
}

// --- RENDER USER'S OWN PROMOTIONS ---
function renderProfile() {
    const list = document.getElementById('myLinksList');
    list.innerHTML = `<p class="text-center text-xs py-10 animate-pulse">Scanning your promotions...</p>`;
    
    let html = "";
    let foundLinks = 0;

    // Iterate through all possible categories
    Object.keys(CAT_SETTINGS).forEach(catKey => {
        get(ref(db, `queue/${catKey}`)).then(snap => {
            snap.forEach(child => {
                const item = child.val();
                if (item.ownerId === user.id) { // Check if this link belongs to the current user
                    foundLinks++;
                    html += `
                        <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-[8px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-black uppercase">${CAT_SETTINGS[catKey].label}</span>
                                <span class="text-[10px] font-black text-green-500">${item.rem} LEFT</span>
                            </div>
                            <p class="text-[10px] text-slate-500 truncate font-mono">${item.vid || item.url}</p>
                        </div>`;
                    // Update list continuously as links are found
                    list.innerHTML = html; 
                }
            });
            // If after checking all categories, no links were found
            if (foundLinks === 0) list.innerHTML = `<p class="text-center text-xs text-slate-600 py-20">You haven't promoted anything yet.</p>`;
        });
    });
}

// --- TASK EXECUTION (Timer, Player, Redirect) ---
window.executeTask = (categoryKey, taskKey, targetIdentifier) => {
    const s = CAT_SETTINGS[categoryKey]; // Get settings for the specific task category
    if (!s) { console.error("Invalid category key:", categoryKey); return; }

    let timeRemaining = s.time;
    const modal = document.getElementById('modalPlayer');
    const timerRing = document.getElementById('timerRing');
    
    modal.classList.remove('hidden');
    document.getElementById('modalTaskName').innerText = s.label;
    document.getElementById('modalReward').innerText = `Earn ₱${s.reward}`;
    timerRing.innerText = timeRemaining;

    const isYTTask = categoryKey.startsWith('yt');
    if (isYTTask) {
        document.getElementById('ytWrapper').classList.remove('hidden');
        document.getElementById('externalNotice').classList.add('hidden');
        if (!player) {
            player = new YT.Player('player', {
                videoId: targetIdentifier, height: '100%', width: '100%',
                playerVars: { autoplay: 1, controls: 0, disablekb: 1 },
                events: { onStateChange: (e) => { if(e.data === 1) startTaskTimer(); else stopTaskTimer(); }}
            });
        } else { player.loadVideoById(targetIdentifier); }
    } else {
        document.getElementById('ytWrapper').classList.add('hidden');
        document.getElementById('externalNotice').classList.remove('hidden');
        startTaskTimer();
    }

    function startTaskTimer() {
        if (activeTimer) return; // Prevent multiple timers
        activeTimer = setInterval(() => {
            timeRemaining--;
            timerRing.innerText = timeRemaining;
            if (timeRemaining <= 0) completeTask(categoryKey, taskKey, targetIdentifier);
        }, 1000);
    }
    function stopTaskTimer() { clearInterval(activeTimer); activeTimer = null; }
};

async function completeTask(categoryKey, taskKey, targetIdentifier) {
    clearInterval(activeTimer); activeTimer = null;
    const s = CAT_SETTINGS[categoryKey];
    if (!s) { console.error("Invalid category key during completion:", categoryKey); return; }

    // 1. Reward User and mark task as completed for this user
    await update(uRef, { 
        balance: increment(s.reward),
        [`completed/${taskKey}`]: true, // Use taskKey for user-specific completion tracking
        totalClicks: increment(1)
    });

    // 2. Decrement remaining count from the global queue
    const taskRef = ref(db, `queue/${categoryKey}/${taskKey}`);
    const snap = await get(taskRef);
    if (snap.exists()) {
        const remaining = snap.val().rem - 1;
        if (remaining <= 0) await set(taskRef, null); // Remove if no clicks left
        else await update(taskRef, { rem: remaining });
    }

    // 3. Ad Trigger (Every 10 clicks across all categories)
    const currentTotalClicks = (userData.totalClicks || 0) + 1; // Update local count for ad logic
    if (currentTotalClicks % 10 === 0) {
        if (window.Adsgram) {
            window.Adsgram.init({ blockId: "24438" }).show().catch(() => {
                if(window.show_10555663) window.show_10555663(); // Fallback to Libtl
            });
        } else if(window.show_10555663) {
            window.show_10555663(); // Direct Libtl call if Adsgram isn't ready
        }
    }

    // 4. Redirect to the actual link and close modal
    const finalLink = categoryKey.startsWith('yt') ? `https://youtube.com/watch?v=${targetIdentifier}` : targetIdentifier;
    tg.openLink(finalLink);
    document.getElementById('modalPlayer').classList.add('hidden');
}

// --- SUBMIT NEW PROMOTION ---
document.getElementById('btnSubmit').onclick = async () => {
    const inputValue = document.getElementById('inputUrl').value.trim();
    if (!inputValue) return;
    
    const s = CAT_SETTINGS[currentCategory];
    const usedFreeSlots = userData[s.dbKey] || 0;
    
    let cost = 0;
    let clickLimit = s.freeV;

    if (currentCategory !== 'admin_any' && usedFreeSlots >= 5) {
        cost = s.cost;
        clickLimit = s.paidV;
        if (!confirm(`You've used all 5 free slots for ${s.label}. Creating this promotion will cost ₱${cost.toFixed(2)} for ${clickLimit} clicks. Proceed?`)) {
            return; // User cancelled
        }
    }

    if (userData.balance < cost) {
        alert(`Insufficient balance! You need ₱${cost.toFixed(2)} to create this promotion.`);
        return;
    }

    // Prepare data for Firebase
    const promoData = {
        owner: user.username,
        ownerId: user.id,
        rem: clickLimit,
        ts: Date.now()
    };

    // Handle YouTube links specifically
    if (currentCategory.startsWith('yt')) {
        const videoId = getYTId(inputValue);
        if(!videoId) {
            alert("Please provide a valid YouTube Video, Shorts, or Live URL.");
            return;
        }
        promoData.vid = videoId; // Store video ID for YT tasks
    } else {
        promoData.url = inputValue; // Store raw URL for other tasks
    }

    // Push to Firebase queue
    await push(ref(db, `queue/${currentCategory}`), promoData);
    
    // Update user's balance and free slot count
    await update(uRef, {
        balance: increment(-cost),
        [s.dbKey]: increment(cost === 0 ? 1 : 0) // Increment free slot counter only if it was a free link
    });
    
    document.getElementById('inputUrl').value = ""; // Clear input
    alert(`Promotion for ${s.label} added successfully! It will now appear in the task list.`);
};
