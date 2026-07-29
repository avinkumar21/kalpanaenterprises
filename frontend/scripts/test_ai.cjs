const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testAI() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  try {
    const result = await model.generateContent("Hello, are you working?");
    const response = await result.response;
    console.log("Success:", response.text());
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testAI();
