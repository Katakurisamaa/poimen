const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jemsrpyrdpkhbdqlrfwj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplbXNycHlyZHBraGJkcWxyZndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzMxMDAsImV4cCI6MjA5MzgwOTEwMH0.hcathak1LNrVzzOY3367yhTvDBM5swOVNkI6ZIlZa9o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupChurches() {
  console.log('Cleaning up test churches...');
  const { data, error } = await supabase
    .from('churches')
    .delete()
    .or('name.ilike.%test%,name.ilike.%demo%');
    
  if (error) console.error('Error:', error);
  else console.log('Churches cleaned.');
}

cleanupChurches();
