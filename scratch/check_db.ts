import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkColumn() {
  const { data, error } = await supabase
    .from('members')
    .select('archived')
    .limit(1)
  
  if (error) {
    console.error('Error fetching archived column:', error)
  } else {
    console.log('Archived column exists!', data)
  }
}

checkColumn()
