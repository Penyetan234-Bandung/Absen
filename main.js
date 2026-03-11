        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getFirestore, collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, deleteDoc, doc, setDoc, getDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
        import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
        
        // --- KONFIGURASI FIREBASE ---
        const firebaseConfig = {
            apiKey: "AIzaSyCbJXTkQ-niZXqoO_2F3PErGj29om9tXXQ",
            authDomain: "presensi-6b9d5.firebaseapp.com",
            projectId: "presensi-6b9d5",
            storageBucket: "presensi-6b9d5.firebasestorage.app",
            messagingSenderId: "959624121628",
            appId: "1:959624121628:web:a07a719fa8a39c89bbfed9"
        };
        
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const auth = getAuth(app);
        let currentUser = null;
        let currentUserProfile = null; // Ini akan menyimpan divisi user
        
        // --- DATA KONSTAN ---
        const DIVISI_LIST = [
            'Customer Service', 'Kasir', 'Checker', 'Minuman',
            'Preparation', 'Sambal', 'Cp', 'Gorengan', 'Tumisan'
        ];
        
        const STATUS_LIST = [
            'Tepat Waktu', 'Tidak Hadir', 'Terlambat',
            'Remote', 'Cuti', 'Sppd', 'Sakit', 'Izin', 'Lembur', 'Libur/off'
        ];
        
        const menuItems = [
            { id: 'absensi', name: 'Absensi Harian', icon: 'briefcase', color: 'bg-green-500' },
            { id: 'aktivitas', name: 'Aktivitas', icon: 'file-text', color: 'bg-teal-500' },
            { id: 'pengumuman', name: 'Pengumuman', icon: 'megaphone', color: 'bg-lime-500' },
            { id: 'pengajuan', name: 'Pengajuan', icon: 'edit-3', color: 'bg-lime-600' },
            { id: 'tugas', name: 'Tugas', icon: 'layers', color: 'bg-blue-500' },
            { id: 'reimburse', name: 'Reimburse', icon: 'refresh-cw', color: 'bg-cyan-500' },
            { id: 'slip', name: 'Slip Gaji', icon: 'dollar-sign', color: 'bg-purple-600' },
            { id: 'jadwal', name: 'Jadwal Kerja', icon: 'clock', color: 'bg-pink-500' },
            { id: 'kuesioner', name: 'Kuesioner', icon: 'file-spreadsheet', color: 'bg-orange-500' },
            { id: 'pengaturan', name: 'Pengaturan', icon: 'settings', color: 'bg-gray-600' },
            { id: 'bantuan', name: 'Bantuan', icon: 'help-circle', color: 'bg-yellow-500' },
        ];
        
        // --- AUTH FUNCTIONS ---
        window.handleLogin = async () => {
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            if (!email || !password) return showToast("Isi email dan password");
            try {
                await signInWithEmailAndPassword(auth, email, password);
                showToast("Berhasil Masuk!");
            } catch (e) { showToast("Gagal: " + e.code); }
        };
        
        window.handleRegister = async () => {
            const nama = document.getElementById('reg-nama').value; // Ambil nilai nama
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const divisi = document.getElementById('reg-divisi').value;
            
            if (!nama || !email || !password || !divisi) return showToast("Isi semua data termasuk Nama dan Divisi");
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // Simpan profil user beserta NAMANYA ke Firestore
                await setDoc(doc(db, "users", user.uid), {
                    nama: nama, // <-- Simpan nama di sini
                    email: email,
                    divisi: divisi,
                    role: "Karyawan"
                });
                
                showToast("Pendaftaran Berhasil!");
            } catch (e) { showToast("Gagal Daftar: " + e.code); }
        };
        
        window.handleLogout = async () => {
            try {
                await signOut(auth);
                showToast("Anda telah keluar");
            } catch (e) {}
        };
        // --- PENGATURAN LOKASI KANTOR (GEOFENCING) ---
        // Kordinat untuk 3J8C+RM Malabar, Bandung (Silakan sesuaikan angka di belakang koma jika kurang akurat)
        const KANTOR_LAT = -6.924844;
        const KANTOR_LNG = 107.622617;
        const MAKSIMAL_JARAK_METER = 100; // Karyawan maksimal berjarak 50 meter dari titik kantor
        
        // Fungsi menghitung jarak antara 2 koordinat (Rumus Haversine)
        window.hitungJarak = (lat1, lon1, lat2, lon2) => {
            const R = 6371e3; // Radius bumi dalam meter
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c; // Hasil akhir berupa hitungan meter
        };
        
        // Fungsi menyalakan GPS dan membaca lokasi perangkat
        window.dapatkanLokasi = () => {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject("Browser/Perangkat Anda tidak mendukung fitur lokasi GPS.");
                } else {
                    navigator.geolocation.getCurrentPosition(
                        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
                        (error) => {
                            let msg = "Gagal mengambil lokasi.";
                            if (error.code === 1) msg = "Akses lokasi ditolak! Harap nyalakan GPS dan izinkan browser mengakses lokasi.";
                            if (error.code === 2) msg = "Sinyal GPS tidak ditemukan atau lemah.";
                            if (error.code === 3) msg = "Waktu tunggu pencarian GPS habis.";
                            reject(msg);
                        }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 } // Memaksa akurasi paling tinggi
                    );
                }
            });
        };
        // --- ABSENSI LOGIC ---
        window.handleAbsenAction = async (type) => {
            if (!currentUser) return showToast("Harus login!");
            const shiftVal = document.getElementById('shift-select').value;
            
            // --- 1. WAJIB CEK LOKASI GPS SEBELUM PROSES ---
            showToast("Mencari titik lokasi Anda...");
            let lokasiUser;
            try {
                lokasiUser = await dapatkanLokasi(); // Menunggu GPS menyala
                const jarak = hitungJarak(lokasiUser.lat, lokasiUser.lng, KANTOR_LAT, KANTOR_LNG);
                
                // Kalau jaraknya melebihi batas (50 meter), hentikan proses!
                if (jarak > MAKSIMAL_JARAK_METER) {
                    return showToast(`Gagal! Anda berjarak ${Math.round(jarak)}m dari kantor. (Maksimal ${MAKSIMAL_JARAK_METER}m)`);
                }
            } catch (errMsg) {
                // Kalau GPS mati atau belum diberi izin
                return showToast(errMsg);
            }
            
            // --- 2. CEK FORMAT TANGGAL HARI INI ---
            const divisiUser = currentUserProfile?.divisi || "Tidak Diketahui";
            const namaUser = currentUserProfile?.nama || currentUser.email.split('@')[0];
            const dateObj = new Date();
            const todayStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            
            // --- 3. CEK APAKAH SUDAH ABSEN HARI INI ---
            showToast("Memverifikasi data absen...");
            try {
                const qCek = query(collection(db, "absensi"), where("uid", "==", currentUser.uid), where("tanggal", "==", todayStr), where("tipe", "==", type));
                const snapCek = await getDocs(qCek);
                if (!snapCek.empty) return showToast(`Gagal: Kamu sudah ${type} hari ini!`);
            } catch (err) {
                console.error("Gagal mengecek data absen ganda:", err);
            }
            
            // --- 4. LOGIKA JADWAL & KETERLAMBATAN ---
            const jadwalShift = {
                "Shift Pagi": { masuk: { jam: 8, menit: 0 }, pulang: { jam: 16, menit: 0 } },
                "Shift S": { masuk: { jam: 12, menit: 0 }, pulang: { jam: 21, menit: 0 } },
                "Shift S1": { masuk: { jam: 10, menit: 0 }, pulang: { jam: 20, menit: 0 } },
                "Shift S2": { masuk: { jam: 12, menit: 0 }, pulang: { jam: 20, menit: 0 } },
                "Shift S3": { masuk: { jam: 12, menit: 0 }, pulang: { jam: 22, menit: 0 } },
                "Shift Malam": { masuk: { jam: 14, menit: 0 }, pulang: { jam: 22, menit: 0 } }
            };
            
            const shiftAktif = jadwalShift[shiftVal];
            if (!shiftAktif) return showToast("Pilih shift terlebih dahulu!");
            
            const waktuSekarang = new Date();
            const jamSekarang = waktuSekarang.getHours();
            const menitSekarang = waktuSekarang.getMinutes();
            const totalMenitSekarang = (jamSekarang * 60) + menitSekarang;
            let statusAbsen = "Tepat Waktu";
            
            if (type === 'Clock In') {
                const waktuMasuk = shiftAktif.masuk;
                const totalMenitMasuk = (waktuMasuk.jam * 60) + waktuMasuk.menit;
                if (totalMenitSekarang > (totalMenitMasuk + 5)) statusAbsen = "Terlambat";
            }
            else if (type === 'Clock Out') {
                const waktuPulang = shiftAktif.pulang;
                const totalMenitPulang = (waktuPulang.jam * 60) + waktuPulang.menit;
                if (totalMenitSekarang < totalMenitPulang) {
                    return showToast(`Belum bisa pulang! Jam pulang: ${waktuPulang.jam.toString().padStart(2, '0')}.${waktuPulang.menit.toString().padStart(2, '0')}`);
                }
                statusAbsen = "Sudah Pulang";
            }
            else if (type === 'Clock In Lembur') {
                const waktuPulang = shiftAktif.pulang;
                const totalMenitPulang = (waktuPulang.jam * 60) + waktuPulang.menit;
                if (totalMenitSekarang < totalMenitPulang) {
                    return showToast(`Belum waktunya lembur! Shift reguler berakhir jam ${waktuPulang.jam.toString().padStart(2, '0')}.${waktuPulang.menit.toString().padStart(2, '0')}`);
                }
                statusAbsen = "Lembur";
            }
            else if (type === 'Clock Out Lembur') {
                statusAbsen = "Selesai Lembur";
            }
            
            // --- 5. PROSES SIMPAN KE DATABASE (Beserta Koordinat GPS) ---
            showToast(`Mencatat ${type}...`);
            try {
                await addDoc(collection(db, "absensi"), {
                    tipe: type,
                    status: statusAbsen,
                    shift: shiftVal,
                    uid: currentUser.uid,
                    nama: namaUser,
                    email: currentUser.email,
                    divisi: divisiUser,
                    tanggal: todayStr,
                    lokasi: { lat: lokasiUser.lat, lng: lokasiUser.lng }, // Simpan rekam jejak koordinatnya!
                    waktu: serverTimestamp(),
                    device: navigator.userAgent
                });
                showToast(`${type} Berhasil!`);
            } catch (e) {
                showToast("Gagal simpan!");
            }
        };
        
        window.saveJadwal = async () => {
            if (!currentUser) return showToast("Harus login!");
            
            const tgl = document.getElementById('input-tgl').value;
            const pola = document.getElementById('input-pola').value;
            
            if (!tgl || !pola) return showToast("Pilih tanggal dan pola kerja (shift)!");
            
            showToast("Menyimpan jadwal...");
            try {
                // Menyimpan data jadwal ke koleksi "jadwal_kerja" di database
                await addDoc(collection(db, "jadwal_kerja"), {
                    uid: currentUser.uid,
                    tanggal: tgl,
                    pola_kerja: pola,
                    waktu_dibuat: serverTimestamp()
                });
                showToast("Jadwal berhasil disimpan!");
                renderSchedule(); // Refresh (muat ulang) tampilan jadwal
            } catch (e) {
                console.error(e);
                showToast("Gagal menyimpan jadwal!");
            }
        };
        
        window.deleteJadwal = async (id) => {
            // Memastikan ulang sebelum menghapus
            if (!confirm("Yakin ingin menghapus jadwal ini?")) return;
            
            try {
                // Menghapus dokumen spesifik dari database
                await deleteDoc(doc(db, "jadwal_kerja", id));
                showToast("Jadwal dihapus!");
                renderSchedule(); // Refresh (muat ulang) tampilan jadwal
            } catch (e) {
                console.error(e);
                showToast("Gagal menghapus jadwal!");
            }
        };
        
        // --- UI RENDERING ---
        function updateView(html) {
            document.getElementById('app-container').innerHTML = html;
            lucide.createIcons();
            window.scrollTo(0, 0);
        }
        
        function bottomNav(active = '') {
            return `
            <div class="fixed bottom-0 w-full max-w-md bg-white border-t flex justify-around items-end pb-4 pt-2 z-40">
                <button onclick="renderHome()" class="flex flex-col items-center gap-1 ${active === 'home' ? 'text-waktoo-green' : 'text-gray-400'} w-1/3 hover:text-waktoo-green transition">
                    <i data-lucide="home"></i><span class="text-[10px] font-bold">Beranda</span>
                </button>
                
                <div class="relative -top-8 w-1/3 flex justify-center">
                    <button onclick="openActionMenu()" class="bg-orange-500 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_4px_10px_rgba(249,115,22,0.4)] active:scale-90 transition hover:bg-orange-600">
                        <i data-lucide="zap" class="w-6 h-6"></i>
                    </button>
                </div>
                
                <button onclick="renderRiwayatPribadi()" class="flex flex-col items-center gap-1 ${active === 'absensi' ? 'text-waktoo-green' : 'text-gray-400'} w-1/3 hover:text-waktoo-green transition">
                    <i data-lucide="users"></i><span class="text-[10px] font-bold">Absensi</span>
                </button>
            </div>`;
        }
        // --- LOGIKA MENU CEPAT (BOTTOM SHEET) ---
        window.openActionMenu = () => {
            const overlay = document.getElementById('modal-overlay');
            const sheet = document.getElementById('bottom-sheet');
            const content = document.getElementById('sheet-content');
            
            // 1. Isi konten menu aksi cepat
            content.innerHTML = `
                <h3 class="font-bold text-gray-800 text-lg mb-5 text-center">Aksi Cepat</h3>
                <div class="grid grid-cols-4 gap-4 mb-4">
                    <button onclick="closeModal(); handleAbsenAction('Clock In')" class="flex flex-col items-center gap-2 active:scale-95 transition">
                        <div class="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-sm"><i data-lucide="log-in"></i></div>
                        <span class="text-[10px] font-bold text-gray-600">Clock In</span>
                    </button>
                    <button onclick="closeModal(); handleAbsenAction('Clock Out')" class="flex flex-col items-center gap-2 active:scale-95 transition">
                        <div class="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center shadow-sm"><i data-lucide="log-out"></i></div>
                        <span class="text-[10px] font-bold text-gray-600">Clock Out</span>
                    </button>
                    <button onclick="closeModal(); navigateTo('pengajuan')" class="flex flex-col items-center gap-2 active:scale-95 transition">
                        <div class="w-12 h-12 bg-lime-100 text-lime-600 rounded-full flex items-center justify-center shadow-sm"><i data-lucide="file-plus"></i></div>
                        <span class="text-[10px] font-bold text-gray-600">Izin/Cuti</span>
                    </button>
                    <button onclick="closeModal(); navigateTo('aktivitas')" class="flex flex-col items-center gap-2 active:scale-95 transition">
                        <div class="w-12 h-12 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center shadow-sm"><i data-lucide="message-square"></i></div>
                        <span class="text-[10px] font-bold text-gray-600">Chat Tim</span>
                    </button>
                </div>
            `;
            
            // 2. Render ulang icon lucide di dalam modal yang baru dibuat
            lucide.createIcons();
            
            // 3. Tampilkan layar transparan hitam dan naikkan menu putih dari bawah
            overlay.classList.remove('hidden');
            setTimeout(() => {
                overlay.classList.remove('opacity-0'); // Munculkan layar hitam perlahan
                sheet.classList.add('open'); // Naikkan sheet dari bawah
            }, 10);
        };
        
        // Fungsi untuk menutup modal (dipanggil saat klik area hitam atau klik menu)
        window.closeModal = () => {
            const overlay = document.getElementById('modal-overlay');
            const sheet = document.getElementById('bottom-sheet');
            
            sheet.classList.remove('open'); // Turunkan sheet ke bawah
            overlay.classList.add('opacity-0'); // Pudarkan layar hitam
            
            // Sembunyikan elemen setelah animasi selesai (300ms)
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 300);
        };
        // --- PAGE: ABSENSI HARIAN (Sesuai Screenshot) ---
        let activeFilters = { status: [], divisi: [] };
        
        window.renderDailyAttendance = async () => {
            updateView(`<div class="flex flex-col items-center justify-center h-screen gap-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-waktoo-green"></div><span class="text-gray-500">Memuat Data Absensi...</span></div>`);
            
            try {
                // Ambil data absensi hari ini (Query sederhana: ambil semua yg terbaru)
                // Note: Idealnya query by date, tapi untuk demo kita ambil limit 50 terakhir
                const q = query(collection(db, "absensi"), orderBy("waktu", "desc"));
                const snap = await getDocs(q);
                
                let allData = [];
                snap.forEach(doc => {
                    let d = doc.data();
                    d.id = doc.id;
                    // Mock data jika field belum ada (agar tampilan tidak rusak)
                    if (!d.divisi) d.divisi = DIVISI_LIST[Math.floor(Math.random() * DIVISI_LIST.length)];
                    if (!d.status) d.status = d.tipe === 'Clock In' ? 'Tepat Waktu' : 'Sudah Pulang';
                    allData.push(d);
                });
                
                // FILTERING LOGIC (Client Side)
                let filteredData = allData.filter(item => {
                    const statusMatch = activeFilters.status.length === 0 || activeFilters.status.includes(item.status);
                    const divisiMatch = activeFilters.divisi.length === 0 || activeFilters.divisi.includes(item.divisi);
                    return statusMatch && divisiMatch;
                });
                
                let listHTML = filteredData.map(d => {
                    const isAbsent = d.status === 'Tidak Hadir';
                    const borderColor = isAbsent ? 'border-red-500' : 'border-gray-200';
                    const statusColor = isAbsent ? 'text-red-500' : 'text-green-600';
                    const avatarColor = isAbsent ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-600';
                    const displayTime = d.waktu?.toDate ? d.waktu.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                    
                    return `
                    <div class="flex items-center gap-4 p-4 border-b border-gray-100 hover:bg-gray-50 transition page-enter bg-white">
                        <div class="relative">
                            <div class="w-12 h-12 rounded-full ${avatarColor} flex items-center justify-center font-bold text-lg border-2 ${isAbsent ? 'border-red-500' : 'border-blue-200'}">
                                ${(d.nama || d.email).charAt(0).toUpperCase()}
                            </div>
                        </div>
                        <div class="flex-1">
                            <h3 class="font-bold text-gray-800 text-sm">${d.nama || d.email.split('@')[0]}</h3>
                            <p class="text-xs text-gray-400">${d.divisi}</p>
                            <p class="text-xs ${statusColor} font-medium mt-1">${d.status} • ${displayTime}</p>
                        </div>
                    </div>`;
                }).join('');
                
                const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                
                updateView(`
                    <div class="bg-white min-h-screen pb-24">
                        <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center justify-between border-b shadow-sm">
                            <button onclick="renderHome()"><i data-lucide="arrow-left" class="text-gray-600"></i></button>
                            <h1 class="font-semibold text-gray-800">Absensi Harian</h1>
                            <button onclick="toggleSearch()"><i data-lucide="search" class="text-gray-600"></i></button>
                        </div>

                        <div class="px-4 py-3 bg-gray-50 flex justify-between items-center">
                            <span class="text-sm text-gray-500 font-medium">${today}</span>
                            <button onclick="openFilterModal()" class="flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-500 text-blue-600 rounded-lg text-sm font-medium shadow-sm active:bg-blue-50">
                                Filter <i data-lucide="filter" class="w-4 h-4"></i>
                            </button>
                        </div>

                        <div class="flex flex-col">
                            ${listHTML || '<div class="p-10 text-center text-gray-400 text-sm">Tidak ada data ditemukan sesuai filter.</div>'}
                        </div>
                    </div>

                    <div id="filter-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-end justify-center transition-opacity">
                        <div class="bg-white w-full max-w-md rounded-t-2xl max-h-[90vh] flex flex-col bottom-sheet">
                            <div class="p-4 border-b flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
                                <h3 class="font-bold text-lg">Filter</h3>
                                <button onclick="closeFilterModal()"><i data-lucide="x" class="text-gray-400"></i></button>
                            </div>
                            
                            <div class="overflow-y-auto p-4 space-y-6">
                                <div>
                                    <h4 class="font-semibold text-gray-700 mb-3">Status</h4>
                                    <div class="space-y-3">
                                        ${STATUS_LIST.map(s => `
                                            <label class="flex items-center gap-3 cursor-pointer">
                                                <input type="checkbox" value="${s}" class="filter-status w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500">
                                                <span class="text-gray-600 text-sm">${s}</span>
                                            </label>
                                        `).join('')}
                                    </div>
                                </div>

                                <div>
                                    <h4 class="font-semibold text-gray-700 mb-3">Divisi</h4>
                                    <div class="grid grid-cols-2 gap-3">
                                        ${DIVISI_LIST.map(d => `
                                            <label class="flex items-center gap-3 cursor-pointer">
                                                <input type="checkbox" value="${d}" class="filter-divisi w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500">
                                                <span class="text-gray-600 text-sm">${d}</span>
                                            </label>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>

                            <div class="p-4 border-t flex gap-3 sticky bottom-0 bg-white">
                                <button onclick="closeFilterModal()" class="flex-1 py-3 border border-gray-300 rounded-lg text-gray-600 font-medium">Batal</button>
                                <button onclick="applyFilter()" class="flex-1 py-3 bg-green-600 text-white rounded-lg font-bold shadow-md hover:bg-green-700">Simpan</button>
                            </div>
                        </div>
                    </div>

                    ${bottomNav('absensi')}
                `);
                
                // Set checkbox state based on activeFilters
                document.querySelectorAll('.filter-status').forEach(cb => cb.checked = activeFilters.status.includes(cb.value));
                document.querySelectorAll('.filter-divisi').forEach(cb => cb.checked = activeFilters.divisi.includes(cb.value));
                
            } catch (e) {
                console.error(e);
                showToast("Gagal memuat data");
                renderHome();
            }
        };
        // --- PAGE: RIWAYAT ABSENSI PRIBADI ---
        window.renderRiwayatPribadi = async () => {
            updateView(`<div class="flex flex-col items-center justify-center h-screen gap-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-waktoo-green"></div><span class="text-gray-500">Memuat Riwayat...</span></div>`);
            
            try {
                // Ambil data absensi KHUSUS untuk user yang sedang login, urutkan dari yang terbaru
                const q = query(collection(db, "absensi"), where("uid", "==", currentUser.uid), orderBy("waktu", "desc"));
                const snap = await getDocs(q);
                
                let listHTML = '';
                let bulanTerakhir = '';
                
                snap.forEach(docSnap => {
                    const d = docSnap.data();
                    
                    // Format waktu agar mudah dibaca
                    const dateObj = d.waktu?.toDate ? d.waktu.toDate() : new Date();
                    const tanggalLengkap = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                    const jam = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const namaBulan = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                    
                    // Pemisah teks untuk membedakan bulan (misal: "MARET 2026")
                    if (namaBulan !== bulanTerakhir) {
                        listHTML += `<h3 class="text-xs font-bold text-gray-500 mt-5 mb-3 uppercase tracking-wider">${namaBulan}</h3>`;
                        bulanTerakhir = namaBulan;
                    }
                    
                    // Tentukan warna dan ikon berdasarkan tipe absen
                    // Tentukan warna dan ikon berdasarkan tipe absen (dengan pengaman opsional '?')
                    let iconBg = 'bg-blue-100 text-blue-500';
                    let iconName = 'clock';
                    
                    // Kita gunakan pengaman ?. agar tidak error kalau d.tipe kosong
                    if (d.tipe?.includes('Clock In')) {
                        iconBg = 'bg-green-100 text-green-500';
                        iconName = 'log-in';
                    }
                    if (d.tipe?.includes('Clock Out')) {
                        iconBg = 'bg-red-100 text-red-500';
                        iconName = 'log-out';
                    }
                    
                    let statusColor = 'text-green-600';
                    if (d.status === 'Terlambat') statusColor = 'text-red-500';
                    if (d.status?.includes('Lembur')) statusColor = 'text-orange-500';
                    
                    // Kartu riwayat
                    listHTML += `
                        <div class="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100 flex items-center gap-4 page-enter">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg}">
                                <i data-lucide="${iconName}" class="w-5 h-5"></i>
                            </div>
                            <div class="flex-1">
                                <p class="text-[10px] text-gray-400 font-bold mb-0.5">${tanggalLengkap}</p>
                                <div class="flex justify-between items-center">
                                    <h4 class="text-sm font-bold text-gray-800">${d.tipe}</h4>
                                    <span class="text-sm font-bold text-gray-800">${jam}</span>
                                </div>
                                <div class="flex justify-between items-center mt-1">
                                    <p class="text-[10px] text-gray-500">${d.shift}</p>
                                    <p class="text-[10px] font-bold ${statusColor}">${d.status}</p>
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                // Tampilkan ke layar
                updateView(`
                    <div class="bg-gray-50 min-h-screen pb-24">
                        <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm">
                            <button onclick="renderHome()"><i data-lucide="arrow-left" class="text-gray-600"></i></button>
                            <h1 class="font-semibold text-gray-800">Riwayat Absensi Pribadi</h1>
                        </div>
                        
                        <div class="p-5">
                            ${listHTML || '<div class="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl mt-4 bg-white">Belum ada riwayat absensi. Lakukan Clock In pertamamu!</div>'}
                        </div>
                    </div>
                    ${bottomNav('absensi')}
                `);
                
            } catch (e) {
                console.error(e);
                updateView(`
                    <div class="p-10 text-center flex flex-col items-center gap-4">
                        <i data-lucide="alert-triangle" class="w-12 h-12 text-red-500"></i>
                        <p class="text-gray-600 text-sm">Gagal memuat riwayat. Fitur ini membutuhkan Index Firestore.</p>
                        <button onclick="renderHome()" class="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium mt-2">Kembali</button>
                    </div>
                `);
            }
        };
        
        // --- FILTER MODAL LOGIC ---
        window.openFilterModal = () => {
            const modal = document.getElementById('filter-modal');
            const sheet = modal.querySelector('.bottom-sheet');
            modal.classList.remove('hidden');
            // Animasi sederhana
            setTimeout(() => {
                sheet.style.transform = 'translateY(0)';
            }, 10);
        };
        
        window.closeFilterModal = () => {
            const modal = document.getElementById('filter-modal');
            const sheet = modal.querySelector('.bottom-sheet');
            sheet.style.transform = 'translateY(100%)';
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        };
        
        window.applyFilter = () => {
            const statusCheckboxes = document.querySelectorAll('.filter-status:checked');
            const divisiCheckboxes = document.querySelectorAll('.filter-divisi:checked');
            
            activeFilters.status = Array.from(statusCheckboxes).map(cb => cb.value);
            activeFilters.divisi = Array.from(divisiCheckboxes).map(cb => cb.value);
            
            closeFilterModal();
            renderDailyAttendance(); // Re-render with filters
        };
        
        // --- PAGE: HOME ---
        let intervalJam = null; // Variabel penampung detak jam
        
        window.renderHome = function() {
            // Bersihkan detak jam lama jika kita me-refresh halaman beranda
            if (intervalJam) clearInterval(intervalJam);
            
            let menuHTML = menuItems.map(item => `
                <div onclick="navigateTo('${item.id}')" class="flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform">
                    <div class="${item.color} w-14 h-14 rounded-[1.2rem] flex items-center justify-center text-white shadow-md"><i data-lucide="${item.icon}"></i></div>
                    <span class="text-[11px] text-center text-gray-600 font-medium px-1 leading-tight">${item.name}</span>
                </div>`).join('');
            
            updateView(`
                <div class="bg-waktoo-green text-white px-5 pt-8 pb-20 rounded-b-[2.5rem] relative shrink-0">
                    
                    <div class="flex justify-between items-center bg-white/20 rounded-2xl p-3 mb-6 backdrop-blur-sm border border-white/30 shadow-sm page-enter">
                        <div class="flex items-center gap-2 max-w-[60%]">
                            <i data-lucide="map-pin" class="w-4 h-4 text-white shrink-0"></i>
                            <span id="lokasi-teks" class="text-[10px] font-bold text-white truncate">Mencari lokasi...</span>
                        </div>
                        <div class="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg border border-white/20">
                            <i data-lucide="clock" class="w-4 h-4 text-white"></i>
                            <span id="jam-teks" class="text-xs font-bold text-white tracking-widest">--:--:--</span>
                        </div>
                    </div>

                    <h2 class="font-semibold text-lg">Halo, ${currentUserProfile?.nama || currentUser?.email?.split('@')[0] || 'User'}</h2>
                    <div class="mt-4">
                        <select id="shift-select" class="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:bg-white focus:text-gray-800 transition">
                            <option value="Shift Pagi">Shift Pagi (08.00-16.00)</option>
                            <option value="Shift S">Shift S (12.00-21.00)</option>
                            <option value="Shift S1">Shift S1 (10.00-20.00)</option>
                            <option value="Shift S2">Shift S2 (12.00-20.00)</option>
                            <option value="Shift S3">Shift S3 (12.00-22.00)</option>
                            <option value="Shift Malam">Shift Malam (14.00-22.00)</option>
                        </select>
                    </div>
                </div>
                
                <div class="mx-5 -mt-10 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between relative z-10 page-enter">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-full border-2 border-white shadow-md bg-waktoo-green flex items-center justify-center text-white font-bold text-xl">${(currentUserProfile?.nama || currentUser?.email || 'U').charAt(0).toUpperCase()}</div>
                        <div><h3 class="font-bold text-gray-800 text-sm truncate w-32">${currentUserProfile?.nama || currentUser?.email || 'User'}</h3><p class="text-xs text-gray-500">${currentUserProfile?.divisi || 'Karyawan'}</p></div>
                    </div>
                    <div class="flex items-center gap-2">
    
<div class="flex items-center gap-2">
    ${currentUserProfile?.role === 'Admin' ? `
    <button onclick="navigateTo('admin')" class="bg-slate-800 text-white px-3 py-2 rounded-lg text-[10px] font-bold shadow-sm active:scale-95 transition flex items-center gap-1">
        <i data-lucide="shield" class="w-3 h-3"></i> MANAGER
    </button>
    ` : ''}
    
    <button onclick="handleLogout()" class="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition"><i data-lucide="log-out" class="w-5 h-5"></i></button>
</div>

</div>
                </div>
                
                <div class="mx-5 mt-6 grid grid-cols-2 gap-3 page-enter">
                    <button onclick="handleAbsenAction('Clock In')" class="bg-green-50 border border-green-200 p-3 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition">
                        <div class="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white"><i data-lucide="log-in" class="w-4 h-4"></i></div>
                        <span class="text-[10px] font-bold text-green-700">Clock In</span>
                    </button>
                    <button onclick="handleAbsenAction('Clock Out')" class="bg-red-50 border border-red-200 p-3 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition">
                        <div class="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white"><i data-lucide="log-out" class="w-4 h-4"></i></div>
                        <span class="text-[10px] font-bold text-red-700">Clock Out</span>
                    </button>
                    <button onclick="handleAbsenAction('Clock In Lembur')" class="bg-blue-50 border border-blue-200 p-3 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition">
                        <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white"><i data-lucide="clock" class="w-4 h-4"></i></div>
                        <span class="text-[10px] font-bold text-blue-700">In Lembur</span>
                    </button>
                    <button onclick="handleAbsenAction('Clock Out Lembur')" class="bg-orange-50 border border-orange-200 p-3 rounded-xl flex flex-col items-center gap-2 active:scale-95 transition">
                        <div class="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white"><i data-lucide="check-circle" class="w-4 h-4"></i></div>
                        <span class="text-[10px] font-bold text-orange-700">Out Lembur</span>
                    </button>
                </div>

                <div class="grid grid-cols-3 gap-y-6 gap-x-2 p-6 mt-2 pb-32 page-enter">${menuHTML}</div>
                ${bottomNav('home')}
            `);
            
            // --- LOGIKA JAM REAL-TIME ---
            const updateJam = () => {
                const elJam = document.getElementById('jam-teks');
                if (elJam) elJam.innerText = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            };
            updateJam(); // Jalankan sekali agar tidak menunggu 1 detik
            intervalJam = setInterval(updateJam, 1000); // Perbarui setiap 1 detik
            
            // --- LOGIKA MENDETEKSI NAMA JALAN / LOKASI ---
            const elLokasi = document.getElementById('lokasi-teks');
            if (elLokasi) {
                dapatkanLokasi().then(loc => {
                    // Cek jarak dengan kantor
                    const jarak = hitungJarak(loc.lat, loc.lng, KANTOR_LAT, KANTOR_LNG);
                    if (jarak <= MAKSIMAL_JARAK_METER) {
                        elLokasi.innerText = "📍 Di Area Kantor";
                    } else {
                        // Ubah koordinat jadi nama jalan menggunakan API gratis (OpenStreetMap)
                        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.lat}&lon=${loc.lng}`)
                            .then(res => res.json())
                            .then(data => {
                                // Ambil nama jalan atau kelurahan
                                const namaJalan = data.address?.road || data.address?.village || data.address?.suburb || "Lokasi Ditemukan";
                                elLokasi.innerText = namaJalan;
                            })
                            .catch(() => { elLokasi.innerText = "Sinyal GPS Aktif"; });
                    }
                }).catch(err => {
                    elLokasi.innerText = "GPS Dinonaktifkan";
                    elLokasi.classList.replace('text-white', 'text-red-200'); // Beri warna peringatan
                });
            }
        }
        
        // --- PAGE: SCHEDULE (JADWAL) ---
        window.renderSchedule = async function() {
            updateView(`<div class="flex flex-col items-center justify-center h-screen gap-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-waktoo-green"></div><span class="text-gray-500">Memuat Jadwal...</span></div>`);
            
            try {
                // Mengambil jadwal khusus untuk user yang sedang login, diurutkan dari tanggal terdekat
                const q = query(collection(db, "jadwal_kerja"), where("uid", "==", currentUser.uid), orderBy("tanggal", "asc"));
                const snap = await getDocs(q);
                
                let list = '';
                snap.forEach(docSnap => {
                    const d = docSnap.data();
                    let displayDate = d.tanggal;
                    try {
                        // Mengubah format tanggal menjadi lebih ramah dibaca (contoh: Rabu, 11 Maret)
                        displayDate = new Date(d.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
                    } catch (err) {}
                    
                    // Membuat desain kartu jadwal
                    list += `
                    <div class="bg-white p-4 rounded-xl mb-3 border-l-4 ${d.pola_kerja === 'Libur/Off' ? 'border-gray-400' : 'border-waktoo-green'} shadow-sm flex justify-between items-center page-enter">
                        <div>
                            <p class="text-xs text-gray-400 font-bold mb-1">${displayDate}</p>
                            <p class="text-sm font-bold ${d.pola_kerja === 'Libur/Off' ? 'text-gray-500' : 'text-gray-800'}">${d.pola_kerja}</p>
                        </div>
                        <button onclick="deleteJadwal('${docSnap.id}')" class="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>`;
                });
                
                // Menampilkan halaman lengkap
                updateView(`
                    <div class="bg-white p-4 border-b flex items-center gap-3 sticky top-0 z-20">
                        <button onclick="renderHome()"><i data-lucide="arrow-left" class="text-gray-600"></i></button>
                        <h2 class="font-bold text-lg text-gray-800">Jadwal Jam Kerja</h2>
                    </div>
                    
                    <div class="p-5">
                        <div class="bg-green-50 p-5 rounded-2xl mb-6 border border-green-200 shadow-sm">
                            <h3 class="text-xs font-bold mb-3 text-green-700 uppercase flex items-center gap-2">
                                <i data-lucide="plus-circle" class="w-4 h-4"></i> Input Jadwal Baru
                            </h3>
                            <input type="date" id="input-tgl" class="w-full mb-3 p-3 rounded-xl border-gray-200 text-sm focus:outline-none focus:border-waktoo-green">
                            
                            <select id="input-pola" class="w-full mb-4 p-3 rounded-xl border-gray-200 text-sm focus:outline-none focus:border-waktoo-green">
                                <option value="" disabled selected>-- Pilih Shift --</option>
                                <option value="Shift Pagi">Shift Pagi (08.00-16.00)</option>
                                <option value="Shift S">Shift S (12.00-21.00)</option>
                                <option value="Shift S1">Shift S1 (10.00-20.00)</option>
                                <option value="Shift S2">Shift S2 (12.00-20.00)</option>
                                <option value="Shift S3">Shift S3 (12.00-22.00)</option>
                                <option value="Shift Malam">Shift Malam (14.00-22.00)</option>
                                <option value="Libur/Off">Libur / Off</option>
                            </select>
                            
                            <button onclick="saveJadwal()" class="w-full bg-waktoo-green text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition">
                                Simpan Jadwal
                            </button>
                        </div>
                        
                        <h3 class="text-sm font-bold text-gray-700 mb-3">Daftar Jadwal Saya</h3>
                        <div class="pb-24 space-y-3">
                            ${list || '<div class="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">Belum ada jadwal yang diinput.</div>'}
                        </div>
                    </div>
                    ${bottomNav()}
                `);
            } catch (e) {
                // Catatan: Jika error Firestore Index muncul, lihat console browser untuk link pembuatannya
                console.error(e);
                showToast("Gagal memuat jadwal. Cek Console jika butuh Index.");
                updateView(`
                    <div class="p-10 text-center flex flex-col items-center gap-4">
                        <i data-lucide="alert-triangle" class="w-12 h-12 text-red-500"></i>
                        <p class="text-gray-600 text-sm">Gagal memuat jadwal. Biasanya karena Firestore membutuhkan Index baru untuk fitur urutan tanggal.</p>
                        <button onclick="renderHome()" class="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium mt-2">Kembali</button>
                    </div>
                `);
            }
        }
        // --- PAGE: AKTIVITAS (GROUP CHAT) ---
        let unsubscribeChat = null; // Variabel untuk menghentikan pendengar pesan saat keluar dari menu
        
        window.renderAktivitas = () => {
            updateView(`
                <div class="flex flex-col h-screen bg-gray-100 relative">
                    <div class="bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm shrink-0">
                        <button onclick="keluarAktivitas()"><i data-lucide="arrow-left" class="text-gray-600"></i></button>
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center text-white shadow-sm"><i data-lucide="users" class="w-5 h-5"></i></div>
                            <div>
                                <h1 class="font-bold text-gray-800 text-sm">Grup Aktivitas</h1>
                                <p class="text-[10px] text-teal-600 font-medium">Tim Penyetan 234</p>
                            </div>
                        </div>
                    </div>

                    <div id="chat-container" class="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
                        <div class="flex justify-center"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500"></div></div>
                    </div>

                    <div class="bg-white border-t p-3 flex gap-2 items-center shrink-0">
                        <input type="text" id="chat-input" placeholder="Ketik pesan..." class="flex-1 bg-gray-100 border-none rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" onkeypress="handleChatKeyPress(event)">
                        <button onclick="kirimPesan()" class="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition shrink-0">
                            <i data-lucide="send" class="w-5 h-5 ml-1"></i>
                        </button>
                    </div>
                </div>
            `);
            
            mulaiListenChat(); // Mulai mendengarkan pesan masuk
        };
        // --- PAGE: PENGAJUAN (Izin/Sakit/Cuti) ---
        window.renderPengajuan = async () => {
            updateView(`<div class="flex flex-col items-center justify-center h-screen gap-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-waktoo-green"></div><span class="text-gray-500">Memuat Data Pengajuan...</span></div>`);
            
            try {
                // Ambil riwayat pengajuan khusus untuk user ini, urutkan dari yang terbaru
                const q = query(collection(db, "pengajuan"), where("uid", "==", currentUser.uid), orderBy("waktu_pengajuan", "desc"));
                const snap = await getDocs(q);
                
                let listHTML = '';
                snap.forEach(docSnap => {
                    const d = docSnap.data();
                    // Rapikan format tanggal
                    let tglMulai = d.tgl_mulai ? new Date(d.tgl_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-';
                    let tglSelesai = d.tgl_selesai ? new Date(d.tgl_selesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-';
                    
                    // Beri warna berbeda tergantung statusnya
                    let statusColor = 'text-orange-600 bg-orange-50 border-orange-200'; // Default Menunggu
                    if (d.status === 'Disetujui') statusColor = 'text-green-600 bg-green-50 border-green-200';
                    if (d.status === 'Ditolak') statusColor = 'text-red-600 bg-red-50 border-red-200';
                    
                    listHTML += `
                        <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-3 page-enter relative overflow-hidden">
                            <div class="absolute top-0 left-0 w-1 h-full ${d.status === 'Disetujui' ? 'bg-green-500' : (d.status === 'Ditolak' ? 'bg-red-500' : 'bg-orange-400')}"></div>
                            <div class="flex justify-between items-start mb-2 pl-2">
                                <div>
                                    <span class="text-[10px] font-bold px-2 py-1 rounded border ${statusColor}">${d.status}</span>
                                </div>
                                <span class="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">${d.tipe}</span>
                            </div>
                            <h4 class="text-sm font-bold text-gray-800 mt-2 pl-2">${tglMulai} s/d ${tglSelesai}</h4>
                            <p class="text-xs text-gray-500 mt-1 pl-2 line-clamp-2">"${d.alasan}"</p>
                        </div>
                    `;
                });
                
                updateView(`
                    <div class="bg-white min-h-screen pb-24">
                        <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm">
                            <button onclick="renderHome()"><i data-lucide="arrow-left" class="text-gray-600"></i></button>
                            <h1 class="font-semibold text-gray-800">Pengajuan Izin / Cuti</h1>
                        </div>

                        <div class="p-5">
                            <div class="bg-lime-50 p-5 rounded-2xl mb-8 border border-lime-200 shadow-sm page-enter">
                                <h3 class="text-xs font-bold mb-4 text-lime-800 uppercase flex items-center gap-2">
                                    <i data-lucide="file-plus" class="w-4 h-4 text-lime-600"></i> Buat Pengajuan Baru
                                </h3>

                                <select id="aju-tipe" class="w-full mb-3 p-3 rounded-xl border-gray-200 text-sm focus:outline-none focus:border-lime-500">
                                    <option value="" disabled selected>-- Pilih Tipe Pengajuan --</option>
                                    <option value="Sakit">Sakit</option>
                                    <option value="Izin">Izin</option>
                                    <option value="Cuti">Cuti</option>
                                </select>

                                <div class="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label class="text-[10px] font-bold text-gray-500 ml-1">Tanggal Mulai</label>
                                        <input type="date" id="aju-mulai" class="w-full p-2.5 rounded-xl border-gray-200 text-sm focus:outline-none focus:border-lime-500">
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-bold text-gray-500 ml-1">Tanggal Selesai</label>
                                        <input type="date" id="aju-selesai" class="w-full p-2.5 rounded-xl border-gray-200 text-sm focus:outline-none focus:border-lime-500">
                                    </div>
                                </div>

                                <textarea id="aju-alasan" rows="3" placeholder="Tulis alasan lengkap pengajuanmu..." class="w-full mb-4 p-3 rounded-xl border-gray-200 text-sm focus:outline-none focus:border-lime-500"></textarea>

                                <button onclick="kirimPengajuan()" class="w-full bg-lime-600 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition">
                                    Kirim Pengajuan
                                </button>
                            </div>

                            <h3 class="text-sm font-bold text-gray-700 mb-3">Riwayat Pengajuan</h3>
                            <div class="space-y-3">
                                ${listHTML || '<div class="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">Belum ada riwayat pengajuan.</div>'}
                            </div>
                        </div>
                    </div>
                    ${bottomNav()}
                `);
            } catch (e) {
                console.error(e);
                updateView(`
                    <div class="p-10 text-center flex flex-col items-center gap-4">
                        <i data-lucide="alert-triangle" class="w-12 h-12 text-red-500"></i>
                        <p class="text-gray-600 text-sm">Gagal memuat riwayat. Sama seperti Jadwal, fitur ini butuh Index Firestore.</p>
                        <button onclick="renderHome()" class="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium mt-2">Kembali</button>
                    </div>
                 `);
            }
        };
        window.kirimPengajuan = async () => {
            if (!currentUser) return showToast("Harus login!");
            
            // Ambil semua isian form
            const tipe = document.getElementById('aju-tipe').value;
            const tglMulai = document.getElementById('aju-mulai').value;
            const tglSelesai = document.getElementById('aju-selesai').value;
            const alasan = document.getElementById('aju-alasan').value;
            
            // Validasi: pastikan form tidak kosong
            if (!tipe || !tglMulai || !tglSelesai || !alasan) {
                return showToast("Lengkapi semua isian form!");
            }
            
            // Validasi: pastikan tanggal masuk akal
            if (new Date(tglMulai) > new Date(tglSelesai)) {
                return showToast("Tanggal selesai tidak boleh lebih dulu dari tanggal mulai!");
            }
            
            const namaUser = currentUserProfile?.nama || currentUser.email.split('@')[0];
            const divisiUser = currentUserProfile?.divisi || "Tidak Diketahui";
            
            showToast("Mengirim pengajuan...");
            try {
                // Simpan ke koleksi baru bernama "pengajuan"
                await addDoc(collection(db, "pengajuan"), {
                    uid: currentUser.uid,
                    nama: namaUser,
                    email: currentUser.email,
                    divisi: divisiUser,
                    tipe: tipe,
                    tgl_mulai: tglMulai,
                    tgl_selesai: tglSelesai,
                    alasan: alasan,
                    status: "Menunggu", // Default status saat baru diajukan
                    waktu_pengajuan: serverTimestamp()
                });
                
                showToast("Pengajuan berhasil dikirim!");
                renderPengajuan(); // Muat ulang halaman agar pengajuannya langsung muncul di bawah
            } catch (e) {
                console.error(e);
                showToast("Gagal mengirim pengajuan!");
            }
        };
        // Fungsi saat menekan tombol panah kembali
        window.keluarAktivitas = () => {
            if (unsubscribeChat) {
                unsubscribeChat(); // Matikan pendengar pesan agar tidak boros kuota internet
                unsubscribeChat = null;
            }
            renderHome();
        };
        
        // Fungsi mendengarkan pesan secara Real-Time (Otomatis muncul tanpa refresh)
        window.mulaiListenChat = () => {
            const chatContainer = document.getElementById('chat-container');
            const q = query(collection(db, "aktivitas_chat"), orderBy("waktu", "asc"));
            
            unsubscribeChat = onSnapshot(q, (snapshot) => {
                let html = '';
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const isMe = data.uid === currentUser.uid; // Cek apakah ini pesanku sendiri
                    const waktuFormat = data.waktu?.toDate ? data.waktu.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '...';
                    const initial = (data.nama || 'U').charAt(0).toUpperCase();
                    
                    if (isMe) {
                        // Tampilan Balon Chat Sendiri (Kanan, Warna Teal)
                        html += `
                        <div class="flex justify-end page-enter">
                            <div class="max-w-[80%] bg-teal-500 text-white rounded-2xl rounded-tr-none p-3 shadow-sm">
                                <p class="text-sm leading-relaxed">${data.pesan}</p>
                                <p class="text-[9px] text-teal-100 text-right mt-1">${waktuFormat}</p>
                            </div>
                        </div>`;
                    } else {
                        // Tampilan Balon Chat Orang Lain (Kiri, Warna Putih)
                        html += `
                        <div class="flex justify-start gap-2 page-enter">
                            <div class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 border border-white shadow-sm">${initial}</div>
                            <div class="max-w-[75%] bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-none p-3 shadow-sm">
                                <p class="text-[10px] font-bold text-teal-600 mb-1">${data.nama}</p>
                                <p class="text-sm leading-relaxed">${data.pesan}</p>
                                <p class="text-[9px] text-gray-400 text-right mt-1">${waktuFormat}</p>
                            </div>
                        </div>`;
                    }
                });
                
                if (snapshot.empty) {
                    chatContainer.innerHTML = '<div class="text-center mt-10 text-gray-400 text-sm bg-white py-2 px-4 rounded-full w-max mx-auto shadow-sm">Belum ada obrolan. Sapa tim sekarang! 👋</div>';
                } else {
                    chatContainer.innerHTML = html;
                    // Otomatis gulir (scroll) ke pesan paling bawah
                    setTimeout(() => chatContainer.scrollTop = chatContainer.scrollHeight, 100);
                }
            }, (error) => {
                console.error("Error chat:", error);
                chatContainer.innerHTML = '<div class="text-center mt-10 text-red-500 text-sm">Gagal memuat pesan.</div>';
            });
        };
        
        // Fungsi menyimpan pesan baru ke database
        window.kirimPesan = async () => {
            const input = document.getElementById('chat-input');
            const pesan = input.value.trim(); // Hapus spasi berlebih
            if (!pesan) return; // Kalau kosong, jangan dikirim
            
            input.value = ''; // Langsung kosongkan kolom ketik agar terasa cepat
            const namaUser = currentUserProfile?.nama || currentUser.email.split('@')[0];
            
            try {
                await addDoc(collection(db, "aktivitas_chat"), {
                    pesan: pesan,
                    uid: currentUser.uid,
                    nama: namaUser,
                    waktu: serverTimestamp() // Waktu dari server Firebase
                });
            } catch (error) {
                showToast("Gagal mengirim pesan");
                input.value = pesan; // Kalau gagal, kembalikan tulisannya
            }
        };
        
        // Fungsi agar bisa tekan tombol "Enter" di keyboard untuk mengirim
        window.handleChatKeyPress = (e) => {
            if (e.key === 'Enter') kirimPesan();
        };
        // --- PAGE: PENGATURAN ---
        window.renderPengaturan = () => {
            const nama = currentUserProfile?.nama || '';
            const divisi = currentUserProfile?.divisi || '';
            const email = currentUser?.email || '';
            
            updateView(`
                <div class="bg-white min-h-screen pb-24">
                    <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm">
                        <button onclick="renderHome()"><i data-lucide="arrow-left" class="text-gray-600"></i></button>
                        <h1 class="font-semibold text-gray-800">Pengaturan Profil</h1>
                    </div>
                    
                    <div class="p-5 space-y-4 page-enter">
                        <div class="flex justify-center mb-6">
                            <div class="w-24 h-24 rounded-full bg-waktoo-green text-white flex items-center justify-center text-4xl font-bold shadow-lg border-4 border-green-100">
                                ${(nama || email || 'U').charAt(0).toUpperCase()}
                            </div>
                        </div>
                        
                        <div>
                            <label class="text-xs font-bold text-gray-500">Nama Lengkap</label>
                            <input id="set-nama" type="text" value="${nama}" class="w-full p-3 mt-1 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-waktoo-green">
                        </div>
                        
                        <div>
                            <label class="text-xs font-bold text-gray-500">Email (Tidak bisa diubah)</label>
                            <input type="text" value="${email}" disabled class="w-full p-3 mt-1 border border-gray-200 rounded-xl bg-gray-50 text-gray-400">
                        </div>
                        
                        <div>
                            <label class="text-xs font-bold text-gray-500">Divisi</label>
                            <select id="set-divisi" class="w-full p-3 mt-1 border border-gray-200 rounded-xl text-gray-800 bg-white focus:outline-none focus:border-waktoo-green">
                                ${DIVISI_LIST.map(d => `<option value="${d}" ${d === divisi ? 'selected' : ''}>${d}</option>`).join('')}
                            </select>
                        </div>

                        <div class="pt-4 border-t border-gray-100 mt-2">
                            <label class="text-xs font-bold text-gray-500">Ubah Password (Opsional)</label>
                            <input id="set-password" type="password" placeholder="Kosongkan jika tidak ingin diubah" class="w-full p-3 mt-1 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-waktoo-green">
                            <p class="text-[10px] text-gray-400 mt-1">* Minimal 6 karakter</p>
                        </div>
                        
                        <button onclick="simpanPengaturan()" class="w-full bg-waktoo-green text-white font-bold py-3 mt-6 rounded-xl shadow-md active:scale-95 transition">
                            Simpan Perubahan
                        </button>
                        
                        <div class="pt-6 mt-6 border-t border-gray-200">
                            <button onclick="handleLogout()" class="w-full bg-red-50 text-red-600 font-bold py-3 rounded-xl border border-red-200 flex items-center justify-center gap-2 active:scale-95 transition">
                                <i data-lucide="log-out" class="w-5 h-5"></i> Keluar (Logout)
                            </button>
                        </div>
                    </div>
                </div>
                ${bottomNav()}
            `);
        };
        window.simpanPengaturan = async () => {
            if (!currentUser) return;
            
            const namaBaru = document.getElementById('set-nama').value;
            const divisiBaru = document.getElementById('set-divisi').value;
            const passwordBaru = document.getElementById('set-password').value; // Ambil isian password
            
            if (!namaBaru || !divisiBaru) return showToast("Nama dan Divisi tidak boleh kosong!");
            
            showToast("Menyimpan...");
            try {
                // 1. Simpan perubahan Nama dan Divisi ke Firestore
                await setDoc(doc(db, "users", currentUser.uid), {
                    nama: namaBaru,
                    divisi: divisiBaru
                }, { merge: true });
                
                if (currentUserProfile) {
                    currentUserProfile.nama = namaBaru;
                    currentUserProfile.divisi = divisiBaru;
                }
                
                // 2. Logika Ubah Password
                if (passwordBaru) {
                    if (passwordBaru.length < 6) {
                        return showToast("Gagal: Password minimal 6 karakter!");
                    }
                    // Perintah Firebase untuk mengubah password
                    await updatePassword(currentUser, passwordBaru);
                    showToast("Profil dan Password berhasil diperbarui!");
                } else {
                    showToast("Profil berhasil diperbarui!");
                }
                
                setTimeout(() => renderHome(), 1000);
            } catch (e) {
                console.error(e);
                // Firebase mengharuskan user baru saja login untuk bisa mengubah password.
                // Jika error ini muncul, kita minta user login ulang.
                if (e.code === 'auth/requires-recent-login') {
                    showToast("Keamanan: Silakan Logout dan Login kembali untuk mengubah password.");
                } else {
                    showToast("Gagal menyimpan data!");
                }
            }
        };
        // --- PAGE: TUGAS (To-Do List) ---
        window.renderTugas = async () => {
            updateView(`<div class="flex flex-col items-center justify-center h-screen gap-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div><span class="text-gray-500">Memuat Tugas...</span></div>`);
            
            try {
                // Ambil daftar tugas khusus untuk user ini
                const q = query(collection(db, "tugas"), where("uid", "==", currentUser.uid), orderBy("waktu_dibuat", "desc"));
                const snap = await getDocs(q);
                
                let listHTML = '';
                snap.forEach(docSnap => {
                    const d = docSnap.data();
                    const id = docSnap.id;
                    const isSelesai = d.isSelesai || false; // Cek apakah tugas sudah dicoret
                    
                    // Desain kartu tugas (Berubah jadi transparan kalau sudah selesai)
                    listHTML += `
                        <div class="bg-white p-4 rounded-xl border ${isSelesai ? 'border-gray-100 opacity-60 bg-gray-50' : 'border-blue-100 shadow-sm'} mb-3 flex items-center gap-3 page-enter transition-all duration-300">
                            
                            <button onclick="toggleTugas('${id}', ${isSelesai})" class="w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition ${isSelesai ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 text-transparent hover:border-blue-400'}">
                                <i data-lucide="check" class="w-4 h-4"></i>
                            </button>
                            
                            <div class="flex-1" onclick="toggleTugas('${id}', ${isSelesai})">
                                <p class="text-sm cursor-pointer ${isSelesai ? 'text-gray-400 line-through' : 'text-gray-800 font-medium'}">${d.teks_tugas}</p>
                                <p class="text-[10px] text-gray-400 mt-1">${d.waktu_dibuat?.toDate ? d.waktu_dibuat.toDate().toLocaleDateString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'}) : 'Baru saja'}</p>
                            </div>
                            
                            <button onclick="hapusTugas('${id}')" class="text-gray-300 hover:text-red-500 p-2 shrink-0 transition">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    `;
                });
                
                updateView(`
                    <div class="bg-gray-50 min-h-screen pb-24">
                        <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm">
                            <button onclick="renderHome()"><i data-lucide="arrow-left" class="text-gray-600"></i></button>
                            <h1 class="font-semibold text-gray-800">Daftar Tugas</h1>
                        </div>

                        <div class="p-5">
                            <div class="bg-blue-50 p-4 rounded-2xl mb-6 border border-blue-100 shadow-sm flex gap-2">
                                <input type="text" id="input-tugas" placeholder="Tulis tugas barumu di sini..." class="flex-1 p-3 rounded-xl border border-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm" onkeypress="if(event.key === 'Enter') tambahTugas()">
                                <button onclick="tambahTugas()" class="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md active:scale-95 transition shrink-0">
                                    <i data-lucide="plus" class="w-5 h-5"></i>
                                </button>
                            </div>

                            <h3 class="text-sm font-bold text-gray-700 mb-3">Tugas Saya</h3>
                            <div class="space-y-2">
                                ${listHTML || `
                                    <div class="p-8 text-center bg-white border-2 border-dashed border-gray-200 rounded-xl">
                                        <div class="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <i data-lucide="check-square" class="text-blue-400 w-6 h-6"></i>
                                        </div>
                                        <p class="text-gray-500 text-sm font-medium">Belum ada tugas.</p>
                                        <p class="text-xs text-gray-400 mt-1">Tambahkan tugas pertamamu di atas!</p>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                    ${bottomNav()}
                `);
                
            } catch (e) {
                console.error(e);
                updateView(`
                    <div class="p-10 text-center flex flex-col items-center gap-4">
                        <i data-lucide="alert-triangle" class="w-12 h-12 text-red-500"></i>
                        <p class="text-gray-600 text-sm">Gagal memuat tugas. Fitur ini butuh Index Firestore baru.</p>
                        <button onclick="renderHome()" class="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium mt-2">Kembali</button>
                    </div>
                `);
            }
        };
        
        // Fungsi Tambah Tugas
        window.tambahTugas = async () => {
            if (!currentUser) return;
            const input = document.getElementById('input-tugas');
            const teks = input.value.trim();
            if (!teks) return showToast("Tulis tugasnya dulu!");
            
            input.value = ''; // Kosongkan kolom agar terasa cepat
            showToast("Menambahkan tugas...");
            
            try {
                await addDoc(collection(db, "tugas"), {
                    uid: currentUser.uid,
                    teks_tugas: teks,
                    isSelesai: false, // Default tugas baru = belum selesai
                    waktu_dibuat: serverTimestamp()
                });
                renderTugas(); // Segarkan tampilan
            } catch (e) {
                showToast("Gagal menambah tugas");
                input.value = teks; // Kembalikan teks jika gagal
            }
        };
        
        // Fungsi Coret / Batal Coret Tugas
        window.toggleTugas = async (id, statusSekarang) => {
            try {
                // Memperbarui status isSelesai menjadi sebaliknya (True <-> False)
                await updateDoc(doc(db, "tugas", id), {
                    isSelesai: !statusSekarang
                });
                renderTugas(); // Segarkan tampilan
            } catch (e) {
                showToast("Gagal mengubah status tugas");
            }
        };
        
        // Fungsi Hapus Tugas
        window.hapusTugas = async (id) => {
            if (!confirm("Hapus tugas ini secara permanen?")) return;
            try {
                await deleteDoc(doc(db, "tugas", id));
                showToast("Tugas dihapus!");
                renderTugas();
            } catch (e) {
                showToast("Gagal menghapus tugas");
            }
        };
        // --- PAGE: REIMBURSE (Penggantian Dana) ---
        window.renderReimburse = async () => {
            updateView(`<div class="flex flex-col items-center justify-center h-screen gap-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div><span class="text-gray-500">Memuat Data Reimburse...</span></div>`);
            
            try {
                // Ambil data reimburse khusus untuk user ini
                const q = query(collection(db, "reimburse"), where("uid", "==", currentUser.uid), orderBy("waktu_pengajuan", "desc"));
                const snap = await getDocs(q);
                
                let listHTML = '';
                const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
                
                snap.forEach(docSnap => {
                    const d = docSnap.data();
                    const tgl = d.tanggal ? new Date(d.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
                    
                    // Warna status
                    let statusColor = 'text-orange-600 bg-orange-50 border-orange-200'; // Menunggu
                    if (d.status === 'Disetujui') statusColor = 'text-green-600 bg-green-50 border-green-200';
                    if (d.status === 'Ditolak') statusColor = 'text-red-600 bg-red-50 border-red-200';
                    if (d.status === 'Dibayar') statusColor = 'text-blue-600 bg-blue-50 border-blue-200';
                    
                    listHTML += `
                        <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-3 page-enter">
                            <div class="flex justify-between items-start border-b border-gray-50 pb-2 mb-2">
                                <div>
                                    <span class="text-[10px] font-bold px-2 py-1 rounded border ${statusColor}">${d.status}</span>
                                </div>
                                <span class="text-xs font-bold text-cyan-700 bg-cyan-50 px-2 py-1 rounded-lg">${d.tipe}</span>
                            </div>
                            <div class="flex justify-between items-end mt-2">
                                <div>
                                    <h4 class="text-xs font-bold text-gray-800">${d.keterangan}</h4>
                                    <p class="text-[10px] text-gray-400 mt-1">Tgl Nota: ${tgl}</p>
                                </div>
                                <span class="text-sm font-bold text-gray-800">${formatRp(d.nominal)}</span>
                            </div>
                        </div>
                    `;
                });
                
                updateView(`
                    <div class="bg-gray-50 min-h-screen pb-24">
                        <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm">
                            <button onclick="renderHome()"><i data-lucide="arrow-left" class="text-gray-600"></i></button>
                            <h1 class="font-semibold text-gray-800">Klaim Reimburse</h1>
                        </div>

                        <div class="p-5">
                            <div class="bg-cyan-50 p-5 rounded-2xl mb-8 border border-cyan-200 shadow-sm page-enter">
                                <h3 class="text-xs font-bold mb-4 text-cyan-800 uppercase flex items-center gap-2">
                                    <i data-lucide="receipt" class="w-4 h-4 text-cyan-600"></i> Buat Klaim Baru
                                </h3>

                                <div class="space-y-3">
                                    <div>
                                        <label class="text-[10px] font-bold text-cyan-700 ml-1">Kategori Pengeluaran</label>
                                        <select id="reim-tipe" class="w-full p-3 mt-1 rounded-xl border-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 shadow-sm">
                                            <option value="" disabled selected>-- Pilih Kategori --</option>
                                            <option value="Transportasi / Bensin">Transportasi / Bensin</option>
                                            <option value="Konsumsi / Makan">Konsumsi / Makan</option>
                                            <option value="ATK / Perlengkapan">ATK / Perlengkapan</option>
                                            <option value="Lainnya">Lainnya</option>
                                        </select>
                                    </div>

                                    <div class="grid grid-cols-2 gap-3">
                                        <div>
                                            <label class="text-[10px] font-bold text-cyan-700 ml-1">Tanggal Nota</label>
                                            <input type="date" id="reim-tgl" class="w-full p-2.5 mt-1 rounded-xl border-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 shadow-sm">
                                        </div>
                                        <div>
                                            <label class="text-[10px] font-bold text-cyan-700 ml-1">Nominal (Rp)</label>
                                            <input type="number" id="reim-nominal" placeholder="Contoh: 50000" class="w-full p-2.5 mt-1 rounded-xl border-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 shadow-sm">
                                        </div>
                                    </div>

                                    <div>
                                        <label class="text-[10px] font-bold text-cyan-700 ml-1">Keterangan Lengkap</label>
                                        <textarea id="reim-ket" rows="2" placeholder="Tulis rincian pembelian..." class="w-full p-3 mt-1 rounded-xl border-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 shadow-sm"></textarea>
                                    </div>

                                    <div class="bg-cyan-100/50 p-3 rounded-xl border border-cyan-200 mt-2">
                                        <p class="text-[9px] text-cyan-800 italic">* Simpan nota/struk fisik Anda. Tim Keuangan mungkin akan memintanya saat proses pencairan dana.</p>
                                    </div>

                                    <button onclick="kirimReimburse()" class="w-full bg-cyan-600 text-white font-bold py-3 mt-4 rounded-xl shadow-md active:scale-95 transition">
                                        Kirim Klaim
                                    </button>
                                </div>
                            </div>

                            <h3 class="text-sm font-bold text-gray-700 mb-3">Riwayat Klaim Saya</h3>
                            <div class="space-y-3">
                                ${listHTML || `
                                    <div class="p-8 text-center bg-white border-2 border-dashed border-gray-200 rounded-xl">
                                        <div class="w-12 h-12 bg-cyan-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <i data-lucide="wallet" class="text-cyan-400 w-6 h-6"></i>
                                        </div>
                                        <p class="text-gray-500 text-sm font-medium">Belum ada riwayat reimburse.</p>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                    ${bottomNav()}
                `);
            } catch (e) {
                console.error(e);
                updateView(`
                    <div class="p-10 text-center flex flex-col items-center gap-4">
                        <i data-lucide="alert-triangle" class="w-12 h-12 text-red-500"></i>
                        <p class="text-gray-600 text-sm">Gagal memuat data. Jangan lupa buat Index Firestore di tab Console ya!</p>
                        <button onclick="renderHome()" class="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium mt-2">Kembali</button>
                    </div>
                `);
            }
        };
        // Fungsi Simpan Reimburse
        window.kirimReimburse = async () => {
            if (!currentUser) return showToast("Harus login!");
            
            const tipe = document.getElementById('reim-tipe').value;
            const tanggal = document.getElementById('reim-tgl').value;
            const nominal = document.getElementById('reim-nominal').value;
            const keterangan = document.getElementById('reim-ket').value;
            
            // Validasi data tidak boleh kosong
            if (!tipe || !tanggal || !nominal || !keterangan) {
                return showToast("Lengkapi semua form pengajuan!");
            }
            
            // Pastikan nominalnya angka dan lebih dari 0
            const angkaNominal = Number(nominal);
            if (angkaNominal <= 0) {
                return showToast("Nominal harus lebih dari 0!");
            }
            
            const namaUser = currentUserProfile?.nama || currentUser.email.split('@')[0];
            const divisiUser = currentUserProfile?.divisi || "Tidak Diketahui";
            
            showToast("Mengirim data...");
            try {
                // Simpan ke database Firestore
                await addDoc(collection(db, "reimburse"), {
                    uid: currentUser.uid,
                    nama: namaUser,
                    divisi: divisiUser,
                    tipe: tipe,
                    tanggal: tanggal,
                    nominal: angkaNominal,
                    keterangan: keterangan,
                    status: "Menunggu", // Status awal selalu menunggu
                    waktu_pengajuan: serverTimestamp()
                });
                
                showToast("Klaim reimburse berhasil dikirim!");
                renderReimburse(); // Refresh halaman agar langsung muncul di bawah
            } catch (e) {
                console.error(e);
                showToast("Gagal mengirim data!");
            }
        };
        // --- PAGE: SLIP GAJI ---
        window.renderSlip = async () => {
            updateView(`<div class="flex flex-col items-center justify-center h-screen gap-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div><span class="text-gray-500">Memuat Data Slip Gaji...</span></div>`);
            
            try {
                // Ambil data slip gaji khusus user ini, urutkan dari yang terbaru
                const q = query(collection(db, "slip_gaji"), where("uid", "==", currentUser.uid), orderBy("periode", "desc"));
                const snap = await getDocs(q);
                
                let listHTML = '';
                
                snap.forEach(docSnap => {
                    const d = docSnap.data();
                    
                    // Format angka menjadi Rupiah (Rp)
                    const totalGaji = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(d.total_gaji || 0);
                    
                    // Ubah data slip menjadi teks agar bisa dikirim ke fungsi Bottom Sheet saat diklik
                    const slipDataStr = encodeURIComponent(JSON.stringify(d));
                    
                    listHTML += `
                        <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-3 page-enter flex flex-col gap-3">
                            <div class="flex justify-between items-center border-b border-gray-50 pb-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                        <i data-lucide="receipt" class="w-5 h-5"></i>
                                    </div>
                                    <div>
                                        <h3 class="font-bold text-gray-800 text-sm">${d.periode || 'Periode Tidak Diketahui'}</h3>
                                        <p class="text-[10px] text-gray-400">Diterbitkan: ${d.tgl_terbit ? new Date(d.tgl_terbit).toLocaleDateString('id-ID') : '-'}</p>
                                    </div>
                                </div>
                                <span class="text-[10px] font-bold px-2 py-1 rounded bg-green-50 text-green-600 border border-green-200">Lunas</span>
                            </div>
                            
                            <div class="flex justify-between items-end">
                                <div>
                                    <p class="text-[10px] text-gray-500 font-medium mb-1">Total Penerimaan</p>
                                    <p class="font-bold text-purple-700 text-lg">${totalGaji}</p>
                                </div>
                                <button onclick="bukaDetailSlip('${slipDataStr}')" class="text-xs font-bold text-purple-600 bg-purple-50 border border-purple-100 px-3 py-2 rounded-lg active:scale-95 transition">
                                    Lihat Detail
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                updateView(`
                    <div class="bg-gray-50 min-h-screen pb-24">
                        <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm">
                            <button onclick="renderHome()"><i data-lucide="arrow-left" class="text-gray-600"></i></button>
                            <h1 class="font-semibold text-gray-800">Slip Gaji</h1>
                        </div>
                        
                        <div class="bg-purple-600 text-white p-5 rounded-b-3xl shadow-md mb-6 relative overflow-hidden shrink-0">
                            <div class="relative z-10">
                                <h2 class="text-sm font-medium text-purple-100 mb-1">Informasi Penggajian</h2>
                                <p class="text-[11px] text-purple-200 leading-relaxed">Riwayat slip gaji Anda bersifat rahasia. Hubungi HRD/Manajemen jika ada ketidaksesuaian data absensi atau potongan.</p>
                            </div>
                            <i data-lucide="wallet" class="absolute -right-4 -bottom-4 w-24 h-24 text-purple-500 opacity-50"></i>
                        </div>

                        <div class="px-5">
                            <h3 class="text-sm font-bold text-gray-700 mb-3">Riwayat Slip Gaji</h3>
                            ${listHTML || `
                                <div class="p-8 text-center bg-white border-2 border-dashed border-gray-200 rounded-xl">
                                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <i data-lucide="file-x" class="text-gray-400 w-8 h-8"></i>
                                    </div>
                                    <p class="text-gray-500 text-sm font-medium">Belum ada slip gaji.</p>
                                    <p class="text-xs text-gray-400 mt-1">Slip gaji akan muncul di sini setelah diterbitkan oleh HRD.</p>
                                    
                                    <button onclick="buatSlipDemo()" class="mt-6 text-[10px] bg-purple-100 text-purple-600 px-3 py-2 rounded-lg font-bold shadow-sm active:scale-95 transition">
                                        + Buat 1 Slip Demo (Hanya Untuk Tes)
                                    </button>
                                </div>
                            `}
                        </div>
                    </div>
                    ${bottomNav()}
                `);
                
            } catch (e) {
                console.error(e);
                updateView(`
                    <div class="p-10 text-center flex flex-col items-center gap-4">
                        <i data-lucide="alert-triangle" class="w-12 h-12 text-red-500"></i>
                        <p class="text-gray-600 text-sm">Gagal memuat data slip. Fitur ini butuh Index Firestore baru.</p>
                        <button onclick="renderHome()" class="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium mt-2">Kembali</button>
                    </div>
                `);
            }
        };
        // Menampilkan Rincian Gaji di Bottom Sheet
        window.bukaDetailSlip = (dataStr) => {
            const data = JSON.parse(decodeURIComponent(dataStr));
            const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
            
            const overlay = document.getElementById('modal-overlay');
            const sheet = document.getElementById('bottom-sheet');
            const content = document.getElementById('sheet-content');
            
            content.innerHTML = `
                <div class="flex justify-between items-center mb-4 border-b pb-3">
                    <h3 class="font-bold text-gray-800 text-lg">Detail Slip Gaji</h3>
                    <span class="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-2 py-1 rounded">${data.periode}</span>
                </div>
                
                <div class="space-y-4 mb-6">
                    <div>
                        <h4 class="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider">Pemasukan</h4>
                        <div class="flex justify-between items-center mb-1.5">
                            <span class="text-xs text-gray-600">Gaji Pokok</span>
                            <span class="text-xs font-bold text-gray-800">${formatRp(data.gaji_pokok)}</span>
                        </div>
                        <div class="flex justify-between items-center mb-1.5">
                            <span class="text-xs text-gray-600">Tunjangan Transport</span>
                            <span class="text-xs font-bold text-gray-800">${formatRp(data.tunjangan)}</span>
                        </div>
                        <div class="flex justify-between items-center mb-1.5">
                            <span class="text-xs text-gray-600">Uang Lembur</span>
                            <span class="text-xs font-bold text-gray-800">${formatRp(data.lembur)}</span>
                        </div>
                    </div>
                    
                    <div class="border-t border-dashed border-gray-200 pt-3">
                        <h4 class="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider">Potongan</h4>
                        <div class="flex justify-between items-center mb-1.5">
                            <span class="text-xs text-gray-600">BPJS & Asuransi</span>
                            <span class="text-xs font-bold text-red-500">- ${formatRp(data.potongan_bpjs)}</span>
                        </div>
                        <div class="flex justify-between items-center mb-1.5">
                            <span class="text-xs text-gray-600">Keterlambatan/Absen</span>
                            <span class="text-xs font-bold text-red-500">- ${formatRp(data.potongan_absen)}</span>
                        </div>
                    </div>
                    
                    <div class="bg-purple-50 p-4 rounded-xl border border-purple-100 flex justify-between items-center mt-5">
                        <span class="text-xs font-bold text-purple-800">Take Home Pay</span>
                        <span class="text-lg font-bold text-purple-700">${formatRp(data.total_gaji)}</span>
                    </div>
                </div>
                
                <button onclick="closeModal()" class="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-xl active:scale-95 transition">Tutup Detail</button>
            `;
            
            // Munculkan animasinya
            overlay.classList.remove('hidden');
            setTimeout(() => {
                overlay.classList.remove('opacity-0');
                sheet.classList.add('open');
            }, 10);
        };
        
        // Tombol Rahasia untuk Membuat Data Demo
        window.buatSlipDemo = async () => {
            if (!currentUser) return;
            showToast("Membuat slip demo...");
            
            try {
                await addDoc(collection(db, "slip_gaji"), {
                    uid: currentUser.uid,
                    nama: currentUserProfile?.nama || currentUser.email,
                    periode: "Maret 2026",
                    tgl_terbit: new Date().toISOString(),
                    gaji_pokok: 3500000,
                    tunjangan: 500000,
                    lembur: 250000,
                    potongan_bpjs: 100000,
                    potongan_absen: 0,
                    total_gaji: 4150000, // (3.5M + 500K + 250K) - (100K + 0)
                    status: "Lunas"
                });
                renderSlip(); // Refresh agar tampil
            } catch (e) {
                console.error(e);
                showToast("Gagal membuat data demo");
            }
        };
        // --- PAGE: PENGUMUMAN ---
        window.renderPengumuman = async () => {
            updateView(`<div class="flex flex-col items-center justify-center h-screen gap-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div><span class="text-gray-500">Memuat Pengumuman...</span></div>`);
            
            try {
                // Ambil semua data pengumuman (tidak di-filter menggunakan uid karena ini untuk SEMUA karyawan)
                const q = query(collection(db, "pengumuman"), orderBy("waktu", "desc"));
                const snap = await getDocs(q);
                
                let listHTML = '';
                
                snap.forEach(docSnap => {
                    const d = docSnap.data();
                    const tgl = d.waktu?.toDate ? d.waktu.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Baru saja';
                    
                    listHTML += `
                        <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mb-4 page-enter relative overflow-hidden">
                            <div class="absolute top-0 left-0 w-1.5 h-full bg-yellow-400"></div>
                            <div class="flex items-center gap-3 mb-3">
                                <div class="bg-yellow-100 text-yellow-600 p-2 rounded-xl">
                                    <i data-lucide="megaphone" class="w-5 h-5"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold text-gray-800 text-sm leading-tight">${d.judul}</h3>
                                    <p class="text-[10px] text-gray-400 mt-0.5">Oleh: <span class="font-medium">${d.penulis || 'HRD'}</span> • ${tgl}</p>
                                </div>
                            </div>
                            <p class="text-xs text-gray-600 leading-relaxed whitespace-pre-line">${d.isi}</p>
                        </div>
                    `;
                });
                
                updateView(`
                    <div class="bg-gray-50 min-h-screen pb-24">
                        <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm">
                            <button onclick="renderHome()"><i data-lucide="arrow-left" class="text-gray-600"></i></button>
                            <h1 class="font-semibold text-gray-800">Pengumuman</h1>
                        </div>

                        <div class="bg-gradient-to-r from-yellow-500 to-orange-400 text-white p-6 rounded-b-3xl shadow-md mb-6 relative overflow-hidden shrink-0">
                            <div class="relative z-10">
                                <h2 class="text-lg font-bold text-white mb-1">Papan Informasi</h2>
                                <p class="text-xs text-yellow-50 leading-relaxed max-w-[85%]">Pantau terus pengumuman terbaru dari perusahaan agar tidak ketinggalan informasi penting.</p>
                            </div>
                            <i data-lucide="bell-ring" class="absolute -right-4 -bottom-4 w-28 h-28 text-yellow-400 opacity-40"></i>
                        </div>

                        <div class="px-5">
                            <div class="space-y-3">
                                ${listHTML || `
                                    <div class="p-8 text-center bg-white border-2 border-dashed border-gray-200 rounded-xl">
                                        <div class="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <i data-lucide="bell-off" class="text-yellow-400 w-8 h-8"></i>
                                        </div>
                                        <p class="text-gray-500 text-sm font-medium">Belum ada pengumuman.</p>
                                        
                                        <button onclick="buatPengumumanDemo()" class="mt-6 text-[10px] bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg font-bold shadow-sm active:scale-95 transition">
                                            + Buat 1 Pengumuman Demo
                                        </button>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                    ${bottomNav()}
                `);
                
            } catch (e) {
                console.error(e);
                updateView(`
                    <div class="p-10 text-center flex flex-col items-center gap-4">
                        <i data-lucide="alert-triangle" class="w-12 h-12 text-red-500"></i>
                        <p class="text-gray-600 text-sm">Gagal memuat pengumuman.</p>
                        <button onclick="renderHome()" class="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium mt-2">Kembali</button>
                    </div>
                `);
            }
        };
        // Fungsi Tombol Rahasia Pembuat Pengumuman
        window.buatPengumumanDemo = async () => {
            showToast("Membuat pengumuman demo...");
            try {
                // Menyimpan ke koleksi "pengumuman"
                await addDoc(collection(db, "pengumuman"), {
                    judul: "Aturan Libur Nasional Terdekat",
                    isi: "Diberitahukan kepada seluruh tim Penyetan 234, bahwa pada tanggal merah besok seluruh outlet akan tetap BUKA seperti biasa.\n\nBagi karyawan yang masuk, akan dihitung sebagai lembur hari libur nasional. Terima kasih atas kerja keras dan semangatnya! 💪",
                    penulis: "Manajemen Pusat",
                    waktu: serverTimestamp()
                });
                
                showToast("Pengumuman berhasil dibuat!");
                renderPengumuman(); // Segarkan halaman
            } catch (e) {
                console.error(e);
                showToast("Gagal membuat pengumuman demo!");
            }
        };
        // --- PAGE: KUESIONER ---
        window.renderKuesioner = () => {
            updateView(`
                <div class="bg-gray-50 min-h-screen pb-24">
                    <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm">
                        <button onclick="renderHome()"><i data-lucide="arrow-left" class="text-gray-600"></i></button>
                        <h1 class="font-semibold text-gray-800">Kuesioner Karyawan</h1>
                    </div>

                    <div class="bg-indigo-500 text-white p-6 rounded-b-3xl shadow-md mb-6 relative overflow-hidden shrink-0">
                        <div class="relative z-10">
                            <h2 class="text-lg font-bold text-white mb-1">Suara Anda Penting!</h2>
                            <p class="text-xs text-indigo-100 leading-relaxed max-w-[85%]">Bantu kami menciptakan lingkungan kerja yang lebih baik di Penyetan 234 dengan mengisi survei singkat ini.</p>
                        </div>
                        <i data-lucide="clipboard-list" class="absolute -right-4 -bottom-4 w-28 h-28 text-indigo-400 opacity-40"></i>
                    </div>

                    <div class="p-5">
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 page-enter">
                            <h3 class="text-sm font-bold text-gray-800 mb-1">Survei Kepuasan Kerja</h3>
                            <p class="text-[10px] text-gray-500 mb-5">Bagaimana pengalaman kerjamu minggu ini?</p>
                            
                            <label class="text-[10px] font-bold text-gray-500 ml-1">Penilaian (Wajib)</label>
                            <select id="kues-rating" class="w-full p-3 mt-1 mb-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-500 bg-white">
                                <option value="" disabled selected>-- Pilih Perasaanmu --</option>
                                <option value="Sangat Puas 😄">Sangat Puas 😄</option>
                                <option value="Puas 🙂">Puas 🙂</option>
                                <option value="Biasa Saja 😐">Biasa Saja 😐</option>
                                <option value="Tidak Puas 😔">Tidak Puas 😔</option>
                                <option value="Sangat Buruk 😠">Sangat Buruk 😠</option>
                            </select>

                            <label class="text-[10px] font-bold text-gray-500 ml-1">Masukan & Saran (Opsional)</label>
                            <textarea id="kues-saran" rows="4" placeholder="Ada kendala kerja? Atau saran untuk menu dan pelayanan? Tulis di sini..." class="w-full p-3 mt-1 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-500"></textarea>
                            
                            <button onclick="kirimKuesioner()" class="w-full bg-indigo-600 text-white font-bold py-3 mt-6 rounded-xl shadow-md active:scale-95 transition">
                                Kirim Jawaban
                            </button>
                        </div>
                    </div>
                </div>
                ${bottomNav()}
            `);
        };
        
        // Fungsi Simpan Kuesioner
        window.kirimKuesioner = async () => {
            if (!currentUser) return showToast("Harus login!");
            
            const rating = document.getElementById('kues-rating').value;
            const saran = document.getElementById('kues-saran').value;
            
            if (!rating) return showToast("Pilih penilaian kerjamu terlebih dahulu!");
            
            const namaUser = currentUserProfile?.nama || currentUser.email.split('@')[0];
            const divisiUser = currentUserProfile?.divisi || "Tidak Diketahui";
            
            showToast("Mengirim kuesioner...");
            try {
                // Simpan ke koleksi "kuesioner" di Firestore
                await addDoc(collection(db, "kuesioner"), {
                    uid: currentUser.uid,
                    nama: namaUser,
                    divisi: divisiUser,
                    rating: rating,
                    saran: saran,
                    waktu: serverTimestamp()
                });
                
                showToast("Terima kasih atas masukannya!");
                setTimeout(() => renderHome(), 1000); // Otomatis kembali ke Beranda setelah 1 detik
            } catch (e) {
                console.error(e);
                showToast("Gagal mengirim kuesioner!");
            }
        };
        // --- PAGE: BANTUAN ---
        window.renderBantuan = () => {
            updateView(`
                <div class="bg-gray-50 min-h-screen pb-24">
                    <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm">
                        <button onclick="renderHome()"><i data-lucide="arrow-left" class="text-gray-600"></i></button>
                        <h1 class="font-semibold text-gray-800">Pusat Bantuan</h1>
                    </div>

                    <div class="bg-rose-500 text-white p-6 rounded-b-3xl shadow-md mb-6 relative overflow-hidden shrink-0">
                        <div class="relative z-10">
                            <h2 class="text-lg font-bold text-white mb-1">Ada yang bisa dibantu?</h2>
                            <p class="text-xs text-rose-100 leading-relaxed max-w-[85%]">Temukan jawaban atas pertanyaan seputar absensi dan penggunaan aplikasi Penyetan 234 di sini.</p>
                        </div>
                        <i data-lucide="life-buoy" class="absolute -right-4 -bottom-4 w-28 h-28 text-rose-400 opacity-40"></i>
                    </div>

                    <div class="px-5">
                        <h3 class="text-sm font-bold text-gray-700 mb-3">Pertanyaan Umum (FAQ)</h3>
                        
                        <div class="space-y-3 mb-8 page-enter">
                            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <h4 class="text-xs font-bold text-gray-800 flex items-center gap-2 mb-2">
                                    <i data-lucide="help-circle" class="w-4 h-4 text-rose-500"></i> Saya lupa Clock Out, apa yang harus dilakukan?
                                </h4>
                                <p class="text-[10px] text-gray-500 leading-relaxed">Sistem akan mencatat Anda belum pulang. Silakan segera hubungi Admin/HRD untuk memperbaiki data jam pulang Anda secara manual.</p>
                            </div>

                            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <h4 class="text-xs font-bold text-gray-800 flex items-center gap-2 mb-2">
                                    <i data-lucide="help-circle" class="w-4 h-4 text-rose-500"></i> Bagaimana jika lokasi/GPS tidak terdeteksi?
                                </h4>
                                <p class="text-[10px] text-gray-500 leading-relaxed">Pastikan fitur Lokasi (GPS) di HP Anda menyala, lalu *refresh* halaman aplikasi. Jika masih bermasalah, coba gunakan jaringan WiFi outlet.</p>
                            </div>

                            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <h4 class="text-xs font-bold text-gray-800 flex items-center gap-2 mb-2">
                                    <i data-lucide="help-circle" class="w-4 h-4 text-rose-500"></i> Cara mengubah password yang lupa?
                                </h4>
                                <p class="text-[10px] text-gray-500 leading-relaxed">Jika Anda sudah login, masuk ke menu <b>Pengaturan Profil</b> untuk mengganti password. Jika belum login, silakan lapor ke Admin untuk di-reset.</p>
                            </div>
                        </div>

                        <div class="bg-rose-50 p-5 rounded-2xl border border-rose-100 shadow-sm text-center page-enter">
                            <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                                <i data-lucide="headphones" class="text-rose-500 w-6 h-6"></i>
                            </div>
                            <h3 class="text-xs font-bold text-gray-800 mb-1">Masih butuh bantuan?</h3>
                            <p class="text-[10px] text-gray-500 mb-4">Tim HRD/Admin kami siap membantu menyelesaikan kendala Anda.</p>
                            
                            <button onclick="hubungiAdmin()" class="w-full bg-rose-500 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition flex items-center justify-center gap-2">
                                <i data-lucide="message-circle" class="w-4 h-4"></i> Chat Admin (WhatsApp)
                            </button>
                        </div>
                    </div>
                </div>
                ${bottomNav()}
            `);
        };
        
        // Fungsi Tombol Hubungi Admin (Diarahkan ke WhatsApp)
        window.hubungiAdmin = () => {
            const nama = currentUserProfile?.nama || "Karyawan";
            const pesan = `Halo Admin, saya ${nama} dari divisi ${currentUserProfile?.divisi || '-'}. Saya butuh bantuan terkait aplikasi absensi.`;
            const nomorWA = "6281167051696"; // Ganti dengan nomor WA HRD yang asli (gunakan 62)
            
            // Buka link WhatsApp
            window.open(`https://wa.me/${nomorWA}?text=${encodeURIComponent(pesan)}`, '_blank');
        };
        // ==========================================
        //        BAGIAN KHUSUS HRD / ADMIN
        // ==========================================
        // --- 1. DASHBOARD UTAMA ADMIN ---
        window.renderAdminDashboard = () => {
            updateView(`
                <div class="bg-slate-50 min-h-screen pb-24">
                    <div class="sticky top-0 bg-slate-800 z-20 px-4 py-4 flex items-center gap-3 shadow-md">
                        <button onclick="renderHome()"><i data-lucide="arrow-left" class="text-slate-300"></i></button>
                        <h1 class="font-bold text-white tracking-wide">Manager Panel</h1>
                    </div>

                    <div class="p-5">
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6 flex items-center gap-4 page-enter">
                            <div class="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-white shadow-md">
                                <i data-lucide="shield-check" class="w-6 h-6"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-slate-800 text-sm">Mode Administrator</h3>
                                <p class="text-[10px] text-slate-500">Kelola operasional dan tim 234</p>
                            </div>
                        </div>

                        <h3 class="text-sm font-bold text-slate-700 mb-3">Pusat Persetujuan</h3>
                        <div class="grid grid-cols-2 gap-3 mb-6 page-enter">
                            <button onclick="renderAdminPengajuan()" class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center gap-2 active:scale-95 transition">
                                <div class="w-10 h-10 bg-lime-100 text-lime-600 rounded-full flex items-center justify-center"><i data-lucide="file-check-2"></i></div>
                                <span class="text-[11px] font-bold text-slate-700">Izin & Cuti</span>
                            </button>
                            <button onclick="renderAdminReimburse()" class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center gap-2 active:scale-95 transition">
                                <div class="w-10 h-10 bg-cyan-100 text-cyan-600 rounded-full flex items-center justify-center"><i data-lucide="wallet"></i></div>
                                <span class="text-[11px] font-bold text-slate-700">Reimburse</span>
                            </button>
                        </div>

                        <h3 class="text-sm font-bold text-slate-700 mb-3">Laporan & Manajemen</h3>
                        <div class="grid grid-cols-2 gap-3 mb-6 page-enter">
                            <button onclick="renderAdminRekap()" class="col-span-2 bg-slate-800 p-4 rounded-xl shadow-md border border-slate-700 flex items-center justify-center gap-3 active:scale-95 transition">
                                <div class="w-10 h-10 bg-slate-700 text-white rounded-full flex items-center justify-center"><i data-lucide="calendar-days"></i></div>
                                <span class="text-xs font-bold text-white">Laporan Rekap Absensi Bulanan</span>
                            </button>
                            
                            <button onclick="renderAdminPengumuman()" class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center gap-2 active:scale-95 transition">
                                <div class="w-10 h-10 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center"><i data-lucide="megaphone"></i></div>
                                <span class="text-[11px] font-bold text-slate-700">Buat Info</span>
                            </button>
                            <button onclick="renderAdminKuesioner()" class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center gap-2 active:scale-95 transition">
                                <div class="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center"><i data-lucide="message-square"></i></div>
                                <span class="text-[11px] font-bold text-slate-700">Kuesioner</span>
                            </button>
                            <button onclick="renderAdminSlip()" class="col-span-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-center gap-3 active:scale-95 transition">
                                <div class="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center"><i data-lucide="receipt"></i></div>
                                <span class="text-xs font-bold text-slate-700">Terbitkan Slip Gaji Karyawan</span>
                            </button>
                        </div>
                    </div>
                </div>
                ${bottomNav()}
            `);
        };
        
        // --- 2. HALAMAN APPROVAL IZIN/CUTI ---
        window.renderAdminPengajuan = async () => {
            updateView(`<div class="flex h-screen items-center justify-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div></div>`);
            try {
                // Ambil SEMUA pengajuan yang statusnya masih "Menunggu"
                const q = query(collection(db, "pengajuan"), where("status", "==", "Menunggu"));
                const snap = await getDocs(q);
                let listHTML = '';
                
                snap.forEach(docSnap => {
                    const d = docSnap.data();
                    const id = docSnap.id;
                    listHTML += `
                        <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-3 page-enter">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <h4 class="text-sm font-bold text-slate-800">${d.nama} <span class="text-[10px] font-normal text-slate-500">(${d.divisi})</span></h4>
                                    <span class="text-xs font-bold text-lime-700 bg-lime-50 px-2 py-0.5 rounded mt-1 inline-block">${d.tipe}</span>
                                </div>
                            </div>
                            <p class="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded border border-slate-100">"${d.alasan}"</p>
                            <p class="text-[10px] text-slate-500 mt-2 font-medium">Tgl: ${d.tgl_mulai} s/d ${d.tgl_selesai}</p>
                            
                            <div class="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                                <button onclick="prosesApproval('pengajuan', '${id}', 'Disetujui')" class="flex-1 bg-green-500 text-white text-xs font-bold py-2 rounded-lg active:scale-95 transition">Setujui</button>
                                <button onclick="prosesApproval('pengajuan', '${id}', 'Ditolak')" class="flex-1 bg-red-500 text-white text-xs font-bold py-2 rounded-lg active:scale-95 transition">Tolak</button>
                            </div>
                        </div>
                    `;
                });
                
                updateView(`
                    <div class="bg-slate-50 min-h-screen pb-24">
                        <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm">
                            <button onclick="renderAdminDashboard()"><i data-lucide="arrow-left" class="text-slate-600"></i></button>
                            <h1 class="font-semibold text-slate-800">Approval Izin & Cuti</h1>
                        </div>
                        <div class="p-5">${listHTML || '<div class="text-center text-slate-400 mt-10 text-sm">Tidak ada antrean pengajuan.</div>'}</div>
                    </div>
                `);
            } catch (e) { showToast("Gagal memuat data"); }
        };
        
        // --- 3. HALAMAN APPROVAL REIMBURSE ---
        window.renderAdminReimburse = async () => {
            updateView(`<div class="flex h-screen items-center justify-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div></div>`);
            try {
                const q = query(collection(db, "reimburse"), where("status", "==", "Menunggu"));
                const snap = await getDocs(q);
                let listHTML = '';
                const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(angka || 0);
                
                snap.forEach(docSnap => {
                    const d = docSnap.data();
                    const id = docSnap.id;
                    listHTML += `
                        <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-3 page-enter">
                            <h4 class="text-sm font-bold text-slate-800">${d.nama} <span class="text-[10px] font-normal text-slate-500">(${d.divisi})</span></h4>
                            <div class="flex justify-between items-center mt-2">
                                <span class="text-xs font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded">${d.tipe}</span>
                                <span class="text-sm font-bold text-slate-800">${formatRp(d.nominal)}</span>
                            </div>
                            <p class="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded border border-slate-100">"${d.keterangan}"</p>
                            
                            <div class="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                                <button onclick="prosesApproval('reimburse', '${id}', 'Disetujui')" class="flex-1 bg-green-500 text-white text-xs font-bold py-2 rounded-lg active:scale-95 transition">Setujui</button>
                                <button onclick="prosesApproval('reimburse', '${id}', 'Ditolak')" class="flex-1 bg-red-500 text-white text-xs font-bold py-2 rounded-lg active:scale-95 transition">Tolak</button>
                            </div>
                        </div>
                    `;
                });
                
                updateView(`
                    <div class="bg-slate-50 min-h-screen pb-24">
                        <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm">
                            <button onclick="renderAdminDashboard()"><i data-lucide="arrow-left" class="text-slate-600"></i></button>
                            <h1 class="font-semibold text-slate-800">Approval Reimburse</h1>
                        </div>
                        <div class="p-5">${listHTML || '<div class="text-center text-slate-400 mt-10 text-sm">Tidak ada antrean klaim.</div>'}</div>
                    </div>
                `);
            } catch (e) { showToast("Gagal memuat data"); }
        };
        
        // --- 4. FUNGSI EKSEKUSI UPDATE STATUS KE FIREBASE ---
        window.prosesApproval = async (koleksi, docId, statusBaru) => {
            if (!confirm(`Yakin ingin mengubah status menjadi ${statusBaru}?`)) return;
            showToast("Memproses...");
            try {
                await updateDoc(doc(db, koleksi, docId), { status: statusBaru });
                showToast(`Berhasil ${statusBaru}!`);
                
                // Refresh halaman yang sedang dibuka
                if (koleksi === 'pengajuan') renderAdminPengajuan();
                if (koleksi === 'reimburse') renderAdminReimburse();
            } catch (e) {
                console.error(e);
                showToast("Gagal memperbarui status");
            }
        };
        // --- 5. HALAMAN BUAT PENGUMUMAN (ADMIN) ---
        window.renderAdminPengumuman = () => {
            updateView(`
                <div class="bg-slate-50 min-h-screen pb-24">
                    <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm">
                        <button onclick="renderAdminDashboard()"><i data-lucide="arrow-left" class="text-slate-600"></i></button>
                        <h1 class="font-semibold text-slate-800">Buat Pengumuman Baru</h1>
                    </div>
                    
                    <div class="p-5 page-enter">
                        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                            <label class="text-xs font-bold text-slate-500">Judul Pengumuman</label>
                            <input type="text" id="admin-judul-pengumuman" placeholder="Contoh: Info Libur Lebaran" class="w-full p-3 mt-1 mb-4 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-slate-800">
                            
                            <label class="text-xs font-bold text-slate-500">Isi Pengumuman</label>
                            <textarea id="admin-isi-pengumuman" rows="6" placeholder="Ketik detail pengumuman di sini..." class="w-full p-3 mt-1 mb-6 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-slate-800"></textarea>
                            
                            <button onclick="kirimPengumumanAdmin()" class="w-full bg-slate-800 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition">
                                Publikasikan Sekarang
                            </button>
                        </div>
                    </div>
                </div>
                ${bottomNav()}
            `);
        };
        
        // Fungsi Simpan Pengumuman Asli
        window.kirimPengumumanAdmin = async () => {
            const judul = document.getElementById('admin-judul-pengumuman').value;
            const isi = document.getElementById('admin-isi-pengumuman').value;
            
            if (!judul || !isi) return showToast("Judul dan isi tidak boleh kosong!");
            
            showToast("Mempublikasikan...");
            try {
                await addDoc(collection(db, "pengumuman"), {
                    judul: judul,
                    isi: isi,
                    penulis: currentUserProfile?.nama || "Management",
                    waktu: serverTimestamp()
                });
                
                showToast("Pengumuman berhasil disiarkan!");
                renderAdminDashboard(); // Kembali ke dashboard admin
            } catch (e) {
                console.error(e);
                showToast("Gagal mempublikasikan pengumuman");
            }
        };
        
        // --- 6. HALAMAN BACA KUESIONER (ADMIN) ---
        window.renderAdminKuesioner = async () => {
            updateView(`<div class="flex h-screen items-center justify-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div></div>`);
            try {
                // Ambil semua kuesioner dari yang terbaru
                const q = query(collection(db, "kuesioner"), orderBy("waktu", "desc"));
                const snap = await getDocs(q);
                let listHTML = '';
                
                snap.forEach(docSnap => {
                    const d = docSnap.data();
                    const tgl = d.waktu?.toDate ? d.waktu.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
                    
                    listHTML += `
                        <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-3 page-enter">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <h4 class="text-sm font-bold text-slate-800">${d.nama} <span class="text-[10px] font-normal text-slate-500">(${d.divisi})</span></h4>
                                    <p class="text-[10px] text-slate-400">${tgl}</p>
                                </div>
                                <span class="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">${d.rating}</span>
                            </div>
                            ${d.saran ? `<div class="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100"><p class="text-xs text-slate-600 italic">"${d.saran}"</p></div>` : `<p class="text-[10px] text-slate-400 mt-2 italic">Tidak ada saran tertulis.</p>`}
                        </div>
                    `;
                });
                
                updateView(`
                    <div class="bg-slate-50 min-h-screen pb-24">
                        <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm">
                            <button onclick="renderAdminDashboard()"><i data-lucide="arrow-left" class="text-slate-600"></i></button>
                            <h1 class="font-semibold text-slate-800">Hasil Kuesioner Tim</h1>
                        </div>
                        <div class="p-5">${listHTML || '<div class="text-center text-slate-400 mt-10 text-sm">Belum ada data kuesioner.</div>'}</div>
                    </div>
                `);
            } catch (e) {
                console.error(e);
                showToast("Gagal memuat data (Mungkin butuh Index Firestore)");
            }
        };
        // --- 7. HALAMAN PENERBITAN SLIP GAJI (ADMIN) ---
        window.renderAdminSlip = async () => {
            updateView(`<div class="flex h-screen items-center justify-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div></div>`);
            try {
                // Ambil daftar karyawan dari database (tapi sembunyikan yang statusnya Admin)
                const snapUsers = await getDocs(collection(db, "users"));
                let userOptions = '<option value="" disabled selected>-- Pilih Karyawan --</option>';
                
                snapUsers.forEach(doc => {
                    const u = doc.data();
                    if (u.role !== 'Admin') {
                        // Kita gabungkan ID (uid) dan Nama dengan pemisah "|" agar mudah dikirim
                        userOptions += `<option value="${doc.id}|${u.nama}">${u.nama} (${u.divisi})</option>`;
                    }
                });
                
                updateView(`
                    <div class="bg-slate-50 min-h-screen pb-24">
                        <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm">
                            <button onclick="renderAdminDashboard()"><i data-lucide="arrow-left" class="text-slate-600"></i></button>
                            <h1 class="font-semibold text-slate-800">Penerbitan Slip Gaji</h1>
                        </div>
                        
                        <div class="p-5 page-enter">
                            <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                                
                                <label class="text-[10px] font-bold text-slate-500 uppercase">Pilih Karyawan</label>
                                <select id="admin-slip-user" class="w-full p-3 mt-1 mb-4 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-purple-500">
                                    ${userOptions}
                                </select>

                                <label class="text-[10px] font-bold text-slate-500 uppercase">Periode Penggajian</label>
                                <input type="text" id="admin-slip-periode" placeholder="Contoh: April 2026" class="w-full p-3 mt-1 mb-5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-purple-500">
                                
                                <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                                    <h4 class="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-1"><i data-lucide="trending-up" class="w-3 h-3 text-green-500"></i> Pemasukan</h4>
                                    <input type="number" id="admin-slip-pokok" placeholder="Gaji Pokok (Rp)" class="w-full p-3 mb-2 border border-white rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                                    <input type="number" id="admin-slip-tunjangan" placeholder="Tunjangan (Rp)" class="w-full p-3 mb-2 border border-white rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                                    <input type="number" id="admin-slip-lembur" placeholder="Lembur (Rp)" class="w-full p-3 border border-white rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                                </div>

                                <div class="bg-red-50 p-4 rounded-xl border border-red-100 mb-6">
                                    <h4 class="text-[10px] font-bold text-red-400 mb-3 uppercase tracking-wider flex items-center gap-1"><i data-lucide="trending-down" class="w-3 h-3 text-red-500"></i> Potongan</h4>
                                    <input type="number" id="admin-slip-bpjs" placeholder="BPJS / Asuransi (Rp)" class="w-full p-3 mb-2 border border-white rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                                    <input type="number" id="admin-slip-absen" placeholder="Potongan Telat/Absen (Rp)" class="w-full p-3 border border-white rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                                </div>
                                
                                <button onclick="kirimSlipAdmin()" class="w-full bg-purple-600 text-white font-bold py-3.5 rounded-xl shadow-md active:scale-95 transition">
                                    Terbitkan & Kirim Slip
                                </button>
                            </div>
                        </div>
                    </div>
                    ${bottomNav()}
                `);
            } catch (e) {
                console.error(e);
                showToast("Gagal memuat daftar karyawan");
            }
        };
        
        // Fungsi Menyimpan dan Menghitung Total Slip Gaji
        window.kirimSlipAdmin = async () => {
            const userVal = document.getElementById('admin-slip-user').value;
            const periode = document.getElementById('admin-slip-periode').value;
            
            // Konversi teks input menjadi angka (Number), jika kosong jadikan 0
            const pokok = Number(document.getElementById('admin-slip-pokok').value) || 0;
            const tunjangan = Number(document.getElementById('admin-slip-tunjangan').value) || 0;
            const lembur = Number(document.getElementById('admin-slip-lembur').value) || 0;
            const bpjs = Number(document.getElementById('admin-slip-bpjs').value) || 0;
            const absen = Number(document.getElementById('admin-slip-absen').value) || 0;
            
            if (!userVal || !periode || pokok <= 0) return showToast("Pilih karyawan, periode, dan isi Gaji Pokok!");
            
            // Pecah gabungan nilai "uid|nama"
            const [uid, nama] = userVal.split('|');
            
            // Komputer menghitung Take Home Pay otomatis
            const total = (pokok + tunjangan + lembur) - (bpjs + absen);
            
            showToast("Menerbitkan slip gaji...");
            try {
                // Simpan ke database khusus slip_gaji
                await addDoc(collection(db, "slip_gaji"), {
                    uid: uid,
                    nama: nama,
                    periode: periode,
                    tgl_terbit: new Date().toISOString(),
                    gaji_pokok: pokok,
                    tunjangan: tunjangan,
                    lembur: lembur,
                    potongan_bpjs: bpjs,
                    potongan_absen: absen,
                    total_gaji: total,
                    status: "Lunas"
                });
                
                showToast("Slip gaji berhasil dikirim ke karyawan!");
                renderAdminDashboard(); // Kembali ke panel manager
            } catch (e) {
                console.error(e);
                showToast("Gagal menerbitkan slip");
            }
        };
        // --- 8. HALAMAN REKAP ABSENSI (ADMIN) ---
        window.renderAdminRekap = () => {
            // Ambil bulan dan tahun saat ini sebagai nilai bawaan (Default)
            const today = new Date();
            const defaultBulan = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; // Hasil: "2026-03"
            
            updateView(`
                <div class="bg-slate-50 min-h-screen pb-24">
                    <div class="sticky top-0 bg-white z-20 px-4 py-3 flex items-center gap-3 border-b shadow-sm">
                        <button onclick="renderAdminDashboard()"><i data-lucide="arrow-left" class="text-slate-600"></i></button>
                        <h1 class="font-semibold text-slate-800">Rekap Absensi</h1>
                    </div>
                    
                    <div class="p-5">
                        <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-5 flex gap-3 items-end page-enter">
                            <div class="flex-1">
                                <label class="text-[10px] font-bold text-slate-500 uppercase">Pilih Bulan & Tahun</label>
                                <input type="month" id="input-bulan-rekap" value="${defaultBulan}" class="w-full p-2.5 mt-1 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-800">
                            </div>
                            <button onclick="hitungRekapBulanan()" class="bg-slate-800 text-white p-3 rounded-xl shadow-md active:scale-95 transition shrink-0">
                                <i data-lucide="search" class="w-5 h-5"></i>
                            </button>
                        </div>

                        <div class="flex justify-between items-end mb-3">
                            <h3 class="text-sm font-bold text-slate-700">Hasil Rekapitulasi</h3>
                            <span id="label-bulan-rekap" class="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded">Bulan Ini</span>
                        </div>
                        
                        <div id="rekap-container" class="space-y-3">
                            <div class="text-center text-slate-400 mt-10 text-sm"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-400 mx-auto mb-2"></div>Menghitung data...</div>
                        </div>
                    </div>
                </div>
                ${bottomNav()}
            `);
            
            // Langsung hitung otomatis saat halaman dibuka
            hitungRekapBulanan();
        };
        
        // Mesin Penghitung Rekap (Lengkap dengan Sakit, Izin, Cuti)
        window.hitungRekapBulanan = async () => {
            const bulanTahun = document.getElementById('input-bulan-rekap').value; // Contoh: "2026-03"
            if (!bulanTahun) return showToast("Pilih bulan terlebih dahulu!");
            
            document.getElementById('label-bulan-rekap').innerText = bulanTahun;
            const container = document.getElementById('rekap-container');
            container.innerHTML = `<div class="text-center text-slate-400 mt-10 text-sm"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-400 mx-auto mb-2"></div>Menghitung rekap komplit...</div>`;
            
            try {
                // 1. Kumpulkan daftar semua karyawan dari database
                const snapUsers = await getDocs(collection(db, "users"));
                let dataRekap = {};
                
                snapUsers.forEach(doc => {
                    const u = doc.data();
                    if (u.role !== 'Admin') {
                        dataRekap[doc.id] = {
                            nama: u.nama || (u.email ? u.email.split('@')[0] : 'Karyawan'),
                            divisi: u.divisi || '-',
                            hadir: 0,
                            terlambat: 0,
                            lembur: 0,
                            sakit: 0,
                            izin: 0,
                            cuti: 0 // <-- Kita tambahkan 3 kantong baru
                        };
                    }
                });
                
                // 2. Tarik data absensi biasa (Hadir, Telat, Lembur)
                const snapAbsen = await getDocs(collection(db, "absensi"));
                snapAbsen.forEach(doc => {
                    const d = doc.data();
                    if (d.tanggal && d.tanggal.startsWith(bulanTahun)) {
                        const uid = d.uid;
                        if (dataRekap[uid]) {
                            if (d.tipe === 'Clock In') {
                                dataRekap[uid].hadir += 1;
                                if (d.status === 'Terlambat') dataRekap[uid].terlambat += 1;
                            }
                            if (d.tipe === 'Clock In Lembur') dataRekap[uid].lembur += 1;
                        }
                    }
                });
                
                // 3. Tarik data pengajuan (Sakit, Izin, Cuti)
                const snapPengajuan = await getDocs(collection(db, "pengajuan"));
                snapPengajuan.forEach(doc => {
                    const p = doc.data();
                    // Kita hanya hitung yang sudah "Disetujui" oleh Manager di bulan tersebut
                    if (p.status === 'Disetujui' && p.tgl_mulai && p.tgl_mulai.startsWith(bulanTahun)) {
                        const uid = p.uid;
                        if (dataRekap[uid]) {
                            // Komputer menghitung selisih hari (Tgl Selesai dikurangi Tgl Mulai)
                            const start = new Date(p.tgl_mulai);
                            const end = new Date(p.tgl_selesai || p.tgl_mulai);
                            const diffTime = Math.abs(end - start);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Ditambah 1 agar adil
                            
                            // Masukkan jumlah harinya ke kantong yang tepat
                            if (p.tipe === 'Sakit') dataRekap[uid].sakit += diffDays;
                            else if (p.tipe === 'Izin') dataRekap[uid].izin += diffDays;
                            else if (p.tipe === 'Cuti') dataRekap[uid].cuti += diffDays;
                        }
                    }
                });
                
                // 4. Ubah hasil hitungan menjadi Kartu HTML (Desain Baru agar muat 6 Kotak)
                let htmlTabel = '';
                for (const uid in dataRekap) {
                    const k = dataRekap[uid];
                    htmlTabel += `
                        <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-3 page-enter">
                            <div class="mb-3">
                                <h4 class="text-sm font-bold text-slate-800">${k.nama}</h4>
                                <p class="text-[10px] text-slate-500">${k.divisi}</p>
                            </div>
                            
                            <div class="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <div class="text-center">
                                    <p class="text-[9px] font-bold text-slate-400 uppercase">Hadir</p>
                                    <p class="text-sm font-bold text-green-600">${k.hadir}</p>
                                </div>
                                <div class="text-center">
                                    <p class="text-[9px] font-bold text-slate-400 uppercase">Telat</p>
                                    <p class="text-sm font-bold text-red-500">${k.terlambat}</p>
                                </div>
                                <div class="text-center">
                                    <p class="text-[9px] font-bold text-slate-400 uppercase">Lembur</p>
                                    <p class="text-sm font-bold text-blue-500">${k.lembur}</p>
                                </div>
                                
                                <div class="text-center mt-2 pt-2 border-t border-slate-200">
                                    <p class="text-[9px] font-bold text-slate-400 uppercase">Sakit</p>
                                    <p class="text-sm font-bold text-orange-500">${k.sakit}</p>
                                </div>
                                <div class="text-center mt-2 pt-2 border-t border-slate-200">
                                    <p class="text-[9px] font-bold text-slate-400 uppercase">Izin</p>
                                    <p class="text-sm font-bold text-yellow-600">${k.izin}</p>
                                </div>
                                <div class="text-center mt-2 pt-2 border-t border-slate-200">
                                    <p class="text-[9px] font-bold text-slate-400 uppercase">Cuti</p>
                                    <p class="text-sm font-bold text-purple-500">${k.cuti}</p>
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                container.innerHTML = htmlTabel || '<div class="text-center text-slate-400 mt-10 text-sm border-2 border-dashed border-slate-200 p-6 rounded-xl">Belum ada data karyawan.</div>';
            } catch (e) {
                console.error(e);
                container.innerHTML = '<div class="text-center text-red-500 mt-10 text-sm">Gagal menghitung data.</div>';
            }
        };
        // --- NAVIGATION & INIT ---
        window.navigateTo = (pageId) => {
            if (pageId === 'absensi') renderDailyAttendance();
            else if (pageId === 'jadwal') renderSchedule();
            else if (pageId === 'pengaturan') renderPengaturan();
            else if (pageId === 'aktivitas') renderAktivitas();
            else if (pageId === 'pengajuan') renderPengajuan();
            else if (pageId === 'slip') renderSlip();
            else if (pageId === 'tugas') renderTugas();
            else if (pageId === 'reimburse') renderReimburse();
            else if (pageId === 'pengumuman') renderPengumuman();
            else if (pageId === 'kuesioner') renderKuesioner();
            else if (pageId === 'bantuan') renderBantuan();
            else if (pageId === 'rekap') renderAdminRekap(); // <-- TAMBAHKAN BARIS INI (Khusus Rekap)
            else if (pageId === 'admin') {
                if (currentUserProfile?.role === 'Admin') renderAdminDashboard();
                else showToast("Akses Ditolak: Anda bukan HRD/Admin!");
            }
            else showToast("Fitur " + pageId + " segera hadir");
        };
        
        window.showToast = (msg) => {
            const t = document.getElementById('toast-container');
            document.getElementById('toast-message').innerText = msg;
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 3000);
        };
        window.renderHome = renderHome;
        window.renderDailyAttendance = renderDailyAttendance;
        window.renderLogin = () => updateView(`<div class="min-h-screen bg-waktoo-bg flex flex-col justify-center p-6"><div class="text-center mb-8"><h2 class="text-2xl font-bold text-gray-800">Login Presensi</h2></div><div class="bg-white p-6 rounded-2xl shadow-sm"><input id="login-email" class="w-full mb-4 p-3 border rounded-lg" placeholder="Email"><input type="password" id="login-password" class="w-full mb-6 p-3 border rounded-lg" placeholder="Password"><button onclick="handleLogin()" class="w-full bg-waktoo-green text-white font-bold py-3 rounded-lg">Masuk</button></div><p class="text-center mt-6 text-sm">Belum punya akun? <button onclick="renderRegister()" class="text-waktoo-green font-bold">Daftar</button></p></div>`);
        window.renderRegister = () => updateView(`
    <div class="min-h-screen bg-waktoo-bg flex flex-col justify-center p-6">
        <button onclick="renderLogin()" class="absolute top-6 left-6"><i data-lucide="arrow-left"></i></button>
        <div class="text-center mb-8 mt-10"><h2 class="text-2xl font-bold text-gray-800">Daftar Akun</h2></div>
        <div class="bg-white p-6 rounded-2xl shadow-sm">
            <input id="reg-nama" class="w-full mb-4 p-3 border rounded-lg" placeholder="Nama Lengkap">
            <input id="reg-email" class="w-full mb-4 p-3 border rounded-lg" placeholder="Email">
            <input type="password" id="reg-password" class="w-full mb-4 p-3 border rounded-lg" placeholder="Password">
            <select id="reg-divisi" class="w-full mb-6 p-3 border rounded-lg text-gray-600 bg-white">
                <option value="" disabled selected>Pilih Divisi Anda...</option>
                ${DIVISI_LIST.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
            <button onclick="handleRegister()" class="w-full bg-waktoo-green text-white font-bold py-3 rounded-lg">Daftar</button>
        </div>
    </div>
`);
        
        onAuthStateChanged(auth, async (user) => {
            currentUser = user;
            if (user) {
                // Ambil data divisi user dari Firestore saat dia login
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        currentUserProfile = userDoc.data();
                    } else {
                        currentUserProfile = { divisi: "Belum Diatur" }; // Jika akun lama belum punya divisi
                    }
                } catch (e) {
                    console.error("Gagal ambil profil", e);
                    currentUserProfile = { divisi: "Error" };
                }
                renderHome();
            } else {
                currentUserProfile = null;
                renderLogin();
            }
        });
        // Mendaftarkan Service Worker untuk PWA
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('ServiceWorker PWA terdaftar dengan sukses: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker PWA gagal didaftarkan: ', err);
                });
            });
        }