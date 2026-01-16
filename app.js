import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, set, remove, query, limitToFirst, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAj6o2HbMEC472gDoNuFSDmdOSJj8k9S_U",
  authDomain: "fir-493d0.firebaseapp.com",
  projectId: "fir-493d0",
  storageBucket: "fir-493d0.firebasestorage.app",
  messagingSenderId: "935141131610",
  appId: "1:935141131610:web:7998e21d07d7b4c71b5f63"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const queueRef = ref(db, 'videoQueue');
const currentVideoRef = ref(db, 'currentVideo');

let player;

// 1. Initialize YouTube Player
// Note: This must be on the window object for the YT API to find it
window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: '', // Initially empty
        playerVars: { 'autoplay': 1, 'playsinline': 1 },
        events: {
            'onReady': onPlayerReady
        }
    });
};

function onPlayerReady() {
    // Listen for the "Current Video" in Firebase. 
    // If it changes for one person, it changes for EVERYONE.
    onValue(currentVideoRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.videoId) {
            player.loadVideoById(data.videoId);
        }
    });
}

// 2. Helper: Extract Video ID from various YouTube URL formats
function getYouTubeID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// 3. Button Event: Add Video to Firebase Queue
document.getElementById('addBtn').addEventListener('click', () => {
    const urlInput = document.getElementById('videoUrl');
    const vidId = getYouTubeID(urlInput.value);

    if (vidId) {
        push(queueRef, {
            videoId: vidId,
            addedAt: Date.now()
        });
        urlInput.value = "";
    } else {
        alert("Invalid YouTube URL");
    }
});

// 4. Button Event: Play Next (Global Sync)
document.getElementById('nextBtn').addEventListener('click', async () => {
    // Fetch the first item in the queue
    const firstItemQuery = query(queueRef, limitToFirst(1));
    const snapshot = await get(firstItemQuery);

    if (snapshot.exists()) {
        const data = snapshot.val();
        const key = Object.keys(data)[0];
        const nextVideo = data[key];

        // 1. Set the global current video
        set(currentVideoRef, { videoId: nextVideo.videoId });

        // 2. Remove that video from the queue
        remove(ref(db, `videoQueue/${key}`));
    } else {
        alert("No more videos in the queue!");
    }
});

// 5. Listener: Update UI Table when Queue changes
onValue(queueRef, (snapshot) => {
    const queueBody = document.getElementById('queueBody');
    queueBody.innerHTML = "";
    const data = snapshot.val();

    if (data) {
        let count = 1;
        for (let key in data) {
            const row = `<tr>
                <td>${count}</td>
                <td>${data[key].videoId}</td>
                <td><span style="color: #aaa;">Waiting...</span></td>
            </tr>`;
            queueBody.innerHTML += row;
            count++;
        }
    } else {
        queueBody.innerHTML = "<tr><td colspan='3' style='text-align:center'>The queue is empty.</td></tr>";
    }
});
