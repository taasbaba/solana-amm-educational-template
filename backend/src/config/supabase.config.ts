export const getSupabaseConfig = () => ({
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

export const validateSupabaseConfig = () => {
  const config = getSupabaseConfig();

  if (!config.url) {
    throw new Error('SUPABASE_URL is required');
  }

  if (!config.anonKey) {
    throw new Error('SUPABASE_ANON_KEY is required');
  }

  if (!config.serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }

  return config;
};