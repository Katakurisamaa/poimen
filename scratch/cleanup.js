const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jemsrpyrdpkhbdqlrfwj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplbXNycHlyZHBraGJkcWxyZndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzMxMDAsImV4cCI6MjA5MzgwOTEwMH0.hcathak1LNrVzzOY3367yhTvDBM5swOVNkI6ZIlZa9o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  console.log('Cleaning up test data...');
  
  // Cleanup bergeries
  const { data: bData, error: bError } = await supabase
    .from('bergeries')
    .delete()
    .or('name.ilike.%test%,name.ilike.%demo%,creator_first_name.ilike.%test%,creator_last_name.ilike.%test%');
    
  if (bError) console.error('Error cleaning bergeries:', bError);
  else console.log('Bergeries cleaned.');

  // Cleanup invites
  const { data: iData, error: iError } = await supabase
    .from('invites')
    .delete()
    .or('first_name.ilike.%test%,last_name.ilike.%test%');

  if (iError) console.error('Error cleaning invites:', iError);
  else console.log('Invites cleaned.');

  // Cleanup members (bergerie_members)
  // Assuming table name is bergerie_members based on common patterns if not 'members'
  const { data: mData, error: mError } = await supabase
    .from('members')
    .delete()
    .or('first_name.ilike.%test%,last_name.ilike.%test%');

  if (mError) {
    // Try 'bergerie_members' if 'members' fails
    const { error: mError2 } = await supabase
      .from('bergerie_members')
      .delete()
      .or('first_name.ilike.%test%,last_name.ilike.%test%');
    if (mError2) console.error('Error cleaning members:', mError2);
    else console.log('Bergerie members cleaned.');
  } else {
    console.log('Members cleaned.');
  }
}

cleanup();
