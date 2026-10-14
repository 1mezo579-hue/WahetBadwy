import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xvnolgvzasqzqbhldsys.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_OcNjeJRtJ8le5Uctg4Gxbg_Q2PJerf0";

export const createClient = () =>
  createBrowserClient(
    supabaseUrl,
    supabaseKey
  );
