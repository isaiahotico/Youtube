import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, doc, setDoc, deleteDoc, getDocs } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your Firebase configuration
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
const db = getFirestore(app);
let player;

// 1. YouTube Player API - Initialize the player
window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: '', // Initially empty
        playerVars: { 'autoplay': 1, 'rel': 0 },
        events: {
            'onReady': onPlayerReady
        }
    });
};

function onPlayerReady() {
    // Listen for the "Global Current Video" in Firestore
    onSnapshot(doc(db, "status", "current"), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            player.loadVideoById(data.videoId);
        }
    });
}

// 2. Extract Video ID helper
function extractID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// 3. Button: Add video to Firestore queue
document.getElementById('addBtn').onclick = async () => {
    const input = document.getElementById('videoUrl');
    const vId = extractID(input.value);

    if (vId) {
        await addDoc(collection(db, "queue"), {
            videoId: vId,
            timestamp: Date.now()
        });
        input.value = "";
    } else {
        alert("Invalid YouTube URL");
    }
};

// 4. Button: Global Next (Changes for all users)
document.getElementById('nextBtn').onclick = async () => {
    // Query the oldest video in the queue
    const q = query(collection(db, "queue"), orderBy("timestamp", "asc"), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        const nextDoc = snapshot.docs[0];
        const nextData = nextDoc.data();

        // Set this video as the global "current" video
        await setDoc(doc(db, "status", "current"), {
            videoId: nextData.videoId
        });

        // Delete it from the queue
        await deleteDoc(doc(db, "queue", nextDoc.id));
    } else {
        alert("The queue is empty!");
    }
};

// 5. Update the UI Table in real-time
const queueQuery = query(collection(db, "queue"), orderBy("timestamp", "asc"));
onSnapshot(queueQuery, (snapshot) => {
    const tbody = document.getElementById('queueBody');
    tbody.innerHTML = "";

    if (snapshot.empty) {
        tbody.innerHTML = "<tr><td colspan='3' class='no-videos'>No videos in queue</td></tr>";
        return;
    }

    snapshot.forEach((doc, index) => {
        const data = doc.data();
        const row = `<tr>
            <td>${index + 1}</td>
            <td>${data.videoId}</td>
            <td><span style="color: #ff9800">Waiting...</span></td>
        </tr>`;
        tbody.innerHTML += row;
    });
});
