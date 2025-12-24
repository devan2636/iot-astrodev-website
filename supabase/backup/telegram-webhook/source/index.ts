import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// 1. MENGGUNAKAN TOKEN KHUSUS BOT AWLR (SUNGAI)
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_AWLR_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
// 2. MENGGUNAKAN SERVICE ROLE KEY (KUNCI ADMIN)
// Agar bot bisa bypass aturan database dan pasti bisa simpan data subscriber
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
serve(async (req)=>{
  try {
    const update = await req.json();
    // Log untuk debugging di Dashboard Supabase
    console.log("Payload Masuk ke Bot AWLR:", JSON.stringify(update));
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      // Ambil username, kalau tidak ada ambil nama depan, kalau tidak ada pakai "NoName"
      const username = update.message.chat.username || update.message.chat.first_name || "NoName";
      if (text === "/start") {
        console.log(`Mendaftarkan User: ${username} (${chatId}) ke monitoring sungai`);
        // Simpan ke Database table 'telegram_subscribers'
        const { error } = await supabase.from('telegram_subscribers').upsert({
          chat_id: chatId,
          username: username
        }, {
          onConflict: 'chat_id'
        });
        if (error) {
          console.error("❌ Gagal simpan ke DB:", error);
          await sendMessage(chatId, "⚠️ Maaf, sistem sedang sibuk. Silakan coba lagi nanti.");
        } else {
          console.log("✅ Berhasil disimpan.");
          await sendMessage(chatId, "🌊 **Halo!**\n\nAnda berhasil terdaftar di **Astrodev River Monitoring**.\nKami akan memberitahu Anda jika kondisi air sungai dalam status **WASPADA** atau **BAHAYA**.");
        }
      } else {
        await sendMessage(chatId, "Ketik /start untuk mulai berlangganan info banjir.");
      }
    }
    return new Response("OK", {
      status: 200
    });
  } catch (error) {
    console.error("Error Function:", error);
    return new Response("Error", {
      status: 400
    });
  }
});
// Fungsi Helper kirim pesan balik menggunakan TOKEN AWLR
async function sendMessage(chatId, text) {
  if (!BOT_TOKEN) {
    console.error("❌ Token Bot AWLR belum di-set!");
    return;
  }
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  });
}
