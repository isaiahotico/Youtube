/* ================= TELEGRAM ================= */
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

if (!tg.initDataUnsafe?.user) {
  document.body.innerHTML = "<h3 style='text-align:center'>Open from Telegram</h3>";
  throw new Error("Not Telegram");
}

const tgUser = tg.initDataUnsafe.user;
document.getElementById("userBar").innerText =
  "👤 " + (tgUser.username ? `@${tgUser.username}` : tgUser.first_name);

/* ================= FIREBASE ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAj6o2HbMEC472gDoNuFSDmdOSJj8k9S_U",
  authDomain: "fir-493d0.firebaseapp.com",
  projectId: "fir-493d0",
  storageBucket: "fir-493d0.firebasestorage.app",
  messagingSenderId: "935141131610",
  appId: "1:935141131610:web:7998e21d07d7b4c71b5f63"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================= YOUTUBE ================= */
let player;
let playlist = [];
let currentIndex = 0;
let loopMode = false;
let shuffleMode = false;

window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player("player", {
    events: { onStateChange }
  });
};

function onStateChange(e) {
  if (e.data === YT.PlayerState.ENDED) nextVideo();
}

function nextVideo() {
  if (loopMode) {
    player.playVideo();
    return;
  }

  if (shuffleMode) {
    currentIndex = Math.floor(Math.random() * playlist.length);
  } else {
    currentIndex++;
    if (currentIndex >= playlist.length) currentIndex = 0;
  }

  const next = playlist[currentIndex];
  if (next) player.loadVideoById(next.videoId);
}

/* ================= HELPERS ================= */
function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/* ================= PLAYLIST ================= */
window.addToPlaylist = async () => {
  const url = ytUrl.value;
  const videoId = extractVideoId(url);
  if (!videoId) return alert("Invalid YouTube URL");

  await addDoc(collection(db, "playlists"), {
    videoId,
    order: Date.now(),
    addedBy: tgUser.id
  });

  ytUrl.value = "";
};

window.playVideo = (index) => {
  currentIndex = index;
  player.loadVideoById(playlist[index].videoId);
};

window.deleteVideo = async (id) => {
  await deleteDoc(doc(db, "playlists", id));
};

onSnapshot(
  query(collection(db, "playlists"), orderBy("order")),
  snap => {
    playlist = [];
    playlistEl.innerHTML = "";

    snap.forEach((d) => {
      const data = d.data();
      playlist.push({ ...data, id: d.id });

      const row = document.createElement("div");
      row.innerHTML = `
        <span onclick="playVideo(${playlist.length - 1})">
          ▶ ${data.videoId}
        </span>
        <button onclick="deleteVideo('${d.id}')">❌</button>
      `;

      row.draggable = true;
      row.ondragend = async () => {
        await updateDoc(doc(db, "playlists", d.id), { order: Date.now() });
      };

      playlistEl.appendChild(row);
    });
  }
);

/* ================= LOOP / SHUFFLE ================= */
window.toggleLoop = () => {
  loopMode = !loopMode;
  loopBtn.classList.toggle("active", loopMode);
};

window.toggleShuffle = () => {
  shuffleMode = !shuffleMode;
  shuffleBtn.classList.toggle("active", shuffleMode);
};
