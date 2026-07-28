import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://tcklsxaplrdiawnkuxae.supabase.co";
const supabaseAnonKey = "sb_publishable_IfaHl357PjhDo8flvxhMqw_OrGpvjXg";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);