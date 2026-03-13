const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function testGroq() {
  console.log('--- Groq AI Diagnostic ---');
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Say "Groq is active" if you can hear me.' }],
      model: 'llama-3.3-70b-versatile',
    });

    console.log('Response:', chatCompletion.choices[0]?.message?.content);
    console.log('✅ Groq migration verified!');
  } catch (err) {
    console.error('❌ Groq Error:', err.message);
  }
}

testGroq();
