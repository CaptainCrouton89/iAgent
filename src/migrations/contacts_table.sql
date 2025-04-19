-- Contacts table schema
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_contacted TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts (email);

-- Create function to initialize the contacts table
CREATE OR REPLACE FUNCTION create_contacts_table()
RETURNS VOID AS $$
BEGIN
  -- Enable UUID extension if not already enabled
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  
  -- Create the contacts table if it doesn't exist
  CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_contacted TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  
  -- Create index on email for faster lookups
  CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts (email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 