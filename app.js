
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
    yt_watch:   { label: "Watch Video", reward: 0.01, time: 30, free: 100, paid: 550, cost: 5, db: 'f_yt_w' },
    yt_sub:     { label: "Subscribe", reward: 0.03, time: 30, free: 50, paid: 260, cost: 5, db: 'f_yt_s' },
    fb_follow:  { label: "FB Follow", reward: 0.01, time: 30, free: 100, paid: 550, cost: 5, db: 'f_fb_f' },
    web_visit:  { label: "Visit Site", reward: 0.01, time: 15, free: 100, paid: 550, cost: 5, db: 'f_web' },
    admin_any:  { label: "Admin Promo", reward: 0.03, time: 20, free: 10000, paid: 10000, cost: 0, db: 'admin' }
};

const user = tg.initDataUnsafe?.user || { id: "demo_user", username: "Guest" };
let curCat = 'yt_watch';
let userData = {};
let player = null;
let timerInt = null;

// Sync Data
onValue(ref(db, 'users/' + user.id), (s) => {
    userData = s.val() || { balance: 0, completed: {}, clicks: 0 };
    document.getElementById('userBalance').innerText = (userData.balance || 0).toFixed(2);
    renderAllTasks();
});

// View Navigation
const views = ['viewTasks', 'viewAdd', 'viewProfile'];
const tabs = ['tabTasks', 'tabAdd', 'tabProfile'];

tabs.forEach((tab, i) => {
    document.getElementById(tab).onclick = () => {
        views.forEach((v, j) => {
            document.getElementById(v).classList.toggle('hidden', i !== j);
            document.getElementById(tabs[j]).classList.toggle('tab-active', i === j);
            document.getElementById(tabs[j]).classList.toggle('text-slate-500', i !== j);
        });
        if(tab === 'tabProfile') renderProfile();
        if(tab === 'tabAdd') refreshAddLinkView();
    };
});

window.changeCat = (c) => {
    curCat = c;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('cat-active', b.innerText.toLowerCase().includes(c.split('_')[1])));
    refreshAddLinkView();
};

function refreshAddLinkView() {
    const c = CONFIG[curCat];
    const used = userData[c.db] || 0;
    document.getElementById('formTitle').innerText = `Add ${c.label}`;
    document.getElementById('slotBadge').innerText = `${Math.max(0, 5-used)} Free Slots Left`;
}

// Display ALL tasks
function renderAllTasks() {
    const container = document.getElementById('queueContainer');
    onValue(ref(db, `queue`), (snap) => {
        container.innerHTML = "";
        snap.forEach(catSnap => {
            const catKey = catSnap.key;
            catSnap.forEach(taskSnap => {
                const task = taskSnap.val();
                if (userData.completed?.[taskSnap.key] || task.rem <= 0) return;

                const div = document.createElement('div');
                div.className = "bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between";
                div.innerHTML = `
                    <div>
                        <p class="text-[9px] text-blue-400 font-bold uppercase">@${task.owner}</p>
                        <p class="text-[10px] text-slate-400 font-black uppercase">${CONFIG[catKey].label}</p>
                        <p class="text-xs font-bold">${task.rem} left</p>
                    </div>
                    <button onclick="startTask('${catKey}', '${taskSnap.key}', '${task.vid || task.url}')" class="bg-red-600 text-[10px] font-black px-5 py-2 rounded-xl">OPEN</button>
                `;
                container.appendChild(div);
            });
        });
    });
}

// EXECUTION LOGIC
window.startTask = (cat, key, target) => {
    const c = CONFIG[cat];
    let time = c.time;
    const page = document.getElementById('execPage');
    const timerEl = document.getElementById('execTimer');
    
    page.style.display = 'flex';
    timerEl.innerText = time;
    document.getElementById('execTitle').innerText = c.label;
    document.getElementById('execReward').innerText = `₱${c.reward} Reward`;

    // Hide all exec containers
    ['ytExec', 'webExec', 'fbExec'].forEach(id => document.getElementById(id).classList.add('hidden'));

    if (cat.startsWith('yt')) {
        document.getElementById('ytExec').classList.remove('hidden');
        if (!player) {
            player = new YT.Player('player', {
                videoId: target, height: '100%', width: '100%',
                playerVars: { autoplay: 1, controls: 0 },
                events: { onStateChange: (e) => { if(e.data === 1) startTimer(); else stopTimer(); }}
            });
        } else { player.loadVideoById(target); }
    } 
    else if (cat === 'web_visit') {
        document.getElementById('webExec').classList.remove('hidden');
        document.getElementById('webFrame').src = target;
        document.getElementById('webInteraction').classList.remove('hidden');
        document.getElementById('btnWebStart').onclick = () => {
            document.getElementById('webInteraction').classList.add('hidden');
            startTimer();
        };
    } 
    else {
        // Facebook / Others
        document.getElementById('fbExec').classList.remove('hidden');
        tg.openLink(target); // Immediately open FB link
        startTimer();
    }

    function startTimer() {
        if (timerInt) return;
        timerInt = setInterval(() => {
            time--;
            timerEl.innerText = time;
            if (time <= 0) finishTask(cat, key, target);
        }, 1000);
    }
    function stopTimer() { clearInterval(timerInt); timerInt = null; }
};

async function finishTask(cat, key, target) {
    clearInterval(timerInt); timerInt = null;
    const c = CONFIG[cat];

    await update(ref(db, 'users/' + user.id), {
        balance: increment(c.reward),
        [`completed/${key}`]: true,
        clicks: increment(1)
    });

    const tRef = ref(db, `queue/${cat}/${key}`);
    const snap = await get(tRef);
    if (snap.exists()) {
        const rem = snap.val().rem - 1;
        if (rem <= 0) await set(tRef, null);
        else await update(tRef, { rem: rem });
    }

    // Ad Logic
    if (((userData.clicks || 0) + 1) % 10 === 0) {
        if (window.Adsgram) window.Adsgram.init({ blockId: "24438" }).show().catch(() => window.show_10555663?.());
    }

    // Final Redirect for YouTube
    if (cat.startsWith('yt')) {
        tg.openLink(`https://youtube.com/watch?v=${target}`);
    }

    document.getElementById('execPage').style.display = 'none';
    alert("Task Completed! Reward added to wallet.");
}

// Youtube Link Logic
function getYTId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?)|(shorts\/)|(\?v=)|(&v=))([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[10].length == 11) ? match[10] : false;
}

document.getElementById('btnSubmit').onclick = async () => {
    const val = document.getElementById('inputUrl').value;
    if (!val) return;
    
    const c = CONFIG[curCat];
    const used = userData[c.db] || 0;
    let cost = (used >= 5) ? c.cost : 0;
    let limit = (used >= 5) ? c.paid : c.free;

    if (userData.balance < cost) return alert("Insufficient Balance Work for 5 Peso!");

    const promo = { owner: user.username, ownerId: user.id, rem: limit, ts: Date.now() };

    if (curCat.startsWith('yt')) {
        const id = getYTId(val);
        if(!id) return alert("Invalid YouTube URL");
        promo.vid = id;
    } else { promo.url = val; }

    await push(ref(db, `queue/${curCat}`), promo);
    await update(ref(db, 'users/' + user.id), {
        balance: increment(-cost),
        [c.db]: increment(cost === 0 ? 1 : 0)
    });
    
    document.getElementById('inputUrl').value = "";
    alert("Success! Your link is now live.");
};

function renderProfile() {
    const list = document.getElementById('myLinksList');
    list.innerHTML = "";
    get(ref(db, 'queue')).then(snap => {
        snap.forEach(catSnap => {
            catSnap.forEach(taskSnap => {
                const task = taskSnap.val();
                if(task.ownerId === user.id) {
                    const div = document.createElement('div');
                    div.className = "bg-slate-900 border border-slate-800 p-4 rounded-2xl";
                    div.innerHTML = `
                        <div class="flex justify-between text-[10px] font-black uppercase mb-1">
                            <span class="text-slate-500">${CONFIG[catSnap.key].label}</span>
                            <span class="text-green-500">${task.rem} left</span>
                        </div>
                        <p class="text-xs truncate text-slate-400">${task.vid || task.url}</p>
                    `;
                    list.appendChild(div);
                }
            });
        });
    });
}
