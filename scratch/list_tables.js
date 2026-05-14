const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jemsrpyrdpkhbdqlrfwj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplbXNycHlyZHBraGJkcWxyZndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzMxMDAsImV4cCI6MjA5MzgwOTEwMH0.hcathak1LNrVzzOY3367yhTvDBM5swOVNkI6ZIlZa9o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables'); // Custom RPC if it exists
  if (error) {
    // If RPC fails, try a generic query that might fail but give hints
    const { error: e2 } = await supabase.from('non_existent').select('*');
    console.log('Error hints:', e2);
  } else {
    console.log('Tables:', data);
  }
}

listTables();
