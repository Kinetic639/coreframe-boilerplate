-- Create news tables and policies

-- News posts table
CREATE TABLE public.news_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content JSONB NOT NULL, -- Lexical editor content
    excerpt TEXT,
    priority TEXT CHECK (priority IN ('normal', 'important', 'urgent', 'critical')) DEFAULT 'normal',
    badges TEXT[] DEFAULT '{}',
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_news_posts_organization_id ON public.news_posts(organization_id);
CREATE INDEX idx_news_posts_branch_id ON public.news_posts(branch_id);
CREATE INDEX idx_news_posts_published_at ON public.news_posts(published_at DESC);
CREATE INDEX idx_news_posts_priority ON public.news_posts(priority);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER news_posts_updated_at
    BEFORE UPDATE ON public.news_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for news_posts

-- Policy: Organization members can view news posts
CREATE POLICY "Organization members can view news posts" ON public.news_posts
    FOR SELECT
    USING (
        organization_id IN (
            SELECT om.organization_id 
            FROM public.organization_members om 
            WHERE om.user_id = auth.uid()
        )
        OR
        (branch_id IS NOT NULL AND branch_id IN (
            SELECT ura.scope_id 
            FROM public.user_role_assignments ura 
            WHERE ura.user_id = auth.uid() 
            AND ura.scope = 'branch'
            AND ura.deleted_at IS NULL
        ))
    );

-- Policy: Only org owners can create news posts
CREATE POLICY "Org owners can create news posts" ON public.news_posts
    FOR INSERT
    WITH CHECK (
        (public.authorize(auth.uid(), ARRAY['news.create'], ARRAY[]::text[], organization_id, branch_id) ->> 'authorized')::boolean = true
    );

-- Policy: Only org owners can update their news posts
CREATE POLICY "Org owners can update news posts" ON public.news_posts
    FOR UPDATE
    USING (
        (public.authorize(auth.uid(), ARRAY['news.update'], ARRAY[]::text[], organization_id, branch_id) ->> 'authorized')::boolean = true
        AND author_id = auth.uid()
    )
    WITH CHECK (
        (public.authorize(auth.uid(), ARRAY['news.update'], ARRAY[]::text[], organization_id, branch_id) ->> 'authorized')::boolean = true
        AND author_id = auth.uid()
    );

-- Policy: Only org owners can delete their news posts
CREATE POLICY "Org owners can delete news posts" ON public.news_posts
    FOR DELETE
    USING (
        (public.authorize(auth.uid(), ARRAY['news.delete'], ARRAY[]::text[], organization_id, branch_id) ->> 'authorized')::boolean = true
        AND author_id = auth.uid()
    );

-- Insert news permissions
INSERT INTO public.permissions (id, slug, name, description, category, resource_type, action) VALUES
    (gen_random_uuid(), 'news.create', 'Create news posts', 'Ability to create news posts', 'home', 'news', 'create'),
    (gen_random_uuid(), 'news.update', 'Update news posts', 'Ability to update news posts', 'home', 'news', 'update'),
    (gen_random_uuid(), 'news.delete', 'Delete news posts', 'Ability to delete news posts', 'home', 'news', 'delete'),
    (gen_random_uuid(), 'news.view', 'View news posts', 'Ability to view news posts', 'home', 'news', 'view')
ON CONFLICT (slug) DO NOTHING;

-- Grant news permissions to org_owner role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'org_owner' 
AND p.slug IN ('news.create', 'news.update', 'news.delete', 'news.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant view permission to all other roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name IN ('branch_admin', 'branch_member') 
AND p.slug = 'news.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;