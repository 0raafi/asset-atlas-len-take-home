# Atlas Aset

Atlas Aset adalah aplikasi untuk melihat dan mengelola lokasi perangkat IoT, kendaraan, dan fasilitas di peta. Kamu bisa membuka detail dari marker atau daftar aset, menambah aset, memindahkan lokasi, dan menghapus aset dengan konfirmasi.

## Menjalankan aplikasi

Siapkan Go 1.23 atau lebih baru dan Node.js 22.12 atau lebih baru. Jalankan perintah berikut dari root repo.

```sh
npm ci --prefix web
npm run build --prefix web
go run ./cmd/atlas-aset -seed
```

Buka [Atlas Aset di localhost](http://127.0.0.1:8080). Opsi `-seed` memasukkan enam aset fiktif di Bandung saat database pertama kali dibuat. Data disimpan di `data/assets.db` dan tetap ada setelah server dimulai ulang. Untuk mulai dengan database kosong, jalankan server dengan `-db data/kosong.db`.

Untuk pengembangan frontend, jalankan backend seperti di atas dan jalankan `npm run dev --prefix web` di terminal lain. Vite meneruskan permintaan `/api` ke backend lokal.

Peta dasar memakai tile OpenStreetMap dan membutuhkan internet. Daftar, detail, koordinat, dan operasi aset tetap dapat dipakai jika tile gagal dimuat. `VITE_TILE_URL` dapat dipakai saat build untuk memilih endpoint alternatif dengan atribusi OpenStreetMap yang sama.

## Demo singkat

1. Klik marker atau baris **Sensor Braga** untuk membuka detail.
2. Pilih **Tambah aset**, klik titik di peta, isi nama, jenis, dan status, lalu simpan. Koordinat juga bisa diisi langsung dengan pemisah desimal titik atau koma.
3. Buka **Edit aset**, ubah status, lalu pilih titik lain. Simpan dan muat ulang halaman untuk memeriksa lokasi baru.
4. Pilih **Hapus aset** dan konfirmasi. Setelah halaman dimuat ulang, aset tetap hilang dari daftar dan peta.

## Struktur dan pilihan teknologi

| Komponen | Alasan pemilihan |
| --- | --- |
| React + TypeScript | Tipe data aset dipakai bersama oleh form, daftar, dan peta. State React lokal cukup untuk alur satu halaman. |
| React Leaflet + OpenStreetMap | Leaflet menyediakan marker dan event pemilihan titik. React Leaflet menghubungkannya ke state halaman, dan tile OpenStreetMap menyediakan peta dasar dengan atribusi terlihat. |
| Vite + Lucide | Vite menyediakan server pengembangan dan build statis. Lucide menjaga ikon kontrol peta dan aksi konsisten. |
| Go `net/http` + `database/sql` | Pustaka standar menangani routing, HTTP, dan akses database pada API kecil ini. Go juga menyajikan build frontend sehingga UI dan API berbagi satu origin. |
| SQLite + `modernc.org/sqlite` | Satu file database cukup untuk penyimpanan lokal. Driver Go murni memudahkan setup tanpa server database atau toolchain C. |

### API

| Metode dan path | Perilaku |
| --- | --- |
| `GET /api/assets` | Mengembalikan daftar aset. Data yang sama tampil di marker dan panel detail. |
| `POST /api/assets` | Membuat aset dan mengembalikannya dengan ID baru. |
| `PUT /api/assets/{id}` | Mengganti atribut dan koordinat aset. ID tetap sama. |
| `DELETE /api/assets/{id}` | Menghapus aset dan mengembalikan `204 No Content`. |

Body JSON untuk tambah dan edit berisi `name`, `type`, `status`, `latitude`, dan `longitude`. Jenis yang tersedia adalah `device`, `vehicle`, dan `facility`. Status yang tersedia adalah `active`, `maintenance`, dan `inactive`. Frontend memberi pesan di field yang keliru, sementara API memvalidasi ulang dan mengembalikan `422` beserta kesalahan per field. Lintang mengikuti batas Web Mercator ±85,05112878° dan bujur mengikuti rentang ±180°.

## Verifikasi

```sh
go test ./...
go vet ./...
npm run typecheck --prefix web
npm run build --prefix web
```

Tes Go menguji API lewat HTTP handler dengan SQLite sementara. Kasus yang dicakup meliputi persistensi setelah database dibuka kembali, koordinat nol, penolakan input invalid, perubahan lokasi dengan ID yang sama, dan penghapusan berdasarkan ID.

Uji browser Chrome mencakup CRUD, validasi form, pemilihan titik, perubahan label marker, draft saat API gagal, pembatalan hapus dengan keyboard, persistensi setelah restart backend, serta tampilan pada lebar 320 px. Uji otomatis memakai tile pengganti agar hasilnya tidak bergantung pada jaringan. Kondisi tile gagal dimuat juga diuji secara terpisah.

## Penggunaan Agentic AI

Kandidat menyetujui scope, pilihan stack, urutan tiket, dan cakupan pengujian. Codex membaca instruksi skill dari [repo Matt Pocock](https://github.com/mattpocock/skills) dan menerapkannya saat mengerjakan aplikasi.

1. `grill-with-docs` dipakai untuk memperjelas istilah dan alur peta. Hasilnya menjadi glosarium dan kriteria yang disetujui.
2. `to-tickets` memecah pekerjaan menjadi alur tambah dan lihat detail, edit lokasi, serta hapus. Tiket lokal ada di [.scratch/atlas-aset/issues](.scratch/atlas-aset/issues).
3. `implement` dan `tdd` dipakai untuk menulis kode Go dan React. Codex menjalankan tes API tambah, edit, dan hapus sebelum menambahkan handler terkait, lalu menjalankan ulang tes setelah implementasi.
4. `code-review` dipakai untuk memeriksa kode dan kesesuaian dengan soal. Review menemukan koordinat kecil yang gagal diedit saat tampil dalam notasi eksponen dan label marker yang tertinggal setelah aset berganti nama. Keduanya diperbaiki.

Panduan kerja agent untuk repo ini ada di [AGENT.md](AGENT.md).
