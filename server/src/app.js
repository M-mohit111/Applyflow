require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.post('/api/ai/draft', async (req, res) => {
  const { question, profileContext, answerBank } = req.body;
  
  if (!process.env.GEMINI_API_KEY) {
    return res.json({ answer: "[Mock] AI is not configured yet. I am drafting an answer for: " + question });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `You are an applicant filling out a job application form.
Answer the following question: "${question}"

Context about you (Profile):
${JSON.stringify(profileContext, null, 2)}

Previous Answers you have written (Answer Bank):
${JSON.stringify(answerBank, null, 2)}

Instructions:
- Write ONLY the final answer to the question.
- Do not include any introduction, conclusion, or conversational text.
- Do not use emojis.
- Write in a professional, confident tone using the context provided.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    res.json({ answer: response.text });
  } catch (error) {
    console.error('AI Draft Error:', error);
    res.status(500).json({ answer: "Failed to generate AI draft." });
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'AutoApply Stateless AI Proxy is running!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
