-- Create notices table
CREATE TABLE IF NOT EXISTS public.notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_urls TEXT[] DEFAULT '{}'::TEXT[],
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on notices table
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- Notices read policy: everyone can read
CREATE POLICY "notices_read_policy" ON public.notices
    FOR SELECT
    USING (true);

-- Notices write policy: only admins can insert/update/delete
CREATE POLICY "notices_write_policy" ON public.notices
    FOR ALL
    USING (
        auth.jwt() ->> 'email' IN (
            'xn940@naver.com',
            'ess0317@hankyung.com',
            'parkjh@hankyung.com',
            'lygin729@hankyung.com',
            'mama0707@hankyung.com',
            'pdh0109@hankyung.com',
            'shchoi@hankyung.com',
            'mwd101@hankyung.com',
            'sj.flyme@gmail.com',
            'ehrtjdlwpgh@hankyung.com',
            'hyemink@hankyung.com',
            'ghkim@hankyung.com',
            'chaem@hankyung.com'
        )
    );

-- Create storage bucket for notices
INSERT INTO storage.buckets (id, name, public) 
VALUES ('notices', 'notices', true)
ON CONFLICT (id) DO NOTHING;

-- Storage read policy: everyone can view notice images
CREATE POLICY "notices_bucket_select" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'notices');

-- Storage write policy: only admins can insert/update/delete notice images
CREATE POLICY "notices_bucket_write" ON storage.objects
    FOR ALL
    USING (
        bucket_id = 'notices' AND
        auth.jwt() ->> 'email' IN (
            'xn940@naver.com',
            'ess0317@hankyung.com',
            'parkjh@hankyung.com',
            'lygin729@hankyung.com',
            'mama0707@hankyung.com',
            'pdh0109@hankyung.com',
            'shchoi@hankyung.com',
            'mwd101@hankyung.com',
            'sj.flyme@gmail.com',
            'ehrtjdlwpgh@hankyung.com',
            'hyemink@hankyung.com',
            'ghkim@hankyung.com',
            'chaem@hankyung.com'
        )
    );
