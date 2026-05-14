const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://jemsrpyrdpkhbdqlrfwj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplbXNycHlyZHBraGJkcWxyZndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzMxMDAsImV4cCI6MjA5MzgwOTEwMH0.hcathak1LNrVzzOY3367yhTvDBM5swOVNkI6ZIlZa9o'; // Note: Usually need service_role for DDL, but let's try.

const supabase = createClient(supabaseUrl, supabaseKey);

async function init() {
  console.log("Initializing database...");
  const sql = fs.readFileSync(path.join(__dirname, 'supabase/schema.sql'), 'utf8');
  
  // Adding the access_code column to churches in the SQL string
  const updatedSql = sql.replace(
    'logo_url TEXT,',
    'logo_url TEXT,\n  access_code TEXT UNIQUE,'
  );

  // We can't easily run raw SQL from the client unless we have an RPC or a specific endpoint.
  // Usually migrations are done via CLI or Dashboard.
  console.log("Please run the following SQL in your Supabase SQL Editor:");
  console.log(updatedSql);
}

init();
