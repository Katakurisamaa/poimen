const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jemsrpyrdpkhbdqlrfwj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplbXNycHlyZHBraGJkcWxyZndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzMxMDAsImV4cCI6MjA5MzgwOTEwMH0.hcathak1LNrVzzOY3367yhTvDBM5swOVNkI6ZIlZa9o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTables() {
  const tables = ['members', 'invites', 'guests', 'bergerie_members', 'people'];
  for (const t of tables) {
    const { error } = await supabase.from(t).select('count').limit(1);
    if (!error) {
      console.log(`Table found: ${t}`);
    } else {
      console.log(`Table NOT found: ${t} (${error.code})`);
    }
  }
}

testTables();
