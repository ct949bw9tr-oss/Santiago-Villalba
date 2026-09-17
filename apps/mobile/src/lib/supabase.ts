import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Publishable ("anon") keys are meant to ship inside client code — they only grant
// what Row Level Security policies allow. See supabase/migrations/0008_rls_policies.sql
// and 0009_public_app_access.sql for what an anonymous/authenticated session can do.
const SUPABASE_URL = "https://qbzzlgrpacmrvtpunwxl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xTnV0SwZneJQ_Lpw4sDUoQ_kBQjf93K";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
