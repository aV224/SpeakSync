// Import required dependencies
require('dotenv').config();
const axios = require('axios');

// Configuration for Perplexity AI API
const perplexityConfig = {
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: 'https://api.perplexity.ai',
  model: process.env.PERPLEXITY_MODEL || 'llama-3-8b-instruct',
  
  // Function to generate a request to the Perplexity API
  generateRequest: async (prompt, options = {}) => {
    if (!perplexityConfig.apiKey) {
      throw new Error('Perplexity API key is not configured');
    }

    try {
      const response = await axios.post(
        `${perplexityConfig.baseURL}/chat/completions`, 
        {
          model: perplexityConfig.model,
          messages: [
            ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
            { role: 'user', content: prompt }
          ],
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 1024,
          top_p: options.topP || 1,
          stream: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${perplexityConfig.apiKey}`
          }
        }
      );

      // Check if we have a proper response
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const result = response.data.choices[0].message.content;
        console.log(`Perplexity API response (truncated): ${result.substring(0, 100)}...`);
        return result;
      } else {
        console.error('Invalid response format from Perplexity API:', response.data);
        throw new Error('Invalid response from Perplexity API');
      }
    } catch (error) {
      // Handle specific API errors
      if (error.response) {
        console.error('Perplexity API error:', error.response.status, error.response.data);
        const errorMessage = error.response.data?.error?.message || 'Unknown API error';
        throw new Error(`Perplexity API error (${error.response.status}): ${errorMessage}`);
      }
      
      console.error('Error calling Perplexity API:', error.message);
      throw error;
    }
  },
  
  // Function to check if the API is available
  isAvailable: async () => {
    if (!perplexityConfig.apiKey) {
      return false;
    }
    
    try {
      // Try a minimal request to check if the API is responsive
      const response = await axios.post(
        `${perplexityConfig.baseURL}/chat/completions`, 
        {
          model: perplexityConfig.model,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${perplexityConfig.apiKey}`
          }
        }
      );
      
      return response.status === 200;
    } catch (error) {
      console.error('Perplexity API availability check failed:', error.message);
      return false;
    }
  }
};

module.exports = perplexityConfig; 