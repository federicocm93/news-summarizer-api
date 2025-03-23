import { Request, Response } from 'express';
import { fetch } from 'undici';

// Get the Ollama API URL from environment variables
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api';
// Get the OpenAI API key from environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Call OpenAI API for summarization
export const handleOpenAIRequest = async (req: Request, res: Response): Promise<void> => {
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
      model: "gpt-3.5-turbo", // Default model, can be made configurable
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
      max_tokens: 500
    };

    // Make the API call to OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const errorData = await response.json() as { error: { message: string } };
      console.error('OpenAI API error:', response.status, errorData.error.message);
      res.status(response.status).json({
        error: 'Error from OpenAI API',
        code: 'OPENAI_ERROR',
        details: errorData.error.message
      });
      return;
    }

    // Process the OpenAI response
    const data = await response.json() as {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    };
    const responseTime = Date.now() - startTime;

    // Log response time for performance monitoring
    console.log(`OpenAI API response time: ${responseTime}ms`);

    // Format the response to match what the client expects
    const formattedResponse = {
      response: data.choices[0]?.message?.content || '',
      // Also include content for compatibility with the OpenAI direct client
      content: data.choices[0]?.message?.content || ''
    };

    res.json(formattedResponse);
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ 
      error: 'Error calling OpenAI API', 
      code: 'OPENAI_ERROR' 
    });
  }
};

// Get user's API usage statistics
export const getUsageStats = async (req: Request, res: Response): Promise<void> => {
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
