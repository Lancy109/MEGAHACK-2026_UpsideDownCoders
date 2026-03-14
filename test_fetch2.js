fetch('http://localhost:3000/api/notify/broadcast', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Test script', target: 'ALL' })
}).then(async r => {
  const text = await r.text();
  console.log('STATUS=' + r.status);
  console.log('PREVIEW=' + text.substring(0, 200).replace(/\n/g, ' '));
}).catch(console.error);
