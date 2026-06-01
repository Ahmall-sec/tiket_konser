const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusText = document.getElementById("status");
const resultContainer = document.getElementById("resultContainer");

let socket;
let isVerifying = false;
let isProcessing = false;
let failCount = 0;
const MAX_FAILS = 3;

// 🎥 Akses Kamera Secara Stabil
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 400, height: 300 },
    });
    video.srcObject = stream;
    console.log("✅ Kamera Aktif");
  } catch (err) {
    console.error("Gagal kamera:", err);
    statusText.innerText = "❌ Izin kamera ditolak.";
  }
}

function initSocket() {
  let socket = new WebSocket(
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`
);

  socket.onopen = () => {
    isVerifying = true;
    statusText.innerText = "📸 Memindai wajah... Hadapkan ke kamera.";
    processLoop();
  };

  socket.onmessage = (event) => {
    isProcessing = false; // Buka kunci pengiriman frame selanjutnya
    const data = JSON.parse(event.data);

    if (data.status === "success") {
      isVerifying = false;
      showResult(data.user);
    } else {
      failCount++;
      statusText.innerText = `⏳ Mencari data... (${failCount}/${MAX_FAILS})`;
      if (failCount >= MAX_FAILS) {
        isVerifying = false;
        statusText.innerText = "⛔ TIKET TIDAK VALID / DATA TIDAK ADA";
        statusText.style.color = "red";
      }
    }
  };

  socket.onclose = () => {
    isVerifying = false;
  };
}

function startScan() {
  if (isVerifying) return;
  failCount = 0;
  resultContainer.style.display = "none";
  statusText.style.color = "black";
  initSocket();
}

function processLoop() {
  if (!isVerifying) return;

  if (socket.readyState === 1 && !isProcessing) {
    isProcessing = true; // Kunci agar tidak spam frame ke server
    const ctx = canvas.getContext("2d");
    canvas.width = 300; // Kecilkan untuk kecepatan
    canvas.height = (video.videoHeight / video.videoWidth) * 300;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataURL = canvas.toDataURL("image/jpeg", 0.5); // Kualitas 0.5 agar ringan
    socket.send(dataURL);
  }
  requestAnimationFrame(processLoop);
}

function showResult(user) {
  statusText.innerText = "✅ AKSES DIIZINKAN";
  statusText.style.color = "green";
  resultContainer.style.display = "block";
  resultContainer.innerHTML = `
    <div style="border: 2px solid green; padding: 15px; background: #e6ffed; border-radius: 10px;">
      <h4>Selamat Datang, ${user.name}!</h4>
      <p>Email: ${user.email}</p>
      <p>Kategori: ${user.category}</p>
    </div>
  `;
}

initCamera();
