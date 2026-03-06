
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, get, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781",
    measurementId: "G-Z64B87ELGP"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tg = window.Telegram.WebApp;
tg.expand();

// CONFIGURATION MAP
const CONFIG = {
    yt_watch:   { title: "YT Watch", reward: 0.01, timer: 30, freeCap: 100, paidCap: 550, cost: 5, field: 'f_yt_w' },
    yt_sub:     { title: "YT Sub", reward: 0.03, timer: 30, freeCap: 50,  paidCap: 65,  cost: 7, field: 'f_yt_s' },
    yt_like:    { title: "YT Like", reward: 0.01, timer: 30, freeCap: 100, paidCap: 550, cost: 5, field: 'f_yt_l' },
    yt_comment: { title: "YT Comment", reward: 0.01, timer: 30, freeCap: 100, paidCap: 550, cost: 5, field: 'f_yt_c' },
    fb_follow:  { title: "FB Follow", reward: 0.01, timer: 30, freeCap: 100, paidCap: 550, cost: 5, field: 'f_fb_f' },
    fb_like:    { title: "FB Like Post", reward: 0.01, timer: 20, freeCap: 100, paidCap: 550, cost: 5, field: 'f_fb_l' },
    fb_comment: { title: "FB Comment", reward: 0.01, timer: 30, freeCap: 100, paidCap: 550, cost: 5, field: 'f_fb_c' },
    web_visit:  { title: "Visit Site", reward: 0.01, timer: 15, freeCap: 100, paidCap: 550, cost: 5, field: 'f_web' },
    playstore:  { title: "Playstore", reward: 0.015, timer: 20, freeCap: 100, paidCap: 550, cost: 5, field: 'f_ps' },
    admin_any:  { title: "Admin Link", reward: 0.03, timer: 20, freeCap: 10000, paidCap: 10000, cost: 0, field: 'admin' }
};

// STATE
let curCat = 'yt_watch';
let userData = {};
let clickCount = parseInt(localStorage.getItem('click_count')) || 0;
const user = tg.initDataUnsafe?.user || { id: "12345", username: "LocalTest" };

// --- CORE LOGIC ---
const userRef = ref(db, 'users/' + user.id);
onValue(userRef, (snap) => {
    userData = snap.val() || { balance: 0, completed: {}, clicks: 0 };
    if (!snap.exists()) set(userRef, { balance: 0, completed: {}, username: user.username });
    document.getElementById('userBalance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('tgUserDisplay').innerText = `@${user.username}`;
    updateUI();
});

window.switchCat = (cat) => {
    curCat = cat;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('tab-active'));
    event.target.classList.add('tab-active');
    updateUI();
};

window.adminPrompt = () => {
    const pw = prompt("Admin Password:");
    if (pw === "Propetas12") switchCat('admin_any');
    else alert("Wrong password");
};

function updateUI() {
    const conf = CONFIG[curCat];
    const freeUsed = userData[conf.field] || 0;
    document.getElementById('formTitle').innerText = conf.title;
    document.getElementById('slotInfo').innerText = (curCat === 'admin_any') ? 'Admin Access' : `${Math.max(0, 5-freeUsed)} Free Slots`;
    document.getElementById('rewardInfo').innerText = `Earn ₱${conf.reward}`;
    renderTasks();
}

function renderTasks() {
    const taskList = document.getElementById('taskList');
    onValue(ref(db, `queue/${curCat}`), (snap) => {
        taskList.innerHTML = "";
        snap.forEach(child => {
            const item = child.val();
            if (userData.completed && userData.completed[child.key]) return;
            if (item.rem <= 0) return;

            const card = document.createElement('div');
            card.className = "bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between";
            card.innerHTML = `
                <div>
                    <p class="text-[10px] text-blue-400 font-bold">@${item.owner}</p>
                    <p class="text-xs font-bold text-slate-300">${item.rem} clicks left</p>
                </div>
                <button onclick="handleAction('${child.key}', '${item.url || item.vid}')" class="bg-red-600 text-[10px] font-black px-5 py-2 rounded-xl">OPEN</button>
            `;
            taskList.appendChild(card);
        });
    });
}

// --- TASK EXECUTION ---
let timerInt = null;
let activeTask = null;
let player = null;

window.handleAction = (key, target) => {
    activeTask = { key, target, cat: curCat };
    const conf = CONFIG[curCat];
    let timeLeft = conf.timer;
    
    document.getElementById('actionModal').classList.remove('hidden');
    document.getElementById('timerDisplay').innerText = timeLeft + "s";
    
    // YouTube Specific logic
    if (curCat.startsWith('yt')) {
        document.getElementById('playerContainer').classList.remove('hidden');
        document.getElementById('externalNotice').classList.add('hidden');
        if (!player) {
            player = new YT.Player('player', {
                videoId: target,
                playerVars: { autoplay: 1, controls: 0 },
                events: { onStateChange: (e) => { if(e.data == 1) startTimer(); else stopTimer(); }}
            });
        } else { player.loadVideoById(target); }
    } else {
        // FB, Web, PS Logic
        document.getElementById('playerContainer').classList.add('hidden');
        document.getElementById('externalNotice').classList.remove('hidden');
        document.getElementById('targetUrlDisplay').innerText = target;
        startTimer();
    }

    function startTimer() {
        if (timerInt) return;
        timerInt = setInterval(() => {
            timeLeft--;
            document.getElementById('timerDisplay').innerText = timeLeft + "s";
            if (timeLeft <= 0) completeTask();
        }, 1000);
    }
    function stopTimer() { clearInterval(timerInt); timerInt = null; }
};

async function completeTask() {
    clearInterval(timerInt); timerInt = null;
    const conf = CONFIG[activeTask.cat];
    
    // 1. Reward User
    await update(userRef, { 
        balance: increment(conf.reward),
        [`completed/${activeTask.key}`]: true 
    });

    // 2. Decrement Queue
    const linkRef = ref(db, `queue/${activeTask.cat}/${activeTask.key}`);
    const snap = await get(linkRef);
    if (snap.exists()) {
        const rem = snap.val().rem - 1;
        if (rem <= 0) await set(linkRef, null);
        else await update(linkRef, { rem: rem });
    }

    // 3. Ad Trigger (Every 10 clicks)
    clickCount++;
    localStorage.setItem('click_count', clickCount);
    if (clickCount % 10 === 0) {
        showAd();
    }

    // 4. Redirect
    const finalUrl = activeTask.cat.startsWith('yt') ? `https://youtube.com/watch?v=${activeTask.target}` : activeTask.target;
    tg.openLink(finalUrl);
    document.getElementById('actionModal').classList.add('hidden');
}

function showAd() {
    // Try Adsgram first, then Libtl
    const AdController = window.Adsgram?.init({ blockId: "24438" });
    if (AdController) {
        AdController.show().catch(() => {
            if (window.show_10555663) window.show_10555663();
        });
    } else {
        if (window.show_10555663) window.show_10555663();
    }
}

// --- SUBMISSION LOGIC ---
document.getElementById('submitBtn').onclick = async () => {
    const rawLink = document.getElementById('linkInput').value;
    if (!rawLink) return alert("Please enter link");
    
    const conf = CONFIG[curCat];
    const freeUsed = userData[conf.field] || 0;
    
    let cost = 0, limit = 0;
    if (curCat === 'admin_any') {
        cost = 0; limit = 10000;
    } else if (freeUsed < 5) {
        cost = 0; limit = conf.freeCap;
    } else {
        cost = conf.cost; limit = conf.paidCap;
        if (userData.balance < cost) return alert(`Need ₱${cost}.00`);
    }

    const data = {
        owner: user.username,
        rem: limit,
        ts: Date.now()
    };
    
    if (curCat.startsWith('yt')) data.vid = extractID(rawLink);
    else data.url = rawLink;

    await push(ref(db, `queue/${curCat}`), data);
    await update(userRef, {
        balance: increment(-cost),
        [conf.field]: increment(cost === 0 ? 1 : 0)
    });

    document.getElementById('linkInput').value = "";
    alert("Task Added!");
};

function extractID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length == 11) ? match[2] : url;
}
