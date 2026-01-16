import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, doc, setDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
let player;

// --- 1. YouTube Player Logic ---
window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: '', 
        playerVars: { 'autoplay': 1, 'mute': 0 },
        events: {
            'onReady': onPlayerReady
        }
    });
};

function onPlayerReady() {
    // Listen for current video changes in Firestore
    onSnapshot(doc(db, "status", "current"), (doc) => {
        if (doc.exists()) {
            const videoId = doc.data().videoId;
            player.loadVideoById(videoId);
        }
    });
}

// --- 2. Helper: Extract ID ---
function extractId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// --- 3. Add to Firestore Queue ---
document.getElementById('addBtn').addEventListener('click', async () => {
    const input = document.getElementById('videoUrl');
    const vidId = extractId(input.value);

    if (vidId) {
        await addDoc(collection(db, "queue"), {
            videoId: vidId,
            createdAt: Date.now()
        });
        input.value = "";
    } else {
        alert("Invalid YouTube URL");
    }
});

// --- 4. Global Skip / Play Next ---
document.getElementById('nextBtn').addEventListener('click', async () => {
    const q = query(collection(db, "queue"), orderBy("createdAt", "asc"), limit(1));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        const nextVideoDoc = querySnapshot.docs[0];
        const nextVideoData = nextVideoDoc.data();

        // Update the global "current" status
        await setDoc(doc(db, "status", "current"), {
            videoId: nextVideoData.videoId
        });

        // Delete from queue
        await deleteDoc(doc(db, "queue", nextVideoDoc.id));
    } else {
        alert("Queue is empty!");
    }
});

// --- 5. Sync Table UI ---
onSnapshot(query(collection(db, "queue"), orderBy("createdAt", "asc")), (snapshot) => {
    const tbody = document.getElementById('queueBody');
    tbody.innerHTML = "";
    
    snapshot.forEach((doc, index) => {
        const data = doc.data();
        const row = `<tr>
            <td>${index + 1}</td>
            <td>${data.videoId}</td>
            <td>Waiting...</td>
        </tr>`;
        tbody.innerHTML += row;
    });
});
