import { fetch } from 'undici';

// Get the OpenAI API key from environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Call OpenAI API for summarization
export const handleOpenAIRequest = async (req: any, res: any): Promise<void> => {
  try {
    const startTime = Date.now();
    
    // Validate the request body
    if (!req.body.text) {
      res.status(400).json({
        error: 'Text is required',
        code: 'INVALID_REQUEST'
      });
      return;
    }

    // Extract the article text from the request body
    const articleText = req.body.text;
    
    // Use the hardcoded prompt format from content.ts
    const formattedPrompt = `Summarize the following news article concisely, keeping the key points and important details. Here is the original article:

${articleText}

Summary:`;

    // Create the OpenAI API request payload
    const requestPayload = {
      model: "gpt-4o", // Switched to fastest model as of June 2025
      messages: [
        {
          role: "system",
          content: "You are an advanced language model that summarizes news articles while maintaining key details. Always return the summary in the same language as the original article."
        },
        {
          role: "user",
          content: formattedPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
      stream: true // Enable streaming
    };

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      let details = '';
      if (errorData && typeof errorData === 'object' && 'error' in errorData && errorData.error && typeof errorData.error === 'object' && 'message' in errorData.error && typeof errorData.error.message === 'string') {
        details = errorData.error.message;
      }
      res.status(response.status).json({
        error: 'Error from OpenAI API',
        code: 'OPENAI_ERROR',
        details: details || ''
      });
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        if (part.startsWith('data: ')) {
          const data = part.slice(6);
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
            res.end();
            const totalTime = Date.now() - startTime;
            console.log(`Summary request took using gpt-4o model ${totalTime} ms`);
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            // Ignore parse errors for non-JSON lines
          }
        }
      }
      
    }
    res.end();
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ 
      error: 'Error calling OpenAI API', 
      code: 'OPENAI_ERROR' 
    });
  }
};

// Get user's API usage statistics
export const getUsageStats = async (req: any, res: any): Promise<void> => {
  try {
    const user = req.user;
    
    if (!user) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required'
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        tier: user.subscriptionTier,
        requestsRemaining: user.requestsRemaining,
      }
    });
  } catch (error) {
    console.error('Error getting usage stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving usage statistics'
    });
  }
};
