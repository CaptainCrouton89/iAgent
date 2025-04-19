import { Database } from "../../supabase/database.types";
import { SupabaseService } from "./supabaseService";

export interface Contact {
  id?: string;
  email: string;
  name?: string;
  created_at?: string;
  last_contacted?: string;
}

type DatabaseContact = Database["public"]["Tables"]["contacts"]["Row"];

export class ContactsService {
  private supabaseService: SupabaseService;

  constructor(supabaseService: SupabaseService) {
    this.supabaseService = supabaseService;
  }

  /**
   * Save or update a contact in the database
   */
  async saveContact(contact: Contact): Promise<Contact> {
    try {
      const supabase = this.supabaseService.getClient();

      // Check if contact already exists
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("*")
        .eq("email", contact.email)
        .maybeSingle();

      if (existingContact) {
        // Update existing contact
        const { data, error } = await supabase
          .from("contacts")
          .update({
            name: contact.name || existingContact.name,
            last_contacted: new Date().toISOString(),
          })
          .eq("id", existingContact.id)
          .select()
          .single();

        if (error) {
          console.error("Error updating contact:", error);
          throw error;
        }

        return this.mapDatabaseContactToContact(data);
      } else {
        // Create new contact
        const { data, error } = await supabase
          .from("contacts")
          .insert({
            email: contact.email,
            name: contact.name || this.extractNameFromEmail(contact.email),
            created_at: new Date().toISOString(),
            last_contacted: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating contact:", error);
          throw error;
        }

        return this.mapDatabaseContactToContact(data);
      }
    } catch (error) {
      console.error("Error saving contact:", error);
      throw error;
    }
  }

  /**
   * Get all contacts from the database
   */
  async getAllContacts(): Promise<Contact[]> {
    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("last_contacted", { ascending: false });

      if (error) {
        console.error("Error fetching contacts:", error);
        throw error;
      }

      return data.map(this.mapDatabaseContactToContact);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      throw error;
    }
  }

  /**
   * Get a contact by ID
   */
  async getContactById(id: string): Promise<Contact | null> {
    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Record not found
          return null;
        }
        console.error("Error fetching contact:", error);
        throw error;
      }

      return this.mapDatabaseContactToContact(data);
    } catch (error) {
      console.error("Error fetching contact:", error);
      throw error;
    }
  }

  /**
   * Delete a contact by ID
   */
  async deleteContact(id: string): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();

      const { error } = await supabase.from("contacts").delete().eq("id", id);

      if (error) {
        console.error("Error deleting contact:", error);
        throw error;
      }
    } catch (error) {
      console.error("Error deleting contact:", error);
      throw error;
    }
  }

  /**
   * Helper method to extract a name from an email address
   */
  private extractNameFromEmail(email: string): string | undefined {
    // If email is in "Name <email@domain.com>" format
    const nameEmailMatch = email.match(/^(.+)\s<[^\s@]+@[^\s@]+\.[^\s@]+>$/);
    if (nameEmailMatch) {
      return nameEmailMatch[1];
    }

    // Just get the part before the @ symbol
    const emailParts = email.split("@");
    if (emailParts.length > 1) {
      // Convert something like "john.doe" to "John Doe"
      const namePart = emailParts[0]
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase())
        .trim();

      return namePart || undefined;
    }

    return undefined;
  }

  /**
   * Helper method to convert database contact to Contact interface
   */
  private mapDatabaseContactToContact(data: DatabaseContact): Contact {
    return {
      id: data.id,
      email: data.email,
      name: data.name || undefined,
      created_at: data.created_at || undefined,
      last_contacted: data.last_contacted || undefined,
    };
  }
}
