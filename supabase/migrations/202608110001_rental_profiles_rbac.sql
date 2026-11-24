-- Tracked copy of remote migrations for the rental ERP (applied via Supabase MCP).
-- Schema: rental (isolated from public cattle tables)

CREATE SCHEMA IF NOT EXISTS rental;

CREATE TYPE rental.app_role AS ENUM (
  'super_admin',
  'sales',
  'workshop',
  'finance'
);

CREATE TABLE rental.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role rental.app_role NOT NULL DEFAULT 'sales',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_role_idx ON rental.profiles (role);
CREATE INDEX profiles_is_active_idx ON rental.profiles (is_active);

CREATE OR REPLACE FUNCTION rental.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON rental.profiles
  FOR EACH ROW
  EXECUTE FUNCTION rental.set_updated_at();

CREATE OR REPLACE FUNCTION rental.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = rental, public
AS $$
BEGIN
  INSERT INTO rental.profiles (id, full_name, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::rental.app_role,
      'sales'::rental.app_role
    ),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_rental ON auth.users;
CREATE TRIGGER on_auth_user_created_rental
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION rental.handle_new_user();

CREATE OR REPLACE FUNCTION rental.current_role()
RETURNS rental.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = rental
AS $$
  SELECT role FROM rental.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION rental.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = rental
AS $$
  SELECT EXISTS (
    SELECT 1 FROM rental.profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$$;

ALTER TABLE rental.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own_or_admin
  ON rental.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR rental.is_super_admin());

CREATE POLICY profiles_update_own
  ON rental.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_admin_update
  ON rental.profiles FOR UPDATE TO authenticated
  USING (rental.is_super_admin())
  WITH CHECK (rental.is_super_admin());

CREATE POLICY profiles_admin_insert
  ON rental.profiles FOR INSERT TO authenticated
  WITH CHECK (rental.is_super_admin() OR id = auth.uid());

GRANT USAGE ON SCHEMA rental TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON rental.profiles TO authenticated;
GRANT ALL ON rental.profiles TO service_role;
GRANT USAGE ON TYPE rental.app_role TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rental_get_my_profile()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = rental, public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'role', p.role,
    'is_active', p.is_active,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  )
  INTO result
  FROM rental.profiles p
  WHERE p.id = auth.uid();

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.rental_get_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rental_get_my_profile() TO authenticated;
