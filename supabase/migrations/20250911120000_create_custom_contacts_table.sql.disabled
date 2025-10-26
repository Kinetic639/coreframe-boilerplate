-- Create custom contacts table for personal contacts that are visible only to the user who created them
CREATE TABLE IF NOT EXISTS public.custom_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- User who created this contact
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Organization context
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Contact information
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  position TEXT,
  department TEXT,
  notes TEXT,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  
  CONSTRAINT custom_contacts_name_check CHECK (char_length(first_name) > 0)
);

-- Add RLS
ALTER TABLE public.custom_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own custom contacts
CREATE POLICY "Users can view their own custom contacts" ON public.custom_contacts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own custom contacts" ON public.custom_contacts
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    organization_id = (
      SELECT organization_id 
      FROM public.organization_users 
      WHERE user_id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Users can update their own custom contacts" ON public.custom_contacts
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own custom contacts" ON public.custom_contacts
  FOR DELETE USING (user_id = auth.uid());

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS custom_contacts_user_id_idx ON public.custom_contacts(user_id);
CREATE INDEX IF NOT EXISTS custom_contacts_organization_id_idx ON public.custom_contacts(organization_id);
CREATE INDEX IF NOT EXISTS custom_contacts_deleted_at_idx ON public.custom_contacts(deleted_at);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER custom_contacts_updated_at
  BEFORE UPDATE ON public.custom_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();