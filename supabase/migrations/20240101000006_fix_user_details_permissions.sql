-- Drop existing view if it exists
DROP VIEW IF EXISTS user_details;

-- Create a view to access user data with emails using SECURITY DEFINER
CREATE VIEW user_details 
WITH (security_invoker = false)
AS
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
