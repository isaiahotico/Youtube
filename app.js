
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

// CONFIGURATION
const TASK_CONFIG = {
    yt_watch:   { name: "YT Watch", reward: 0.01, time: 30, freeCap: 100, paidCap: 550, cost: 5, dbKey: 'f_yt_w' },
    yt_sub:     { name: "YT Subscribe", reward: 0.03, time: 30, freeCap: 50,  paidCap: 65,  cost: 7, dbKey: 'f_yt_s' },
    yt_like:    { name: "YT Like", reward: 0.01, time: 30, freeCap: 100, paidCap: 550, cost: 5, dbKey: 'f_yt_l' },
    yt_comm:    { name: "YT Comment", reward: 0.01, time: 30, freeCap: 100, paidCap: 550, cost: 5, dbKey: 'f_yt_c' },
    fb_follow:  { name: "FB Follow", reward: 0.01, time: 30, freeCap: 100, paidCap: 550, cost: 5, dbKey: 'f_fb_f' },
    fb_like:    { name: "FB Like Post", reward: 0.01, time: 20, freeCap: 100, paidCap: 550, cost: 5, dbKey: 'f_fb_l' },
    web_visit:  { name: "Visit Website", reward: 0.01, time: 15, freeCap: 100, paidCap: 550, cost: 5, dbKey: 'f_web' },
    playstore:  { name: "Playstore Visit", reward: 0.015, time: 20, freeCap: 100, paidCap: 550, cost: 5, dbKey: 'f_ps' },
    admin_any:  { name: "Admin Promo", reward: 0.03, time: 20, freeCap: 10000, paidCap: 10000, cost: 0, dbKey: 'admin' }
};

const user = tg.initDataUnsafe?.user || { id: "user_test", username: "Tester" };
let curCat = 'yt_watch';
let userData = {};
let ytPlayer = null;
let timerLoop = null;

// SYNC USER
const uRef = ref(db, 'users/' + user.id);
onValue(uRef, (snap) => {
    userData = snap.val() || { balance: 0, completed: {}, username: user.username, totalClicks: 0 };
    if (!snap.exists()) set(uRef, userData);
    document.getElementById('userBalance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('tgUsername').innerText = `@${user.username}`;
    refreshView();
});

// NAVIGATION
document.getElementById('btnTasks').onclick = () => {
    toggleView('tasks');
};
document.getElementById('btnProfile').onclick = () => {
    toggleView('profile');
    renderUserProfileLinks();
};

function toggleView(view) {
    const isTasks = view === 'tasks';
    document.getElementById('viewTasks').classList.toggle('hidden', !isTasks);
    document.getElementById('viewProfile').classList.toggle('hidden', isTasks);
    document.getElementById('btnTasks').className = `flex-1 py-3 text-xs font-black ${isTasks ? 'tab-active' : 'text-slate-500'}`;
    document.getElementById('btnProfile').className = `flex-1 py-3 text-xs font-black ${!isTasks ? 'tab-active' : 'text-slate-500'}`;
}

window.setCat = (c) => {
    curCat = c;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('cat-active'));
    event.target.classList.add('cat-active');
    refreshView();
};

window.adminAccess = () => {
    if(prompt("Enter Admin PW:") === "Propetas12") setCat('admin_any');
};

function refreshView() {
    const conf = TASK_CONFIG[curCat];
    const used = userData[conf.dbKey] || 0;
    document.getElementById('catLabel').innerText = conf.name;
    document.getElementById('slotDisplay').innerText = (curCat === 'admin_any') ? 'ADMIN MODE' : `${Math.max(0, 5-used)} FREE SLOTS LEFT`;
    renderQueue();
}

// QUEUE & PROFILE RENDERER
function renderQueue() {
    const list = document.getElementById('taskList');
    onValue(ref(db, `queue/${curCat}`), (snap) => {
        list.innerHTML = "";
        let count = 0;
        snap.forEach(child => {
            const item = child.val();
            if (userData.completed?.[child.key]) return;
            if (item.rem <= 0) return;

            const div = document.createElement('div');
            div.className = "bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between";
            div.innerHTML = `
                <div>
                    <p class="text-[9px] text-blue-400 font-bold uppercase tracking-widest">by @${item.owner}</p>
                    <p class="text-xs font-black text-slate-200">${item.rem} slots remaining</p>
                </div>
                <button onclick="startTask('${child.key}', '${item.target}')" class="bg-red-600 text-[10px] font-black px-6 py-2 rounded-xl">OPEN TASK</button>
            `;
            list.appendChild(div);
            count++;
        });
        if (count === 0) list.innerHTML = `<p class="text-center text-slate-600 text-xs py-10 italic">No tasks available here.</p>`;
    });
}

function renderUserProfileLinks() {
    const cont = document.getElementById('myLinksContainer');
    cont.innerHTML = `<p class="text-center text-xs text-slate-500 py-10">Scanning your promotions...</p>`;
    
    let html = "";
    let found = 0;
    Object.keys(TASK_CONFIG).forEach(catKey => {
        get(ref(db, `queue/${catKey}`)).then(snap => {
            snap.forEach(child => {
                const item = child.val();
                if (item.ownerId === user.id) {
                    found++;
                    html += `
                        <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                            <div class="flex justify-between items-start mb-2">
                                <span class="bg-slate-800 text-slate-400 text-[8px] px-2 py-0.5 rounded font-black uppercase">${TASK_CONFIG[catKey].name}</span>
                                <span class="text-green-500 text-[10px] font-black">${item.rem} REMAINING</span>
                            </div>
                            <p class="text-[10px] text-slate-500 truncate">${item.target}</p>
                        </div>`;
                    cont.innerHTML = html;
                }
            });
            if (found === 0) cont.innerHTML = `<p class="text-center text-xs text-slate-500 py-10">You haven't added any links yet.</p>`;
        });
    });
}

// TASK EXECUTION
window.startTask = (key, target) => {
    const conf = TASK_CONFIG[curCat];
    let time = conf.time;
    const modal = document.getElementById('modalAction');
    const timerText = document.getElementById('timerValue');
    
    modal.classList.remove('hidden');
    timerText.innerText = time;

    const isYT = curCat.startsWith('yt');
    if (isYT) {
        document.getElementById('ytPlayerBox').classList.remove('hidden');
        document.getElementById('otherNotice').classList.add('hidden');
        if (!ytPlayer) {
            ytPlayer = new YT.Player('player', {
                videoId: target, height: '100%', width: '100%',
                playerVars: { autoplay: 1, controls: 0, disablekb: 1 },
                events: { onStateChange: (e) => { if(e.data === 1) runTimer(); else stopTimer(); }}
            });
        } else { ytPlayer.loadVideoById(target); }
    } else {
        document.getElementById('ytPlayerBox').classList.add('hidden');
        document.getElementById('otherNotice').classList.remove('hidden');
        runTimer();
    }

    function runTimer() {
        if (timerLoop) return;
        timerLoop = setInterval(() => {
            time--;
            timerText.innerText = time;
            if (time <= 0) finalize(key, target);
        }, 1000);
    }
    function stopTimer() { clearInterval(timerLoop); timerLoop = null; }
};

async function finalize(key, target) {
    clearInterval(timerLoop); timerLoop = null;
    const conf = TASK_CONFIG[curCat];

    // 1. Reward & Logic Mark
    await update(uRef, { 
        balance: increment(conf.reward),
        [`completed/${key}`]: true,
        totalClicks: increment(1)
    });

    // 2. Decrement Queue
    const taskRef = ref(db, `queue/${curCat}/${key}`);
    const snap = await get(taskRef);
    if (snap.exists()) {
        const left = snap.val().rem - 1;
        if (left <= 0) await set(taskRef, null);
        else await update(taskRef, { rem: left });
    }

    // 3. Ad Trigger (Every 10)
    const clicks = (userData.totalClicks || 0) + 1;
    if (clicks % 10 === 0) {
        if (window.Adsgram) {
            window.Adsgram.init({ blockId: "24438" }).show().catch(() => {
                if(window.show_10555663) window.show_10555663();
            });
        }
    }

    // 4. Close & Open Link
    const link = curCat.startsWith('yt') ? `https://youtube.com/watch?v=${target}` : target;
    tg.openLink(link);
    document.getElementById('modalAction').classList.add('hidden');
}

// SUBMISSION LOGIC
document.getElementById('submitLink').onclick = async () => {
    const val = document.getElementById('linkUrl').value;
    if (!val) return;
    
    const conf = TASK_CONFIG[curCat];
    const used = userData[conf.dbKey] || 0;
    
    let cost = 0;
    let limit = conf.freeCap;

    if (curCat !== 'admin_any' && used >= 5) {
        cost = conf.cost;
        limit = conf.paidCap;
        const proceed = confirm(`Free slots used! To add this promotion, it will cost ₱${cost}.00 for ${limit} clicks. Proceed?`);
        if (!proceed) return;
    }

    if (userData.balance < cost) return alert(`Insufficient Balance! You need ₱${cost}.00`);

    const data = {
        owner: user.username,
        ownerId: user.id,
        rem: limit,
        target: extractTarget(val),
        ts: Date.now()
    };

    if (curCat.startsWith('yt') && data.target.length > 15) return alert("Invalid YouTube link");

    await push(ref(db, `queue/${curCat}`), data);
    await update(uRef, {
        balance: increment(-cost),
        [conf.dbKey]: increment(cost === 0 ? 1 : 0)
    });
    
    document.getElementById('linkUrl').value = "";
    alert("Successfully added to queue!");
};

function extractTarget(url) {
    if (curCat.startsWith('yt')) {
        return url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^& \n<]+)/)?.[1] || url;
    }
    return url;
}
