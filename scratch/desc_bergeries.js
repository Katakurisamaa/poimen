const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function describeTable() {
  const { data, error } = await supabase.from('bergeries').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else if (data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  } else {
    // If empty, insert a dummy and delete it or just use an introspection query
    const { data: cols, error: colError } = await supabase.rpc('get_columns', { table_name: 'bergeries' });
    console.log('Empty table. Data:', data);
  }
}

describeTable();