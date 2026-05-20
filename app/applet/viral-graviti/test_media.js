const apiKey = process.env.GEMINI_API_KEY;

async function testSimpleUpload() {
  const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=media&key=${apiKey}`;
  
  const fileData = new TextEncoder().encode("helloworld");
  
  console.log("Sending to: ", uploadUrl);
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'X-Goog-Upload-Protocol': 'media'
    },
    body: fileData
  });

  const body = await response.text();
  console.log("Status:", response.status);
  console.log("Body:", body);
}

testSimpleUpload();
