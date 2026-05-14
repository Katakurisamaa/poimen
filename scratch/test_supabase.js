const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing connection to:', supabaseUrl);
  // Test select
  const { data: selectData, error: selectError } = await supabase.from('churches').select('*').limit(1);
  if (selectError) {
    console.error('Select Error:', selectError);
  } else {
    console.log('Select Success! Found:', selectData);
  }

  // Test insert (this should fail if RLS is not set up or if schema is wrong)
  const testChurch = { name: 'Test Church ' + Date.now(), access_code: 'TEST-' + Date.now(), city: 'Test', country: 'Test' };
  console.log('Testing insert of:', testChurch);
  const { data: insertData, error: insertError } = await supabase.from('churches').insert([testChurch]).select();
  if (insertError) {
    console.error('Insert Error:', insertError);
  } else {
    console.log('Insert Success! Created:', insertData);
  }
}

test();