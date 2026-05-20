const https = require('https');

https.get('https://openrouter.ai/api/v1/models', (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => {
    const models = JSON.parse(data).data;
    const free = models.filter(m => m.pricing.prompt === "0" || m.pricing.prompt === 0);
    console.log(free.map(m => m.id));
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
