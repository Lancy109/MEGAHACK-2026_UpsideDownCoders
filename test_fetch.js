fetch('http://localhost:3000/api/notify/broadcast', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Test fetch script', target: 'ALL' })
}).then(r => {
  r.text().then(text => {
    Array.from(r.headers.entries()).forEach(h => console.log(h.join(': ')));
    console.log('Status:', r.status);
    try {
      console.log('JSON:', JSON.parse(text));
    } catch {
      console.log('TEXT:', text.substring(0, 500));
    }
  });
}).catch(console.error);
