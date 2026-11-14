# Petadistan

Buat sebuah aplikasi Web GIS interaktif yang modern, bersih, dan sangat mudah digunakan untuk level pimpinan (eksekutif). Aplikasi ini harus membaca data secara real-time dari Google Sheets menggunakan Share Link biasa (bukan publish to web) dan menampilkan file peta berformat GeoJSON yang disimpan di Google Drive.

Link Google Sheets: https://docs.google.com/spreadsheets/d/1bwY_CkNt4DSdfZJWI4c69uuX6WVyHgm1cwKXPMMy1TU/edit?usp=sharing

Fitur UI & Layout:
1. Tampilan Layar Penuh (Split-Screen Dashboard):
   - Sisi Kiri (Sidebar Kontrol): Menampilkan daftar nama peta dalam bentuk Checkbox secara dinamis. Daftar ini harus digenerate otomatis berdasarkan baris data dari Google Sheets. Sediakan fitur pencarian cepat di bagian atas dan pengelompokan berdasarkan kolom 'kategori'.
   - Sisi Kanan (Peta Utama): Menggunakan library peta interaktif modern (seperti Leaflet atau MapLibre/Mapbox). Gunakan basemap yang minimalis (Clean Light mode) sebagai default agar GeoJSON terlihat jelas, serta sediakan tombol switch ke mode Satellite View.

2. Integrasi Google Sheets (Database):
   - Aplikasi harus membaca data dari Google Sheets dengan struktur kolom (baik 'nama peta' / 'nama_peta', 'link json' / 'link_geojson', kategori, keterangan). Gunakan endpoint gviz/tq untuk membaca real-time share link tanpa perlu publish to web.
   - Sediakan juga input pengaturan URL Google Sheets agar fleksibel jika ingin mengganti spreadsheet.
   - Aplikasi akan membaca link pada kolom GeoJSON (Google Drive share link) untuk mengunduh dan merender data spasial ke peta saat checkbox terkait dicentang oleh pimpinan. Tangani Google Drive URL secara otomatis (konversi link sharing menjadi download/proxy yang aman dari masalah browser CORS).

3. Fitur Otomatisasi "Tinggal Makan" untuk Pimpinan (Sangat Penting):
   - Pewarnaan Otomatis & Kontras: Setiap file GeoJSON yang aktif (dicentang) harus otomatis diberikan warna yang berbeda satu sama lain menggunakan palet warna korporat/pastel yang estetis dan nyaman di mata.
   - Transparansi Layer: Berikan opacity default sebesar 0.6 agar lapisan peta yang bertumpuk tetap tembus pandang dan bisa dibandingkan dengan mudah.
   - Legenda Otomatis: Tampilkan kotak penanda warna kecil (legenda) di bawah nama peta pada sidebar hanya ketika peta tersebut sedang aktif.
   - Auto-Zoom (Fit Bounds): Setiap kali pimpinan mencentang sebuah peta, kamera peta harus otomatis melakukan zoom-in dan bergeser (center) fokusnya ke lokasi objek GeoJSON tersebut secara instan tanpa perlu dicari manual.
   - Popup Informasi: Jika area/garis/titik pada peta diklik oleh pimpinan, tampilkan jendela popup yang rapi berisi teks dari kolom 'keterangan' beserta seluruh atribut properti bawaan dari file GeoJSON tersebut.
   - Indikator Loading & Progress: Karena file GeoJSON dari Google Drive bisa berukuran cukup besar, berikan loading spinner dan feedback visual yang jelas saat layer sedang diunduh/diproses.

Desain UI menggunakan Tailwind CSS dengan nuansa profesional (kombinasi warna putih, abu-abu terang, dan aksen biru tua korporat).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://petadistan.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/44a0cb83-0713-4ef9-8314-39a1f430ce52).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
