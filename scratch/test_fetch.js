
async function test() {
  const url = 'https://coegvfawxeszrgditpnf.supabase.co/rest/v1/';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdWJhc2UiLCJyZWYiOiJjb2VndmZhd3hlc3pyZ2RpdHBuZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzY5MDgyMTgwLCJleHAiOjIwODQ2NTgxODB9.LPwZ_rlY6Ge-rMmNbtkTQmOdbmt0ZNpG_95ZBsiBYKA';
  console.log('Fetching with key:', url);
  try {
    const res = await fetch(url, {
      headers: { 'apikey': key }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text);
  } catch (e) {
    console.error('Fetch Error:', e);
  }
}
test();
