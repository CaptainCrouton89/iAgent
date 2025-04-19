import { ContactsService } from "./contactsService";
import { SupabaseService } from "./supabaseService";

let supabaseServiceInstance: SupabaseService | null = null;
let contactsServiceInstance: ContactsService | null = null;

export function getSupabaseService(): SupabaseService {
  if (!supabaseServiceInstance) {
    supabaseServiceInstance = new SupabaseService();
  }
  return supabaseServiceInstance;
}

export function getContactsService(): ContactsService {
  if (!contactsServiceInstance) {
    contactsServiceInstance = new ContactsService(getSupabaseService());
  }
  return contactsServiceInstance;
}

export * from "./contactsService";
export * from "./supabaseService";
