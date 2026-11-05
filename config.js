// Huququstoz Mini App Sozlamalari
window.HUQUQUSTOZ_CONFIG = {
  owner: "onekomilov-oss",
  repo: "huququstoz-loyihasi-",
  botUsername: "huquqmindBot",
  discussionGroup: "huquqmind",
  channelUsername: "huququstoz"
};

// Supabase Baza Sozlamalari
window.SUPABASE_URL = "https://upqwfzcecilwwqjdhkki.supabase.co"; 
window.SUPABASE_KEY = "sb_publishable_VwXMlxwStOTTqRauO5kKIg_6FzbVjXJ";

// Supabase mijozini yaratish
if (window.supabase && typeof window.supabase.createClient === 'function') {
  window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
}
