
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- DATABASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "facebook-follow-to-follow.firebaseapp.com",
    databaseURL: "https://facebook-follow-to-follow-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "facebook-follow-to-follow",
    storageBucket: "facebook-follow-to-follow.firebasestorage.app",
    messagingSenderId: "589427984313",
    appId: "1:589427984313:web:a17b8cc851efde6dd79868"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUser = null;
let currentTab = 'yt-watch';
let activeTaskInterval = null;
let isTaskActive = false;
let isPaused = false;

// Config
const CONFIGS = {
    'yt-watch': { reward: 0.01, time: 30, freeLimit: 100, paidLimit: 550 },
    'yt-sub': { reward: 0.03, time: 30, freeLimit: 50, paidLimit: 260 },
    'fb-follow': { reward: 0.01, time: 30, freeLimit: 100, paidLimit: 550 },
    'web-visit': { reward: 0.01, time: 15, freeLimit: 100, paidLimit: 550 },
    'playstore': { reward: 0.015, time: 20, freeLimit: 100, paidLimit: 550 }
};

async function initUser() {
    let tgId = localStorage.getItem('tg_id') || 'U' + Math.floor(Math.random() * 1000000);
    localStorage.setItem('tg_id', tgId);

    // Referral logic: Check URL for ?start=UID
    const urlParams = new URLSearchParams(window.location.search);
    const referrerId = urlParams.get('start');

    onValue(ref(db, `users/${tgId}`), async (snap) => {
        if (snap.exists()) {
            currentUser = snap.val();
        } else {
            let username = prompt("Enter Telegram Username (@name):") || "@User" + tgId;
            currentUser = {
                id: tgId,
                username: username,
                balance: 0,
                refEarned: 0,
                invites: 0,
                referrer: (referrerId && referrerId !== tgId) ? referrerId : null,
                completed: {},
                freeLinks: { 'yt-watch': 0, 'yt-sub': 0, 'fb-follow': 0, 'web-visit': 0, 'playstore': 0 }
            };
            await set(ref(db, `users/${tgId}`), currentUser);
            
            // Credit the referrer an invite count
            if (currentUser.referrer) {
                const refRef = ref(db, `users/${currentUser.referrer}/invites`);
                get(refRef).then(s => set(refRef, (s.val() || 0) + 1));
            }
        }
        updateUI();
    });
}

function updateUI() {
    document.getElementById('user-balance').innerText = (currentUser.balance || 0).toFixed(3);
    document.getElementById('display-username').innerText = currentUser.username;
    document.getElementById('user-uid').innerText = currentUser.id;
    document.getElementById('total-invites').innerText = currentUser.invites || 0;
    document.getElementById('ref-earned').innerText = (currentUser.refEarned || 0).toFixed(3);
    document.getElementById('ref-link-input').value = `https://t.me/PaperhouseYoutubeBot/start?start=${currentUser.id}`;
    renderTab();
}

// Anti-Cheat: Visibility Check
document.addEventListener("visibilitychange", () => {
    if (isTaskActive && document.visibilityState === "visible") {
        isPaused = true;
        document.getElementById('anti-cheat-overlay').classList.remove('hidden');
    }
});

window.resumeTask = () => {
    isPaused = false;
    document.getElementById('anti-cheat-overlay').classList.add('hidden');
};

function startTask(taskId, task, type) {
    isTaskActive = true;
    isPaused = false;
    let timeLeft = task.duration;
    
    document.getElementById('timer-modal').classList.remove('hidden');
    window.open(task.url, '_blank');

    activeTaskInterval = setInterval(() => {
        if (!isPaused) {
            timeLeft--;
            document.getElementById('countdown-text').innerText = timeLeft;
            let offset = 283 - (timeLeft / task.duration) * 283;
            document.getElementById('timer-progress').style.strokeDashoffset = offset;

            if (timeLeft <= 0) {
                clearInterval(activeTaskInterval);
                finishTask(taskId, task, type);
            }
        }
    }, 1000);
}

async function finishTask(taskId, task, type) {
    isTaskActive = false;
    document.getElementById('timer-modal').classList.add('hidden');

    // 1. Reward User
    const updates = {};
    updates[`users/${currentUser.id}/balance`] = currentUser.balance + task.reward;
    updates[`users/${currentUser.id}/completed/${taskId}`] = true;
    updates[`links/${type}/${taskId}/clicks`] = (task.clicks || 0) + 1;

    // 2. Referral Commission (12%)
    if (currentUser.referrer) {
        const commission = task.reward * 0.12;
        const refPath = `users/${currentUser.referrer}`;
        const refSnap = await get(ref(db, refPath));
        if (refSnap.exists()) {
            const rData = refSnap.val();
            updates[`${refPath}/balance`] = (rData.balance || 0) + commission;
            updates[`${refPath}/refEarned`] = (rData.refEarned || 0) + commission;
        }
    }

    await update(ref(db), updates);
    
    // Ad logic every few tasks
    if (Math.random() > 0.7) showAd();
    alert(`Success! ₱${task.reward} earned.`);
}

function renderTab() {
    const container = document.getElementById('task-container');
    container.innerHTML = "";
    
    if (currentTab === 'my-links') {
        renderMyStatus();
        return;
    }

    onValue(ref(db, `links/${currentTab}`), (snap) => {
        container.innerHTML = "";
        const data = snap.val() || {};
        Object.keys(data).forEach(id => {
            const item = data[id];
            // Hide finished or already done
            if (item.clicks < item.maxClicks && (!currentUser.completed || !currentUser.completed[id])) {
                const card = document.createElement('div');
                card.className = "bg-gray-800 border border-gray-700 p-4 rounded-xl cursor-pointer hover:border-yellow-500";
                card.onclick = () => startTask(id, item, currentTab);
                card.innerHTML = `
                    <div class="flex justify-between mb-2"><span class="text-xs text-yellow-500 font-bold uppercase">${currentTab}</span> <span class="text-green-400 font-bold">₱${item.reward}</span></div>
                    <p class="text-sm truncate text-gray-400 mb-3">${item.url}</p>
                    <div class="flex justify-between text-[10px] text-gray-500 font-mono">
                        <span>${item.duration} SECONDS</span>
                        <span>${item.clicks}/${item.maxClicks} CLICKS</span>
                    </div>
                `;
                container.appendChild(card);
            }
        });
    });
}

function renderMyStatus() {
    const container = document.getElementById('task-container');
    const categories = ['yt-watch', 'yt-sub', 'fb-follow', 'web-visit', 'playstore'];
    
    categories.forEach(cat => {
        get(ref(db, `links/${cat}`)).then(snap => {
            const data = snap.val() || {};
            Object.keys(data).forEach(id => {
                const item = data[id];
                if (item.owner === currentUser.id) {
                    const card = document.createElement('div');
                    card.className = "bg-gray-800/50 border border-gray-700 p-4 rounded-xl";
                    card.innerHTML = `
                        <div class="text-[10px] text-gray-500 mb-1 uppercase">${cat}</div>
                        <p class="text-sm truncate mb-2">${item.url}</p>
                        <div class="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                            <div class="bg-yellow-500 h-full" style="width: ${(item.clicks/item.maxClicks)*100}%"></div>
                        </div>
                        <div class="flex justify-between mt-1 text-[10px]">
                            <span>Progress</span>
                            <span>${item.clicks} / ${item.maxClicks}</span>
                        </div>
                    `;
                    container.appendChild(card);
                }
            });
        });
    });
}

window.showTab = (tab) => {
    if (tab === 'add-link') {
        document.getElementById('link-modal').classList.remove('hidden');
        updateFreeCountUI();
        return;
    }
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
    document.getElementById(`btn-${tab}`).classList.add('active-tab');
    renderTab();
};

window.updateFreeCountUI = () => {
    const type = document.getElementById('link-type').value;
    const freeDone = (currentUser.freeLinks && currentUser.freeLinks[type]) || 0;
    const left = 5 - freeDone;
    const info = document.getElementById('free-links-info');
    const btn = document.getElementById('submit-btn');

    if (left > 0) {
        info.innerText = `You have ${left} free links left for this category.`;
        btn.innerText = "Post Free Link";
    } else {
        info.innerText = "Free slots used. Cost: ₱5.00";
        btn.innerText = "Pay ₱5 & Post";
    }
};

window.submitLink = async () => {
    const type = document.getElementById('link-type').value;
    const url = document.getElementById('link-url').value;
    if (!url.startsWith('http')) return alert("Invalid URL");

    const freeDone = (currentUser.freeLinks && currentUser.freeLinks[type]) || 0;
    const isFree = freeDone < 5;
    const config = CONFIGS[type];

    if (!isFree && currentUser.balance < 5) return alert("Insufficient Balance");

    const newLink = {
        url: url,
        reward: config.reward,
        duration: config.time,
        clicks: 0,
        maxClicks: isFree ? config.freeLimit : config.paidLimit,
        owner: currentUser.id
    };

    const updates = {};
    const key = push(ref(db, `links/${type}`)).key;
    updates[`links/${type}/${key}`] = newLink;
    
    if (isFree) {
        updates[`users/${currentUser.id}/freeLinks/${type}`] = freeDone + 1;
    } else {
        updates[`users/${currentUser.id}/balance`] = currentUser.balance - 5;
    }

    await update(ref(db), updates);
    alert("Posted successfully!");
    closeModals();
};

window.copyRef = () => {
    const copyText = document.getElementById("ref-link-input");
    copyText.select();
    document.execCommand("copy");
    alert("Referral link copied!");
};

window.showAd = () => {
    try {
        const AdController = window.Adsgram.init({ blockId: "24438" });
        AdController.show();
    } catch(e) {
        if (window.show_10555663) window.show_10555663();
    }
};

window.closeModals = () => document.getElementById('link-modal').classList.add('hidden');

initUser();
