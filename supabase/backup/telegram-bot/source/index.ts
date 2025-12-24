import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_AWLR_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
// Gunakan Service Role Key agar bisa SELECT ke semua data tanpa terhalang RLS
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- KONFIGURASI LIMIT ---
const LIMIT_AIR_WASPADA = 20; // cm
const LIMIT_AIR_BAHAYA = 40;  // cm

// --- KATEGORI HUJAN BMKG (Akumulasi 1 Jam) ---
// Hujan Lebat (>10 mm/jam) akan memicu notifikasi
const LIMIT_HUJAN_TRIGGER = 10; 

function getRainCategory(mmPerHour: number) {
  if (mmPerHour === 0) return { label: "Berawan / Cerah", icon: "☁️" };
  if (mmPerHour < 1) return { label: "Hujan Sangat Ringan", icon: "🌦" };
  if (mmPerHour >= 1 && mmPerHour < 5) return { label: "Hujan Ringan", icon: "🌧" };
  if (mmPerHour >= 5 && mmPerHour < 10) return { label: "Hujan Sedang", icon: "🌧" };
  if (mmPerHour >= 10 && mmPerHour < 20) return { label: "Hujan Lebat", icon: "⛈️" };
  if (mmPerHour >= 20) return { label: "Hujan Sangat Lebat / Ekstrem", icon: "🌪️" };
  return { label: "Tidak Terukur", icon: "❓" };
}

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record; // Data yang baru saja masuk

    // 1. Parsing Data Saat Ini (Instant)
    let currentData = record.sensor_data;
    if (typeof currentData === 'string') {
      try { currentData = JSON.parse(currentData); } catch {}
    }
    
    // Ambil Ketinggian Air (Instant Value)
    const waterLevel = currentData.ketinggian_air ?? currentData.water_level ?? 0;

    // 2. HITUNG CURAH HUJAN (AKUMULASI 1 JAM TERAKHIR)
    // Ambil waktu 1 jam yang lalu dari waktu data ini dibuat
    const timestampNow = new Date(record.timestamp);
    const oneHourAgo = new Date(timestampNow.getTime() - (60 * 60 * 1000)).toISOString();

    // Query semua data dari device ini dalam 1 jam terakhir
    const { data: historyData, error } = await supabase
      .from('sensor_readings')
      .select('sensor_data')
      .eq('device_id', record.device_id)
      .gte('timestamp', oneHourAgo)
      .lte('timestamp', record.timestamp); // Sampai data terbaru

    let totalRain1H = 0;

    if (historyData && historyData.length > 0) {
      // Loop dan jumlahkan curah hujan
      historyData.forEach((row: any) => {
        let sData = row.sensor_data;
        if (typeof sData === 'string') {
           try { sData = JSON.parse(sData); } catch {}
        }
        // Asumsi: sensor mengirim 'tick' atau curah hujan per interval (bukan akumulasi harian)
        const rainTick = sData.curah_hujan ?? sData.rain_fall ?? 0;
        totalRain1H += Number(rainTick);
      });
    }

    // Gunakan nilai instant jika history kosong (data pertama)
    if (historyData?.length === 0) {
        totalRain1H = Number(currentData.curah_hujan ?? 0);
    }

    // console.log(`Device: ${record.device_id} | Rain 1H: ${totalRain1H} mm`);

    // 3. LOGIKA PEMICU NOTIFIKASI
    let isAlert = false;
    let title = "";
    let statusIcon = "";
    let statusText = "";

    // Trigger A: Banjir (Air Tinggi)
    if (waterLevel >= LIMIT_AIR_WASPADA) {
      isAlert = true;
      title = "PERINGATAN BANJIR";
      statusIcon = waterLevel >= LIMIT_AIR_BAHAYA ? "🚨" : "⚠️";
      statusText = waterLevel >= LIMIT_AIR_BAHAYA ? "BAHAYA" : "WASPADA";
    } 
    // Trigger B: Cuaca Ekstrem (Hujan Lebat > 10mm/jam)
    else if (totalRain1H >= LIMIT_HUJAN_TRIGGER) {
      isAlert = true;
      title = "PERINGATAN CUACA";
      statusIcon = "⛈️";
      statusText = "HUJAN LEBAT - WASPADA BANJIR";
    }

    // Jika aman, hentikan proses (Hemat biaya & kuota telegram)
    if (!isAlert) {
      return new Response("Aman. Tidak dikirim.", { status: 200 });
    }

    // 4. Ambil Info Device & Kategori Hujan
    const rainInfo = getRainCategory(totalRain1H);
    
    const { data: device } = await supabase
      .from('devices')
      .select('name, location, latitude, longitude')
      .eq('id', record.device_id)
      .single();

    const deviceName = device?.name || "Unknown Device";
    const locationName = device?.location || "-";
    const gmapsLink = (device?.latitude && device?.longitude) 
      ? `https://www.google.com/maps/search/?api=1&query=${device.latitude},${device.longitude}` 
      : null;

    // 5. Susun Pesan
    const message = `
${statusIcon} <b>${title}</b> ${statusIcon}

<b>Status: ${statusText}</b>

🌊 <b>Level Air:</b> ${waterLevel} cm
🌧 <b>Hujan (1 Jam):</b> ${totalRain1H.toFixed(1)} mm
ℹ️ <i>${rainInfo.label}</i>

📍 <b>Lokasi:</b> ${locationName} (${deviceName})

${gmapsLink ? `🗺 <a href="${gmapsLink}">Lihat Peta</a>` : ''}

<i>🕒 Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</i>
    `;

    // 6. Ambil Subscriber
    const { data: subscribers } = await supabase
      .from('telegram_subscribers')
      .select('chat_id');

    if (!subscribers || subscribers.length === 0) {
      return new Response("No subscribers.", { status: 200 });
    }

    // 7. Kirim Broadcast
    const sendPromises = subscribers.map((sub) => {
      return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: sub.chat_id,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });
    });

    await Promise.all(sendPromises);
    return new Response("Notifikasi Terkirim.", { status: 200 });

  } catch (error) {
    console.error("Error:", error);
    return new Response("Internal Error", { status: 500 });
  }
});