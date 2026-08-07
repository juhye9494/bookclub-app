-- Add new admin email: hyemink@hankyung.com to existing RLS policies

-- 1. events
ALTER POLICY "Allow admin full access to events" ON public.events
USING (
  auth.jwt() ->> 'email' = 'xn940@naver.com' or 
  auth.jwt() ->> 'email' = 'juhye94@hankyung.com' or
  auth.jwt() ->> 'email' = 'ehrtjdlwpgh@hankyung.com' or
  auth.jwt() ->> 'email' = 'hyemink@hankyung.com'
);

-- 2. inquiries
ALTER POLICY "inquiries_admin" ON public.inquiries
USING (
  auth.jwt() ->> 'email' IN (
    'xn940@naver.com',
    'juhye94@hankyung.com',
    'ess0317@hankyung.com',
    'parkjh@hankyung.com',
    'lygin729@hankyung.com',
    'mama0707@hankyung.com',
    'pdh0109@hankyung.com',
    'shchoi@hankyung.com',
    'mwd101@hankyung.com',
    'sj.flyme@gmail.com',
    'ehrtjdlwpgh@hankyung.com',
    'hyemink@hankyung.com'
  )
);

-- 3. insights
ALTER POLICY "Allow admin full access to insights" ON public.insights
USING (
  auth.jwt() ->> 'email' = 'xn940@naver.com' or 
  auth.jwt() ->> 'email' = 'juhye94@hankyung.com' or
  auth.jwt() ->> 'email' = 'ehrtjdlwpgh@hankyung.com' or
  auth.jwt() ->> 'email' = 'hyemink@hankyung.com'
);

-- 4. orders
ALTER POLICY "Admin has full access" ON public.orders
USING (
  auth.jwt() ->> 'email' = 'juhye94@hankyung.com' or
  auth.jwt() ->> 'email' = 'ehrtjdlwpgh@hankyung.com' or
  auth.jwt() ->> 'email' = 'hyemink@hankyung.com'
);

-- 5. profiles
ALTER POLICY "Admin full access to profiles" ON public.profiles
USING (
  auth.jwt() ->> 'email' = 'xn940@naver.com' or 
  auth.jwt() ->> 'email' = 'juhye94@hankyung.com' or
  auth.jwt() ->> 'email' = 'ehrtjdlwpgh@hankyung.com' or
  auth.jwt() ->> 'email' = 'hyemink@hankyung.com'
);
