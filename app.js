
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

// TASK MAP
const CAT_SETTINGS = {
    yt_watch:   { label: "Watch Video", reward: 0.01, time: 30, freeV: 100, paidV: 550, cost: 5, key: 'u_yt_w' },
    yt_sub:     { label: "Subscribe Channel", reward: 0.03, time: 30, freeV: 50,  paidV: 65,  cost: 7, key: 'u_yt_s' },
    yt_like:    { label: "Like Video", reward: 0.01, time: 30, freeV: 100, paidV: 550, cost: 5, key: 'u_yt_l' },
    yt_comm:    { label: "Comment Video", reward: 0.01, time: 30, freeV: 100, paidV: 550, cost: 5, key: 'u_yt_c' },
    fb_follow:  { label: "Follow FB Page", reward: 0.01, time: 30, freeV: 100, paidV: 550, cost: 5, key: 'u_fb_f' },
    web_visit:  { label: "Visit Website", reward: 0.01, time: 15, freeV: 100, paidV: 550, cost: 5, key: 'u_web' },
    playstore:  { label: "Visit Playstore", reward: 0.015, time: 20, freeV: 100, paidV: 550, cost: 5, key: 'u_ps' },
    admin_any:  { label: "Admin Promo", reward: 0.03, time: 20, freeV: 10000, paidV: 10000, cost: 0, key: 'admin' }
};

const user = tg.initDataUnsafe?.user || { id: "tester_1", username: "LocalTester" };
let currentCategory = 'yt_watch';
let userData = {};
let player = null;
let activeTimer = null;

// SYNC DATA
const uRef = ref(db, 'users/' + user.id);
onValue(uRef, (snap) => {
    userData = snap.val() || { balance: 0, completed: {}, username: user.username, totalClicks: 0 };
    if (!snap.exists()) set(uRef, userData);
    document.getElementById('userBalance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('tgUser').innerText = `@${user.username}`;
    refreshUI();
});

// NAVIGATION
document.getElementById('tabTasks').onclick = () => {
    toggleView('tasks');
};
document.getElementById('tabProfile').onclick = () => {
    toggleView('profile');
    renderProfile();
};

function toggleView(v) {
    const isT = v === 'tasks';
    document.getElementById('viewTasks').classList.toggle('hidden', !isT);
    document.getElementById('viewProfile').classList.toggle('hidden', isT);
    document.getElementById('tabTasks').classList.toggle('tab-active', isT);
    document.getElementById('tabProfile').classList.toggle('tab-active', !isT);
}

window.changeCat = (c) => {
    currentCategory = c;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('cat-active'));
    event.target.classList.add('cat-active');
    refreshUI();
};

window.promptAdmin = () => {
    if (prompt("Admin Password:") === "Propetas12") changeCat('admin_any');
};

function refreshUI() {
    const s = CAT_SETTINGS[currentCategory];
    const used = userData[s.key] || 0;
    document.getElementById('formTitle').innerText = `Add ${s.label}`;
    document.getElementById('slotBadge').innerText = (currentCategory === 'admin_any') ? 'UNLIMITED' : `${Math.max(0, 5-used)} FREE SLOTS`;
    document.getElementById('infoPrice').innerHTML = `<span class="text-green-500">✔</span> Next links: ₱${s.cost.toFixed(2)} for ${s.paidV} clicks. Reward per user: ₱${s.reward.toFixed(3)}`;
    renderQueue();
}

// YOUTUBE LINK PARSER (ROBUST)
function getYTId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?)|(shorts\/)|(\?v=)|(&v=))([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[10].length == 11) ? match[10] : false;
}

// QUEUE RENDERER
function renderQueue() {
    const container = document.getElementById('queueContainer');
    onValue(ref(db, `queue/${currentCategory}`), (snap) => {
        container.innerHTML = "";
        let count = 0;
        snap.forEach(child => {
            const item = child.val();
            if (userData.completed?.[child.key]) return;
            if (item.rem <= 0) return;

            const div = document.createElement('div');
            div.className = "bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-lg";
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-xs font-black text-slate-500 italic">GO</div>
                    <div>
                        <p class="text-[9px] text-blue-400 font-bold uppercase">@${item.owner}</p>
                        <p class="text-xs font-black">${item.rem} slots available</p>
                    </div>
                </div>
                <button onclick="executeTask('${child.key}', '${item.vid || item.url}')" class="bg-red-600 text-[10px] font-black px-5 py-2 rounded-xl active:scale-90 transition-all">START</button>
            `;
            container.appendChild(div);
            count++;
        });
        if (count === 0) container.innerHTML = `<p class="text-center text-slate-600 py-20 text-xs font-bold italic">No tasks available in this category.</p>`;
    });
}

function renderProfile() {
    const list = document.getElementById('myLinksList');
    list.innerHTML = `<p class="text-center text-xs py-10 animate-pulse">Scanning database...</p>`;
    
    let html = "";
    let found = 0;
    Object.keys(CAT_SETTINGS).forEach(ck => {
        get(ref(db, `queue/${ck}`)).then(snap => {
            snap.forEach(child => {
                const item = child.val();
                if (item.ownerId === user.id) {
                    found++;
                    html += `
                    <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-[8px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-black uppercase">${CAT_SETTINGS[ck].label}</span>
                            <span class="text-[10px] font-black text-green-500">${item.rem} LEFT</span>
                        </div>
                        <p class="text-[10px] text-slate-500 truncate font-mono">${item.vid || item.url}</p>
                    </div>`;
                    list.innerHTML = html;
                }
            });
            if(found === 0) list.innerHTML = `<p class="text-center text-xs text-slate-600 py-20">You haven't promoted anything yet.</p>`;
        });
    });
}

// TASK EXECUTION
window.executeTask = (key, target) => {
    const s = CAT_SETTINGS[currentCategory];
    let time = s.time;
    const modal = document.getElementById('modalPlayer');
    const ring = document.getElementById('timerRing');
    
    modal.classList.remove('hidden');
    document.getElementById('modalTaskName').innerText = s.label;
    document.getElementById('modalReward').innerText = `Earn ₱${s.reward}`;
    ring.innerText = time;

    const isYT = currentCategory.startsWith('yt');
    if (isYT) {
        document.getElementById('ytWrapper').classList.remove('hidden');
        document.getElementById('externalNotice').classList.add('hidden');
        if (!player) {
            player = new YT.Player('player', {
                videoId: target, height: '100%', width: '100%',
                playerVars: { autoplay: 1, controls: 0, disablekb: 1 },
                events: { onStateChange: (e) => { if(e.data === 1) startT(); else stopT(); }}
            });
        } else { player.loadVideoById(target); }
    } else {
        document.getElementById('ytWrapper').classList.add('hidden');
        document.getElementById('externalNotice').classList.remove('hidden');
        startT();
    }

    function startT() {
        if (activeTimer) return;
        activeTimer = setInterval(() => {
            time--;
            ring.innerText = time;
            if (time <= 0) complete(key, target);
        }, 1000);
    }
    function stopT() { clearInterval(activeTimer); activeTimer = null; }
};

async function complete(key, target) {
    clearInterval(activeTimer); activeTimer = null;
    const s = CAT_SETTINGS[currentCategory];

    // 1. Reward & Record
    await update(uRef, { 
        balance: increment(s.reward),
        [`completed/${key}`]: true,
        totalClicks: increment(1)
    });

    // 2. Decrement
    const tRef = ref(db, `queue/${currentCategory}/${key}`);
    const snap = await get(tRef);
    if (snap.exists()) {
        const r = snap.val().rem - 1;
        if (r <= 0) await set(tRef, null);
        else await update(tRef, { rem: r });
    }

    // 3. Ads Every 10
    const count = (userData.totalClicks || 0) + 1;
    if (count % 10 === 0) {
        if (window.Adsgram) {
            window.Adsgram.init({ blockId: "24438" }).show().catch(() => {
                if(window.show_10555663) window.show_10555663();
            });
        }
    }

    // 4. Redirect
    const link = currentCategory.startsWith('yt') ? `https://youtube.com/watch?v=${target}` : target;
    tg.openLink(link);
    document.getElementById('modalPlayer').classList.add('hidden');
}

// SUBMIT
document.getElementById('btnSubmit').onclick = async () => {
    const val = document.getElementById('inputUrl').value;
    if (!val) return;
    
    const s = CAT_SETTINGS[currentCategory];
    const used = userData[s.key] || 0;
    
    let cost = 0;
    let limit = s.freeV;

    if (currentCategory !== 'admin_any' && used >= 5) {
        cost = s.cost;
        limit = s.paidV;
        if (!confirm(`You used all free slots. Create this promotion for ₱${cost}.00 (${limit} clicks)?`)) return;
    }

    if (userData.balance < cost) return alert("Insufficient balance in your wallet.");

    const data = {
        owner: user.username,
        ownerId: user.id,
        rem: limit,
        ts: Date.now()
    };

    if (currentCategory.startsWith('yt')) {
        const vid = getYTId(val);
        if(!vid) return alert("Please provide a valid YouTube Video or Shorts URL.");
        data.vid = vid;
    } else { data.url = val; }

    await push(ref(db, `queue/${currentCategory}`), data);
    await update(uRef, {
        balance: increment(-cost),
        [s.key]: increment(cost === 0 ? 1 : 0)
    });
    
    document.getElementById('inputUrl').value = "";
    alert("Promotion active! Your link is now live.");
};
