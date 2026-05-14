const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignup() {
  const email = `test${Date.now()}@example.com`;
  const password = 'password123';
  
  console.log('Signing up:', email);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    console.error('Auth Error:', authError);
    return;
  }

  console.log('Auth Success:', authData.user?.id);

  if (authData.user) {
    console.log('Inserting profile...');
    const { data: profileData, error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      email,
      display_name: 'Test User',
      role: 'Responsable',
    }).select();

    if (profileError) {
      console.error('Profile Error:', profileError);
    } else {
      console.log('Profile Success:', profileData);
    }
  }
}

testSignup();