import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

export const supabase = createClient(url, key);
