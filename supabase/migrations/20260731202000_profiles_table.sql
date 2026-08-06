-- Migration: Create profiles table with triggers
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name varchar(100) NOT NULL,
  role varchar(20) NOT NULL CHECK (role IN ('admin', 'instructor')),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $BODY$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unknown'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'instructor')
  );
  RETURN NEW;
END;
$BODY$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $BODY$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$BODY$ LANGUAGE plpgsql;

CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
