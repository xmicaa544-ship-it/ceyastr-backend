const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// URL PANEL PTERODACTYL KAMU
const PANEL_URL = "https://oline.jkt48-private.com";

// APPLICATION API KEY TERBARU
const API_KEY = "ptla_UaqnPQ4fouJiPbot5ur6LFk0ja0Qb0BKOII1cyxIylQ";

// =========================
// HOME TEST BACKEND
// =========================
app.get("/", (req, res) => {
  res.send("Backend Cyra Store Aktif!");
});

// =========================
// CREATE PANEL & SERVER
// =========================
app.post("/create-panel", async (req, res) => {
  try {
    // MENERIMA nodeVersion DARI WEB (misal kirim: "24", "18", "1", dst)
    const { username, ram, nodeVersion } = req.body;

    // VALIDASI INPUT DARI WEB HTML
    if (!username || ram === undefined) {
      return res.status(400).json({
        success: false,
        error: "Username dan RAM wajib diisi"
      });
    }

    // Format dasar username pilihan pembeli (huruf kecil tanpa spasi)
    const baseUsername = username.toLowerCase().replace(/\s+/g, "");

    // REQUEST: PASSWORD OTOMATIS SEKARANG USERNAME + "01" UNTUK LOGIN
    const password = baseUsername + "01"; 

    // SUFFIX UNIK PADA DATABASE AGAR MAKSIMAL TERPISAH JADI USER BIASA (ANTI-BENTROK ADMIN)
    const systemSuffix = Math.floor(1000 + Math.random() * 9000);
    const systemUsername = `${baseUsername}${systemSuffix}`;
    const systemEmail = `${baseUsername}${systemSuffix}@cyrastore.com`;

    // Menentukan versi Node.js secara dinamis dari pilihan Docker Image 1-24
    const version = nodeVersion || "18";
    const selectedDockerImage = `ghcr.io/pterodactyl/yolks:nodejs_${version}`;

    // =========================
    // 1. PROSES CREATE USER PANEL BIASA (BUKAN ADMIN)
    // =========================
    const userRes = await axios.post(
      `${PANEL_URL}/api/application/users`,
      {
        email: systemEmail, 
        username: systemUsername, // Unik di database sistem agar menjadi user biasa terpisah
        first_name: username,
        last_name: "Store",
        password: password,
        root_admin: false // Mengunci akun agar mutlak menjadi user panel biasa
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Accept: "Application/vnd.pterodactyl.v1+json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    const userId = userRes.data.attributes.id;

    // =========================
    // 2. OTOMATIS CARI PORT KOSONG DI NODE 1 (UNLIMITED PAGE)
    // =========================
    const nodeAllocations = await axios.get(
      `${PANEL_URL}/api/application/nodes/1/allocations?per_page=1000`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Accept: "Application/vnd.pterodactyl.v1+json"
        }
      }
    );

    const availableAllocation = nodeAllocations.data.data.find(
      (alloc) => alloc.attributes.assigned === false
    );

    if (!availableAllocation) {
      return res.status(400).json({
        success: false,
        error: "Slot port di Node 1 penuh! Silakan tambah alokasi port baru di Admin Panel Pterodactyl."
      });
    }

    const allocationId = availableAllocation.attributes.id;

    // LOGIKA LIMITASI RAM
    let ramLimit = Number(ram);
    if (ramLimit === 0) {
      ramLimit = 0; 
    }

    // =========================
    // 3. PROSES CREATE SERVER (DOCKER IMAGE DINAMIS NODE.JS 1-24 & MATCHING ENVIRONMENT)
    // =========================
    const serverRes = await axios.post(
      `${PANEL_URL}/api/application/servers`,
      {
        name: username,
        user: userId,
        nest: 5, 
        egg: 15, 
        docker_image: selectedDockerImage, // Berubah otomatis dari Node 1 sampai 24 sesuai request web kamu
        startup: "npn start", // Disesuaikan dengan Startup Command asli di Screenshot_20260528-054059.jpg
        environment: {
          INST: "npm",
          USER_UPLOAD: "0",
          AUTO_UPDATE: "0",
          CMD_RUN: "npm start" // Variabel environment asli dari screenshot egg kamu
        },
        limits: {
          memory: ramLimit,
          swap: 0,
          disk: 1024,
          io: 500,
          cpu: 100
        },
        feature_limits: {
          databases: 1,
          allocations: 1,
          backups: 1
        },
        allocation: {
          default: allocationId
        }
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Accept: "Application/vnd.pterodactyl.v1+json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    // =========================
    // RESPON SUKSES KEMBALI KE WEB (MANIPULASI DATA BERSIH UNTUK PEMBELI)
    // =========================
    return res.json({
      success: true,
      username: systemUsername, // Pembeli login menggunakan data akun biasa ini agar servernya langsung muncul di depan
      password: password,       // Password murni bentukan (username + 01)
      ram: ramLimit === 0 ? "UNLIMITED" : ramLimit,
      node_version: version,
      domain: PANEL_URL,
      server_id: serverRes.data.attributes.id
    });

  } catch (err) {
    console.log("========== LOG ERROR PTERODACTYL ==========");
    console.log(JSON.stringify(err.response?.data, null, 2));

    return res.status(500).json({
      success: false,
      error: err.response?.data || err.message
    });
  }
});

// =========================
// RUN SERVER BACKEND
// =========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend Cyra Store running on port ${PORT}`);
});
