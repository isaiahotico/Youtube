
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

const CONFIG = {
    yt_watch:   { label: "Watch Video", reward: 0.01, time: 30, free: 100, paid: 550, cost: 5, key: 'u_yt_w' },
    yt_sub:     { label: "Subscribe", reward: 0.03, time: 30, free: 50, paid: 260, cost: 5, key: 'u_yt_s' },
    fb_follow:  { label: "FB Follow", reward: 0.01, time: 30, free: 100, paid: 550, cost: 5, key: 'u_fb_f' },
    web_visit:  { label: "Visit Website", reward: 0.01, time: 20, free: 100, paid: 550, cost: 5, key: 'u_web' },
    admin_any:  { label: "Admin Promo", reward: 0.03, time: 20, free: 10000, paid: 10000, cost: 0, key: 'admin' }
};

const user = tg.initDataUnsafe?.user || { id: "user_test", username: "Tester" };
let curCat = 'yt_watch';
let userData = {};
let ytPlayer = null;
let activeTimer = null;

// SYNC DATA
onValue(ref(db, 'users/' + user.id), (s) => {
    userData = s.val() || { balance: 0, completed: {}, username: user.username, totalClicks: 0 };
    if (!s.exists()) set(ref(db, 'users/' + user.id), userData);
    document.getElementById('userBalance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('tgUser').innerText = `@${user.username}`;
    renderGlobalTasks();
});

// NAVIGATION
const tabs = {
    tabTasks: 'viewTasks',
    tabPromote: 'viewPromote',
    tabProfile: 'viewProfile'
};

Object.keys(tabs).forEach(id => {
    document.getElementById(id).onclick = () => {
        Object.values(tabs).forEach(view => document.getElementById(view).classList.add('hidden'));
        Object.keys(tabs).forEach(tid => {
            document.getElementById(tid).classList.remove('tab-active');
            document.getElementById(tid).classList.add('text-slate-500');
        });
        document.getElementById(tabs[id]).classList.remove('hidden');
        document.getElementById(id).classList.add('tab-active');
        document.getElementById(id).classList.remove('text-slate-500');
        if(id === 'tabProfile') renderProfile();
        if(id === 'tabPromote') refreshPromoteView();
    };
});

window.setCat = (c) => {
    curCat = c;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('cat-active'));
    event.target.classList.add('cat-active');
    refreshPromoteView();
};

window.promptAdmin = () => {
    if(prompt("Admin Password:") === "Propetas12") setCat('admin_any');
};

function refreshPromoteView() {
    const c = CONFIG[curCat];
    const used = userData[c.key] || 0;
    document.getElementById('promoTitle').innerText = `Add ${c.label}`;
    document.getElementById('limitInfo').innerText = `${Math.max(0, 5-used)} Free Slots Left`;
}

// 1. DISPLAY ALL TASKS IN ONE AREA
function renderGlobalTasks() {
    const container = document.getElementById('allTasksContainer');
    onValue(ref(db, 'queue'), (snap) => {
        container.innerHTML = "";
        let count = 0;
        snap.forEach(catSnap => {
            const catKey = catSnap.key;
            catSnap.forEach(taskSnap => {
                const item = taskSnap.val();
                if (userData.completed?.[taskSnap.key] || item.rem <= 0) return;

                const div = document.createElement('div');
                div.className = "bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between";
                div.innerHTML = `
                    <div>
                        <p class="text-[9px] text-blue-400 font-black uppercase">@${item.owner}</p>
                        <p class="text-xs font-black text-slate-200">${CONFIG[catKey].label}</p>
                        <p class="text-[10px] text-slate-500">${item.rem} slots left</p>
                    </div>
                    <button onclick="executeTask('${catKey}', '${taskSnap.key}', '${item.vid || item.url}')" class="bg-red-600 text-[10px] font-black px-6 py-2 rounded-xl">START</button>
                `;
                container.appendChild(div);
                count++;
            });
        });
        if(count === 0) container.innerHTML = `<p class="text-center text-xs py-20 text-slate-500 italic">No tasks available. Check back later!</p>`;
    });
}

// 2. EXECUTION LOGIC (YouTube Player in Another Page / Redirects)
window.executeTask = (cat, key, target) => {
    const c = CONFIG[cat];
    let time = c.time;
    const page = document.getElementById('executionPage');
    const timerDisplay = document.getElementById('timerDisplay');
    
    page.style.display = 'flex';
    timerDisplay.innerText = time;
    document.getElementById('taskActionLabel').innerText = c.label;
    document.getElementById('taskRewardLabel').innerText = `Earn ₱${c.reward}`;

    // Hide all internal containers
    ['playerBox', 'webBox', 'socialBox'].forEach(id => document.getElementById(id).classList.add('hidden'));

    if (cat.startsWith('yt')) {
        document.getElementById('playerBox').classList.remove('hidden');
        if (!ytPlayer) {
            ytPlayer = new YT.Player('player', {
                videoId: target, height: '100%', width: '100%',
                playerVars: { autoplay: 1, controls: 0, disablekb: 1 },
                events: { onStateChange: (e) => { if(e.data === 1) startTimer(); else stopTimer(); }}
            });
        } else { ytPlayer.loadVideoById(target); }
    } 
    else if (cat === 'web_visit') {
        document.getElementById('webBox').classList.remove('hidden');
        document.getElementById('webFrame').src = target;
        document.getElementById('webGate').classList.remove('hidden');
        document.getElementById('startWebTimer').onclick = () => {
            document.getElementById('webGate').classList.add('hidden');
            startTimer();
        };
    }
    else {
        // Facebook / Social
        document.getElementById('socialBox').classList.remove('hidden');
        tg.openLink(target); // Auto redirect to social app
        startTimer();
    }

    function startTimer() {
        if (activeTimer) return;
        activeTimer = setInterval(() => {
            time--;
            timerDisplay.innerText = time;
            if (time <= 0) finalize(cat, key, target);
        }, 1000);
    }
    function stopTimer() { clearInterval(activeTimer); activeTimer = null; }
};

async function finalize(cat, key, target) {
    clearInterval(activeTimer); activeTimer = null;
    const c = CONFIG[cat];

    // 1. Reward & User Data Update
    await update(ref(db, 'users/' + user.id), {
        balance: increment(c.reward),
        [`completed/${key}`]: true,
        totalClicks: increment(1)
    });

    // 2. Decrement Global Queue
    const taskRef = ref(db, `queue/${cat}/${key}`);
    const snap = await get(taskRef);
    if (snap.exists()) {
        const left = snap.val().rem - 1;
        if (left <= 0) await set(taskRef, null);
        else await update(taskRef, { rem: left });
    }

    // 3. Ad Logic
    if (((userData.totalClicks || 0) + 1) % 10 === 0) {
        if (window.Adsgram) window.Adsgram.init({ blockId: "24438" }).show().catch(() => window.show_10555663?.());
    }

    // 4. Redirect to YouTube App if it was a YT task
    if (cat.startsWith('yt')) {
        tg.openLink(`https://youtube.com/watch?v=${target}`);
    }

    document.getElementById('executionPage').style.display = 'none';
    alert(`Success! ₱${c.reward} added to your balance.`);
}

// SUBMIT PROMOTION
document.getElementById('submitPromo').onclick = async () => {
    const val = document.getElementById('linkInput').value;
    if (!val) return;
    
    const c = CONFIG[curCat];
    const used = userData[c.key] || 0;
    let cost = (used >= 5) ? c.cost : 0;
    let limit = (used >= 5) ? c.paid : c.free;

    if (userData.balance < cost) return alert("Insufficient balance.Need 5 peso!");

    const data = { owner: user.username, ownerId: user.id, rem: limit, ts: Date.now() };

    if (curCat.startsWith('yt')) {
        const vid = val.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/|)([\w-]{11})/)?.[1];
        if(!vid) return alert("Invalid YouTube link.");
        data.vid = vid;
    } else { data.url = val; }

    await push(ref(db, `queue/${curCat}`), data);
    await update(ref(db, 'users/' + user.id), {
        balance: increment(-cost),
        [c.key]: increment(cost === 0 ? 1 : 0)
    });
    
    document.getElementById('linkInput').value = "";
    alert("Promotion is now live!");
};

function renderProfile() {
    const list = document.getElementById('myLinksContainer');
    list.innerHTML = `<p class="text-center text-xs py-10 text-slate-500">Loading your links...</p>`;
    get(ref(db, 'queue')).then(snap => {
        list.innerHTML = "";
        let found = false;
        snap.forEach(catSnap => {
            catSnap.forEach(taskSnap => {
                const item = taskSnap.val();
                if (item.ownerId === user.id) {
                    found = true;
                    const div = document.createElement('div');
                    div.className = "bg-slate-900 border border-slate-800 p-4 rounded-2xl";
                    div.innerHTML = `
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-[9px] bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-bold uppercase">${CONFIG[catSnap.key].label}</span>
                            <span class="text-green-500 text-[10px] font-black">${item.rem} REMAINING</span>
                        </div>
                        <p class="text-xs text-slate-400 truncate">${item.vid || item.url}</p>
                    `;
                    list.appendChild(div);
                }
            });
        });
        if(!found) list.innerHTML = `<p class="text-center text-xs py-20 text-slate-500 italic">No active promotions found.</p>`;
    });
}
