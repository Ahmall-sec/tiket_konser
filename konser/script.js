const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusText = document.getElementById("status");
const progress = document.getElementById("progress");
const notif = document.getElementById("notif");
const submitBtn = document.getElementById("submitBtn");

let frames = [];
let currentStep = 0;
const steps = [
  "Hadapkan wajah ke depan",
  "Putar kepala ke kiri",
  "Putar kepala ke kanan",
  "Angkat sedikit kepala",
];

// 🎥 Akses Kamera
navigator.mediaDevices
  .getUserMedia({ video: { width: 400, height: 300 } })
  .then((stream) => {
    video.srcObject = stream;
  })
  .catch((err) => {
    console.error("Error akses kamera: ", err);
    statusText.innerText = "❌ Gagal mengakses kamera.";
  });

function startScan() {
  frames = [];
  currentStep = 0;
  progress.style.width = "0%";
  notif.style.display = "none";
  submitBtn.disabled = true;
  nextStep();
}

function nextStep() {
  if (currentStep >= steps.length) {
    statusText.innerText = "✅ Scan selesai!";
    notif.style.display = "block";
    submitBtn.disabled = false;
    submitBtn.style.background = "#22c55e";
    return;
  }

  statusText.innerText = steps[currentStep];
  let percent = ((currentStep + 1) / steps.length) * 100;
  progress.style.width = percent + "%";

  setTimeout(() => {
    captureFrame();
    currentStep++;
    nextStep();
  }, 2000); // Jeda antar scan
}

function captureFrame() {
  if (!video.videoWidth) return;
  const ctx = canvas.getContext("2d");
  canvas.width = 400;
  canvas.height = (video.videoHeight / video.videoWidth) * 400;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(
    (blob) => {
      const file = new File([blob], `face_${frames.length}.jpg`, {
        type: "image/jpeg",
      });
      frames.push(file);
    },
    "image/jpeg",
    0.7,
  );
}

async function submitData() {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const phone = document.getElementById("phone").value;
  const ticketCategory = document.getElementById("ticketCategory").value;

  // Proteksi Logika: Paksa Quantity menjadi 1
  if (!name || !email || !phone || !ticketCategory || frames.length === 0) {
    alert("❌ Data tidak lengkap atau belum scan wajah!");
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("email", email);
  formData.append("phone", phone);
  formData.append("ticketQuantity", 1); // Kunci 1 tiket untuk 1 wajah
  formData.append("ticketCategory", ticketCategory);

  frames.forEach((file) => {
    formData.append("frames", file);
  });

  const resultEl = document.getElementById("result");
  submitBtn.disabled = true;
  resultEl.innerText = "⏳ Memproses pendaftaran...";

  try {
    const res = await fetch("/register", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (res.ok && data.status === "success") {
      resultEl.innerText = `✅ Sukses! Tiket atas nama ${data.name} berhasil dipesan.`;
      resultEl.style.color = "green";
    } else {
      resultEl.innerText = `❌ Gagal: ${data.message || "Terjadi kesalahan"}`;
      resultEl.style.color = "red";
    }
  } catch (err) {
    resultEl.innerText = "❌ Gagal koneksi ke server.";
    console.error(err);
  } finally {
    submitBtn.disabled = false;
  }
}
