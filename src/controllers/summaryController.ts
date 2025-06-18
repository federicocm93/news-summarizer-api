import { ChatGptModel } from '../enums/ChatGptModel';
import { fetch } from 'undici';

// Get the OpenAI API key from environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Call OpenAI API for summarization
export const handleOpenAIRequest = async (req: any, res: any): Promise<void> => {
  try {
    const startTime = Date.now();
    const model = ChatGptModel.GPT_4_1_MINI;
    
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
      model,
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
      temperature: 0.3, // Reduced for more consistent results
      max_tokens: 300, // Reduced from 2000 to ensure concise summaries
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
            console.log(`Summary request took using ${model} model ${totalTime} ms`);
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

// Get allowed news domains
export const getAllowedNewsDomains = async (req: any, res: any): Promise<void> => {
  try {
    const allowedDomains = [
      'elpais.com',
      'elmundo.es',
      'abc.es',
      'elconfidencial.com',
      'lavanguardia.com',
      'elmundo.com',
      'eluniversal.com',
      'eltiempo.com',
      'emol.com',
      'milenio.com',
      'elcomercio.pe',
      'infobae.com',
      'publico.es',
      'eldiario.es',
      'vox.com',
      'lemonde.fr',
      'lefigaro.fr',
      'liberation.fr',
      'lexpress.fr',
      'mediapart.fr',
      'corriere.it',
      'repubblica.it',
      'ilsole24ore.com',
      'lastampa.it',
      'spiegel.de',
      'faz.net',
      'welt.de',
      'sueddeutsche.de',
      'cnn.com',
      'bbc.com',
      'nytimes.com',
      'washingtonpost.com',
      'theguardian.com',
      'foxnews.com',
      'nbcnews.com',
      'cbsnews.com',
      'abcnews.go.com',
      'reuters.com',
      'bloomberg.com',
      'forbes.com',
      'npr.org',
      'apnews.com',
      'newsweek.com',
      'usatoday.com',
      'morningstar.com',
      'economist.com',
      'usnews.com',
      'wsj.com',
      'bloomberg.com',
      'telegraph.co.uk',
      'independent.co.uk',
      'ft.com',
      'npr.org',
      'reuters.com',
      'msnbc.com',
      '*times.com',
      'es-us.noticias.yahoo.com',
      'espanol.yahoo.com/noticias',
      'noticias.yahoo.com',
      'us.yahoo.com',
      'us.yahoo.com/news',
      '*yahoo.com',
      'tn.com.ar',
      '0223.com.ar',
      'lacapital.com.ar',
      'lacapitalmdp.com',
      'lanacion.com.ar',
      'iprofesional.com',
      'clarin.com',
      'pagina12.com.ar',
      'eldestapeweb.com',
      'ambito.com',
      'perfil.com',
      'cronica.com.ar',
      'diariopopular.com.ar',
      'baenegocios.com',
      'losandes.com.ar',
      'lavoz.com.ar',
      'eltribuno.com',
      'diariouno.com.ar',
      'eldia.com',
      'rionegro.com.ar',
      'ellitoral.com'
    ];

    res.status(200).json({
      status: 'success',
      data: {
        domains: allowedDomains
      }
    });
  } catch (error) {
    console.error('Error getting allowed news domains:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving allowed news domains'
    });
  }
};
