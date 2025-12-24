import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Gunakan Token Bot AstrodevIoT (Bot Hardware)
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN_DEVICE')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const update = await req.json();

    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      const username = update.message.chat.username || "NoName";

      // Cek perintah Start (Deep Link)
      if (text.startsWith("/start")) {
        const params = text.split(" ");
        
        // KASUS 1: Ada Parameter (Hasil Scan QR)
        if (params.length > 1) {
          const deviceId = params[1].trim();

          // 1. QUERY LENGKAP DATA DEVICE
          const { data: device } = await supabase
            .from('devices')
            .select('name, location, type, serial, mac, latitude, longitude') // Ambil semua info penting
            .eq('id', deviceId)
            .single();

          if (!device) {
            await sendMessage(chatId, "❌ **Gagal!** Device ID tidak ditemukan atau salah scan.");
          } else {
            // 2. Simpan ke Tabel Relasi Khusus
            const { error } = await supabase
              .from('telegram_device_subscriptions')
              .upsert(
                { 
                  chat_id: chatId, 
                  device_id: deviceId, 
                  username: username 
                }, 
                { onConflict: 'chat_id, device_id' }
              );

            if (error) {
              console.error("Error DB:", error);
              await sendMessage(chatId, "⚠️ Terjadi kesalahan sistem saat menyimpan data.");
            } else {
              // 3. SUSUN PESAN LENGKAP
              const gmapsLink = (device.latitude && device.longitude) 
                ? `[🗺 Lihat Peta](https://www.google.com/maps?q=${device.latitude},${device.longitude})` 
                : "_Lokasi GPS tidak tersedia_";

              const message = `
✅ **Berhasil Terhubung!**

Anda sekarang memantau kesehatan perangkat:

📟 **Nama:** ${device.name}
🏷 **Tipe:** ${device.type || '-'}
🔢 **Serial:** \`${device.serial || '-'}\`
🌐 **MAC:** \`${device.mac || '-'}\`
📍 **Lokasi:** ${device.location || '-'}
${gmapsLink}

_Bot akan lapor jika baterai lemah, sinyal hilang, atau sensor error._
              `;

              await sendMessage(chatId, message);
            }
          }
        } 
        // KASUS 2: Tidak Ada Parameter
        else {
          await sendMessage(chatId, "👋 **Halo Teknisi!**\n\nUntuk memantau perangkat, silakan **Scan QR Code** yang tertempel pada body perangkat.");
        }
      }
    }
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error Function:", error);
    return new Response("Error", { status: 400 });
  }
});

async function sendMessage(chatId: number, text: string) {
  if (!BOT_TOKEN) {
      console.error("❌ Token Bot Device belum di-set!");
      return;
  }
  
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  });
}