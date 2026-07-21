const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m);
const keyMatch = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)$/m);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  console.log('--- Orphan group_ids ---');
  const { data: orphaned } = await supabase.from('group_participants').select('group_id');
  const filtered = orphaned ? orphaned.filter(o => !['group-1', 'group-2', 'group-3'].includes(o.group_id)) : [];
  const uniqueIds = [...new Set(filtered.map(o => o.group_id))];
  console.log(JSON.stringify(uniqueIds, null, 2));

  console.log('--- pg_policies ---');
  const { data: policies, error: polErr } = await supabase.from('pg_policies').select('*').eq('tablename', 'group_participants');
  if (polErr) console.log('Cannot query pg_policies:', polErr.message);
  else console.log(JSON.stringify(policies, null, 2));
}
run();
