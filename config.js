// Huququstoz Mini App Sozlamalari
window.HUQUQUSTOZ_CONFIG = {
  owner: "onekomilov-oss",
  repo: "huququstoz-loyihasi-",
  botUsername: "huquqmindBot",
  discussionGroup: "huquqmind",
  channelUsername: "huququstoz"
};

// Supabase URL va API Kalit
window.SUPABASE_URL = "https://upqwfzcecilwwqjdhkki.supabase.co"; 
window.SUPABASE_KEY = "sb_publishable_VwXMlxwStOTTqRauO5kKIg_6FzbVjXJ";

// Global mijoz obyektini xavfsiz yaratish
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
  }
} catch (e) {
  console.error("Supabase init error:", e);
}
