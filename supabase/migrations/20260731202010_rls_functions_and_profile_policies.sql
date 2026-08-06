-- RLS helper functions and profile policies
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $BODY$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$BODY$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $BODY$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$BODY$ LANGUAGE sql SECURITY DEFINER STABLE;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
