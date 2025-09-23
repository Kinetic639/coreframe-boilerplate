-- Chat System Migration
-- Comprehensive chat system with individual chats, messages, and status tracking
-- Built for scalability to support group chats in the future

-- Create chats table for individual chat sessions
CREATE TABLE public.chats (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text, -- Optional name for group chats (future)
    type text DEFAULT 'direct' CHECK (type IN ('direct', 'group')), -- direct or group chat
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_message_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    is_active boolean DEFAULT true
);

-- Create chat_participants table to track who's in each chat
CREATE TABLE public.chat_participants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    left_at timestamp with time zone,
    is_admin boolean DEFAULT false, -- For group chat admins (future)
    
    -- Ensure unique participant per chat
    UNIQUE(chat_id, user_id)
);

-- Create messages table for all chat messages
CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    content text NOT NULL,
    content_type text DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file', 'system')),
    message_type text DEFAULT 'message' CHECK (message_type IN ('message', 'system', 'notification')),
    reply_to_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
    edited_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Add metadata for rich text content from Lexical
    lexical_state jsonb, -- Store Lexical editor state
    
    -- Add indexes for performance
    INDEX idx_messages_chat_id (chat_id),
    INDEX idx_messages_created_at (created_at DESC),
    INDEX idx_messages_sender_id (sender_id)
);

-- Create message_status table for read receipts and delivery status
CREATE TABLE public.message_status (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('sent', 'delivered', 'read')),
    status_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    
    -- Ensure unique status per message per user
    UNIQUE(message_id, user_id, status)
);

-- Add indexes for better performance
CREATE INDEX idx_chats_organization_branch ON public.chats(organization_id, branch_id);
CREATE INDEX idx_chats_updated_at ON public.chats(updated_at DESC);
CREATE INDEX idx_chat_participants_user_id ON public.chat_participants(user_id);
CREATE INDEX idx_message_status_user_id ON public.message_status(user_id);
CREATE INDEX idx_message_status_message_id ON public.message_status(message_id);

-- Add RLS policies for security
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_status ENABLE ROW LEVEL SECURITY;

-- Chats policies: Users can only access chats they're participants in
CREATE POLICY "Users can view chats they participate in" ON public.chats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants 
            WHERE chat_participants.chat_id = chats.id 
            AND chat_participants.user_id = auth.uid()
            AND chat_participants.organization_id = chats.organization_id
            AND chat_participants.branch_id = chats.branch_id
            AND chat_participants.left_at IS NULL
        )
    );

CREATE POLICY "Users can create chats in their org/branch" ON public.chats
    FOR INSERT WITH CHECK (
        public.authorize('teams.chat.create', organization_id, branch_id)
    );

CREATE POLICY "Chat creators and admins can update chats" ON public.chats
    FOR UPDATE USING (
        created_by = auth.uid() OR 
        public.authorize('teams.chat.admin', organization_id, branch_id)
    );

-- Chat participants policies
CREATE POLICY "Users can view participants of chats they're in" ON public.chat_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants cp2
            WHERE cp2.chat_id = chat_participants.chat_id 
            AND cp2.user_id = auth.uid()
            AND cp2.organization_id = chat_participants.organization_id
            AND cp2.branch_id = chat_participants.branch_id
            AND cp2.left_at IS NULL
        )
    );

CREATE POLICY "Users can join chats in their org/branch" ON public.chat_participants
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        public.authorize('teams.chat.participate', organization_id, branch_id)
    );

CREATE POLICY "Users can leave chats" ON public.chat_participants
    FOR UPDATE USING (user_id = auth.uid());

-- Messages policies
CREATE POLICY "Users can view messages in chats they participate in" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants 
            WHERE chat_participants.chat_id = messages.chat_id 
            AND chat_participants.user_id = auth.uid()
            AND chat_participants.organization_id = messages.organization_id
            AND chat_participants.branch_id = messages.branch_id
            AND chat_participants.left_at IS NULL
        )
    );

CREATE POLICY "Users can send messages to chats they participate in" ON public.messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.chat_participants 
            WHERE chat_participants.chat_id = messages.chat_id 
            AND chat_participants.user_id = auth.uid()
            AND chat_participants.organization_id = messages.organization_id
            AND chat_participants.branch_id = messages.branch_id
            AND chat_participants.left_at IS NULL
        )
    );

CREATE POLICY "Users can edit their own messages" ON public.messages
    FOR UPDATE USING (
        sender_id = auth.uid() AND 
        deleted_at IS NULL
    );

CREATE POLICY "Users can delete their own messages" ON public.messages
    FOR UPDATE USING (sender_id = auth.uid());

-- Message status policies
CREATE POLICY "Users can view status of messages they can see" ON public.message_status
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.chat_participants cp ON cp.chat_id = m.chat_id
            WHERE m.id = message_status.message_id
            AND cp.user_id = auth.uid()
            AND cp.organization_id = message_status.organization_id
            AND cp.branch_id = message_status.branch_id
            AND cp.left_at IS NULL
        )
    );

CREATE POLICY "Users can update their own message status" ON public.message_status
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own message status" ON public.message_status
    FOR UPDATE USING (user_id = auth.uid());

-- Create functions for chat management

-- Function to create a direct chat between two users
CREATE OR REPLACE FUNCTION public.create_direct_chat(
    other_user_id uuid,
    org_id uuid,
    br_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    chat_id uuid;
    current_user_id uuid := auth.uid();
BEGIN
    -- Check if current user has permission
    IF NOT public.authorize('teams.chat.create', org_id, br_id) THEN
        RAISE EXCEPTION 'Insufficient permissions to create chat';
    END IF;

    -- Check if direct chat already exists between these users
    SELECT c.id INTO chat_id
    FROM public.chats c
    WHERE c.type = 'direct'
    AND c.organization_id = org_id
    AND c.branch_id = br_id
    AND c.is_active = true
    AND EXISTS (
        SELECT 1 FROM public.chat_participants cp1
        WHERE cp1.chat_id = c.id AND cp1.user_id = current_user_id AND cp1.left_at IS NULL
    )
    AND EXISTS (
        SELECT 1 FROM public.chat_participants cp2
        WHERE cp2.chat_id = c.id AND cp2.user_id = other_user_id AND cp2.left_at IS NULL
    );

    -- If chat doesn't exist, create new one
    IF chat_id IS NULL THEN
        -- Create the chat
        INSERT INTO public.chats (organization_id, branch_id, created_by, type)
        VALUES (org_id, br_id, current_user_id, 'direct')
        RETURNING id INTO chat_id;

        -- Add both participants
        INSERT INTO public.chat_participants (chat_id, user_id, organization_id, branch_id)
        VALUES 
            (chat_id, current_user_id, org_id, br_id),
            (chat_id, other_user_id, org_id, br_id);
    END IF;

    RETURN chat_id;
END;
$$;

-- Function to send a message
CREATE OR REPLACE FUNCTION public.send_message(
    p_chat_id uuid,
    p_content text,
    p_content_type text DEFAULT 'text',
    p_lexical_state jsonb DEFAULT NULL,
    p_reply_to_message_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    message_id uuid;
    current_user_id uuid := auth.uid();
    chat_org_id uuid;
    chat_branch_id uuid;
BEGIN
    -- Get chat org and branch
    SELECT organization_id, branch_id INTO chat_org_id, chat_branch_id
    FROM public.chats
    WHERE id = p_chat_id;

    -- Verify user can send messages to this chat
    IF NOT EXISTS (
        SELECT 1 FROM public.chat_participants 
        WHERE chat_id = p_chat_id 
        AND user_id = current_user_id
        AND organization_id = chat_org_id
        AND branch_id = chat_branch_id
        AND left_at IS NULL
    ) THEN
        RAISE EXCEPTION 'User not authorized to send messages to this chat';
    END IF;

    -- Insert the message
    INSERT INTO public.messages (
        chat_id, sender_id, organization_id, branch_id, 
        content, content_type, lexical_state, reply_to_message_id
    )
    VALUES (
        p_chat_id, current_user_id, chat_org_id, chat_branch_id,
        p_content, p_content_type, p_lexical_state, p_reply_to_message_id
    )
    RETURNING id INTO message_id;

    -- Update chat last_message_at
    UPDATE public.chats 
    SET last_message_at = NOW(), updated_at = NOW()
    WHERE id = p_chat_id;

    -- Create delivered status for sender
    INSERT INTO public.message_status (message_id, user_id, status, organization_id, branch_id)
    VALUES (message_id, current_user_id, 'sent', chat_org_id, chat_branch_id);

    RETURN message_id;
END;
$$;

-- Function to mark message as read
CREATE OR REPLACE FUNCTION public.mark_message_read(
    p_message_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    msg_org_id uuid;
    msg_branch_id uuid;
BEGIN
    -- Get message org and branch
    SELECT organization_id, branch_id INTO msg_org_id, msg_branch_id
    FROM public.messages
    WHERE id = p_message_id;

    -- Insert or update read status
    INSERT INTO public.message_status (message_id, user_id, status, organization_id, branch_id)
    VALUES (p_message_id, current_user_id, 'read', msg_org_id, msg_branch_id)
    ON CONFLICT (message_id, user_id, status) 
    DO UPDATE SET status_at = NOW();

    RETURN true;
END;
$$;

-- Create updated_at trigger for chats
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_chats_updated_at
    BEFORE UPDATE ON public.chats
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.chats TO authenticated;
GRANT ALL ON public.chat_participants TO authenticated;
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.message_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_direct_chat TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_message_read TO authenticated;