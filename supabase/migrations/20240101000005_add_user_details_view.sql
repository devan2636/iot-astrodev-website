-- Create a view to access user data with emails
CREATE OR REPLACE VIEW user_details AS
SELECT 
  au.id,
  au.email,
  au.email_confirmed_at,
  au.created_at,
  p.username,
  p.role
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id;

-- Grant access to the view
GRANT SELECT ON user_details TO authenticated;

-- Create a function that uses the view
CREATE OR REPLACE FUNCTION get_users_with_emails()
RETURNS TABLE (
  id uuid,
  email text,
  email_confirmed_at timestamptz,
  created_at timestamptz,
  username text,
  role app_role
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM user_details
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_users_with_emails() TO authenticated;
