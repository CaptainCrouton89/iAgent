import { AgentsService } from "./agentsService";
import { ContactsService } from "./contactsService";
import { SupabaseService } from "./supabaseService";

let supabaseServiceInstance: SupabaseService | null = null;
let contactsServiceInstance: ContactsService | null = null;
let agentsServiceInstance: AgentsService | null = null;

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

export function getAgentsService(): AgentsService {
  if (!agentsServiceInstance) {
    agentsServiceInstance = new AgentsService(getSupabaseService());
  }
  return agentsServiceInstance;
}

export * from "./agentsService";
export * from "./contactsService";
export * from "./supabaseService";
