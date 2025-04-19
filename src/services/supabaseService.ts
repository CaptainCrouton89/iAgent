import { createClient } from "@supabase/supabase-js";
import { Database } from "../../supabase/database.types";

export class SupabaseService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials are not properly configured");
    }

    this.supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Get the Supabase client instance
   */
  getClient() {
    return this.supabase;
  }
}
