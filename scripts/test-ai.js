const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testGemini() {
    console.log('--- Gemini Diagnostic ---');
    const key = process.env.GEMINI_API_KEY;
    console.log('API Key present:', !!key);
    console.log('Key prefix:', key?.substring(0, 7));

    if (!key) {
        console.error('ERROR: GEMINI_API_KEY is missing in .env');
        return;
    }

    const endpoints = ['v1', 'v1beta'];
    const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];

    for (const v of endpoints) {
        for (const m of models) {
            console.log(`\nTesting ${v} with ${m}...`);
            try {
                const resp = await fetch(`https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent?key=${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        contents: [{ parts: [{ text: 'Hello' }] }],
                        safetySettings: [
                            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                        ]
                    })
                });
                console.log(`Result: ${resp.status} ${resp.statusText}`);
                const data = await resp.json();
                if (resp.ok) {
                    console.log('✅ Success!');
                    console.log('Response:', data.candidates[0].content.parts[0].text.substring(0, 50));
                } else {
                    console.log(`❌ Error JSON: ${JSON.stringify(data)}`);
                }
            } catch (e) {
                console.error(`Fetch error: ${e.message}`);
            }
        }
    }
}

testGemini();
