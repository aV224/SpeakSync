// Import required dependencies
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Custom Machine Learning model for speech recognition and correction
 * with online learning capabilities.
 */
class SpeechModel {
  constructor() {
    // Model storage paths
    this.dataDir = path.join(__dirname, 'data');
    this.commandMapPath = path.join(this.dataDir, 'commandMap.json');
    this.misspellingsPath = path.join(this.dataDir, 'misspellings.json');
    this.similarityThresholdsPath = path.join(this.dataDir, 'similarityThresholds.json');
    this.feedbackPath = path.join(this.dataDir, 'feedback.json');
    
    // Initialize model data
    this.commandMap = {};
    this.misspellings = {};
    this.similarityThresholds = {
      default: 0.7,
      commands: 0.75,
      files: 0.6
    };
    this.feedback = [];
    
    // Load existing data if available
    this.loadModel();
    
    // Define intent patterns (non-hardcoded - can be learned)
    this.intentPatterns = {
      switch_project: [],
      create_file: [],
      edit_file: [],
      delete_file: [],
      list_files: [],
      run_command: [],
      compile_code: [],
      create_class: []
    };
    
    // Add OpenAI configuration
    this.openaiConfig = {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4-turbo-preview'
    };
    
    // Initialize fallback providers
    this.fallbackProviders = ['openai', 'rule-based'];
    this.currentProvider = 'perplexity';
  }
  
  /**
   * Load model data from storage
   */
  loadModel() {
    try {
      // Create data directory if it doesn't exist
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      
      // Load command map
      if (fs.existsSync(this.commandMapPath)) {
        this.commandMap = JSON.parse(fs.readFileSync(this.commandMapPath, 'utf8'));
      } else {
        // Initialize with default values that can be extended through learning
        this.commandMap = {
          edit: ['edit', 'modify', 'change', 'update'],
          create: ['create', 'make', 'new', 'add'],
          delete: ['delete', 'remove', 'erase', 'eliminate'],
          list: ['list', 'show', 'display', 'see'],
          run: ['run', 'execute', 'start', 'launch'],
          use: ['use', 'switch', 'change', 'open']
        };
        this.saveCommandMap();
      }
      
      // Load misspellings dictionary
      if (fs.existsSync(this.misspellingsPath)) {
        this.misspellings = JSON.parse(fs.readFileSync(this.misspellingsPath, 'utf8'));
      } else {
        // Initialize with common misspellings (to be extended through learning)
        this.misspellings = {
          'edit': ['eddie', 'at it', 'headed'],
          'file': ['foul', 'fall', 'fowl', 'foil'],
          'create': ['great', 'crate'],
          'game': ['gain', 'aim', 'gay', 'gang', 'gaim']
        };
        this.saveMisspellings();
      }
      
      // Load similarity thresholds
      if (fs.existsSync(this.similarityThresholdsPath)) {
        this.similarityThresholds = JSON.parse(fs.readFileSync(this.similarityThresholdsPath, 'utf8'));
      } else {
        this.saveSimilarityThresholds();
      }
      
      // Load feedback data
      if (fs.existsSync(this.feedbackPath)) {
        this.feedback = JSON.parse(fs.readFileSync(this.feedbackPath, 'utf8'));
      } else {
        this.saveFeedback();
      }
      
      // Load intent patterns from command map
      this.updateIntentPatterns();
      
      console.log('Speech model loaded successfully');
    } catch (error) {
      console.error('Error loading speech model:', error);
    }
  }
  
  /**
   * Save command map to storage
   */
  saveCommandMap() {
    try {
      fs.writeFileSync(this.commandMapPath, JSON.stringify(this.commandMap, null, 2));
    } catch (error) {
      console.error('Error saving command map:', error);
    }
  }
  
  /**
   * Save misspellings to storage
   */
  saveMisspellings() {
    try {
      fs.writeFileSync(this.misspellingsPath, JSON.stringify(this.misspellings, null, 2));
    } catch (error) {
      console.error('Error saving misspellings:', error);
    }
  }
  
  /**
   * Save similarity thresholds to storage
   */
  saveSimilarityThresholds() {
    try {
      fs.writeFileSync(this.similarityThresholdsPath, JSON.stringify(this.similarityThresholds, null, 2));
    } catch (error) {
      console.error('Error saving similarity thresholds:', error);
    }
  }
  
  /**
   * Save feedback data to storage
   */
  saveFeedback() {
    try {
      fs.writeFileSync(this.feedbackPath, JSON.stringify(this.feedback, null, 2));
    } catch (error) {
      console.error('Error saving feedback data:', error);
    }
  }
  
  /**
   * Update intent patterns based on command map
   */
  updateIntentPatterns() {
    // Generate regex patterns for each intent based on command maps
    if (this.commandMap.edit) {
      this.intentPatterns.edit_file = this.commandMap.edit.map(term => 
        new RegExp(`\\b(${term})\\s+(?:the\\s+)?(?:file|class)\\b`, 'i')
      );
    }
    
    if (this.commandMap.create) {
      this.intentPatterns.create_file = this.commandMap.create.map(term => 
        new RegExp(`\\b(${term})\\s+(?:a\\s+)?(?:new\\s+)?(?:file|class)\\b`, 'i')
      );
    }
    
    if (this.commandMap.delete) {
      this.intentPatterns.delete_file = this.commandMap.delete.map(term => 
        new RegExp(`\\b(${term})\\s+(?:the\\s+)?(?:file|class)\\b`, 'i')
      );
    }
    
    if (this.commandMap.list) {
      this.intentPatterns.list_files = this.commandMap.list.map(term => 
        new RegExp(`\\b(${term})\\s+(?:the\\s+)?(?:files|directory|folders)\\b`, 'i')
      );
    }
    
    if (this.commandMap.run) {
      this.intentPatterns.run_command = this.commandMap.run.map(term => 
        new RegExp(`\\b(${term})\\s+(?:the\\s+)?(?:command|program|server)\\b`, 'i')
      );
    }
    
    if (this.commandMap.use) {
      this.intentPatterns.switch_project = this.commandMap.use.map(term => 
        new RegExp(`\\b(${term})\\s+(?:the\\s+)?(game|project)\\b`, 'i')
      );
    }
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {number} - The distance between strings
   */
  levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    return matrix[b.length][a.length];
  }
  
  /**
   * Calculate similarity ratio between two strings (0-1)
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {number} - Similarity ratio (0-1)
   */
  getSimilarityRatio(a, b) {
    const longerLength = Math.max(a.length, b.length);
    if (longerLength === 0) return 1.0;
    
    const distance = this.levenshteinDistance(a, b);
    return (longerLength - distance) / longerLength;
  }
  
  /**
   * Find the best match for a word in a list of possible matches
   * @param {string} word - The word to match
   * @param {string[]} possibleMatches - List of possible matches
   * @param {number} threshold - Similarity threshold (0-1)
   * @returns {string|null} - The best match or null if none found
   */
  findBestMatch(word, possibleMatches, threshold = this.similarityThresholds.default) {
    let bestMatch = null;
    let bestScore = threshold;
    
    // First check for exact matches
    if (possibleMatches.includes(word)) {
      return word;
    }
    
    // Check known misspellings
    for (const [correct, misspelled] of Object.entries(this.misspellings)) {
      if (misspelled.includes(word)) {
        return correct;
      }
    }
    
    // Check similarity with all possible matches
    for (const match of possibleMatches) {
      const similarity = this.getSimilarityRatio(word.toLowerCase(), match.toLowerCase());
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = match;
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Correct a speech input using the model
   * @param {string} speech - The speech input to correct
   * @returns {string} - The corrected speech
   */
  correctSpeech(speech) {
    if (!speech) return '';
    
    // Get all available corrections
    const allCorrections = [];
    for (const [intent, variations] of Object.entries(this.commandMap)) {
      variations.forEach(variation => {
        if (!allCorrections.includes(variation)) {
          allCorrections.push(variation);
        }
      });
    }
    
    // Get words from speech
    const words = speech.toLowerCase().split(/\s+/);
    
    // Process the speech to identify and correct words
    const processedWords = words.map(word => {
      // Check for corrections in our command map
      for (const [intent, variations] of Object.entries(this.commandMap)) {
        const bestMatch = this.findBestMatch(
          word, 
          variations, 
          this.similarityThresholds.commands
        );
        
        if (bestMatch) {
          console.log(`Speech correction: "${word}" → "${intent}"`);
          return intent; // Return the intent, not the matched variation
        }
      }
      
      // If no specific intent match, try general corrections
      const bestGeneralMatch = this.findBestMatch(
        word,
        allCorrections,
        this.similarityThresholds.default
      );
      
      if (bestGeneralMatch) {
        console.log(`General correction: "${word}" → "${bestGeneralMatch}"`);
        return bestGeneralMatch;
      }
      
      return word;
    });
    
    // Convert processed words back to a string
    let processed = processedWords.join(' ');
    
    // Apply contextual fixes using regex patterns
    const contextualFixes = [
      { pattern: /\b(use|switch|change)(\s+to)?\s+game\b/gi, replacement: 'use game project' },
      { pattern: /\bsnake\s+game\b/gi, replacement: 'snake game' },
      { pattern: /\bedit(\s+the)?\s+file\b/gi, replacement: 'edit file' },
      { pattern: /\bcreate(\s+a)?\s+file\b/gi, replacement: 'create file' }
    ];
    
    for (const fix of contextualFixes) {
      processed = processed.replace(fix.pattern, fix.replacement);
    }
    
    return processed;
  }
  
  /**
   * Extract the most likely intent from speech
   * @param {string} speech - The speech input
   * @returns {string} - The detected intent
   */
  extractIntent(speech) {
    if (!speech) return 'unknown';
    
    const lowerSpeech = speech.toLowerCase();
    
    // Check each intent pattern
    for (const intent in this.intentPatterns) {
      const patterns = this.intentPatterns[intent];
      for (const pattern of patterns) {
        if (pattern instanceof RegExp && pattern.test(lowerSpeech)) {
          return intent;
        }
      }
    }
    
    // If no specific intent is found, use keyword-based approach
    for (const [intent, variations] of Object.entries(this.commandMap)) {
      for (const variation of variations) {
        if (lowerSpeech.includes(variation)) {
          return `${intent}_something`;
        }
      }
    }
    
    return 'unknown';
  }
  
  /**
   * Add feedback for a speech correction
   * @param {string} original - Original speech input
   * @param {string} corrected - System's correction
   * @param {string} userCorrection - User's correction
   * @param {string} intent - Detected intent
   * @returns {Object} - The stored feedback
   */
  addFeedback(original, corrected, userCorrection, intent) {
    const feedback = {
      timestamp: new Date().toISOString(),
      original,
      corrected,
      userCorrection,
      intent,
      processed: false
    };
    
    this.feedback.push(feedback);
    this.saveFeedback();
    
    // Process the feedback immediately to update the model
    this.processFeedback(feedback);
    
    return feedback;
  }
  
  /**
   * Process a feedback item to update the model
   * @param {Object} feedback - The feedback item
   */
  processFeedback(feedback) {
    try {
      // Compare system correction with user correction
      const systemWords = feedback.corrected.toLowerCase().split(/\s+/);
      const userWords = feedback.userCorrection.toLowerCase().split(/\s+/);
      
      // Identify differences and update the model
      for (let i = 0; i < Math.min(systemWords.length, userWords.length); i++) {
        if (systemWords[i] !== userWords[i]) {
          const wrongWord = systemWords[i];
          const correctWord = userWords[i];
          
          // Find the intent for this word
          let targetIntent = null;
          for (const [intent, words] of Object.entries(this.commandMap)) {
            if (words.includes(correctWord)) {
              targetIntent = intent;
              break;
            }
          }
          
          if (targetIntent) {
            // Add the wrong word as a misspelling of the correct intent
            if (!this.misspellings[targetIntent]) {
              this.misspellings[targetIntent] = [];
            }
            
            if (!this.misspellings[targetIntent].includes(wrongWord)) {
              this.misspellings[targetIntent].push(wrongWord);
              console.log(`Added misspelling: "${wrongWord}" → "${targetIntent}"`);
            }
          } else {
            // If no existing intent found, create a new misspelling entry
            this.misspellings[correctWord] = this.misspellings[correctWord] || [];
            if (!this.misspellings[correctWord].includes(wrongWord)) {
              this.misspellings[correctWord].push(wrongWord);
              console.log(`Added misspelling: "${wrongWord}" → "${correctWord}"`);
            }
          }
        }
      }
      
      // Save the updated misspellings
      this.saveMisspellings();
      
      // Mark the feedback as processed
      feedback.processed = true;
      this.saveFeedback();
    } catch (error) {
      console.error('Error processing feedback:', error);
    }
  }
  
  /**
   * Process all unprocessed feedback
   */
  processAllFeedback() {
    const unprocessed = this.feedback.filter(f => !f.processed);
    unprocessed.forEach(feedback => {
      this.processFeedback(feedback);
    });
  }
  
  /**
   * Add a new command variation
   * @param {string} intent - The intent to add a variation for
   * @param {string} variation - The new variation
   * @returns {boolean} - Success status
   */
  addCommandVariation(intent, variation) {
    try {
      if (!this.commandMap[intent]) {
        this.commandMap[intent] = [];
      }
      
      if (!this.commandMap[intent].includes(variation)) {
        this.commandMap[intent].push(variation);
        this.saveCommandMap();
        this.updateIntentPatterns();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error adding command variation:', error);
      return false;
    }
  }
  
  /**
   * Update similarity thresholds
   * @param {Object} newThresholds - New threshold values
   * @returns {boolean} - Success status
   */
  updateThresholds(newThresholds) {
    try {
      this.similarityThresholds = {
        ...this.similarityThresholds,
        ...newThresholds
      };
      
      this.saveSimilarityThresholds();
      return true;
    } catch (error) {
      console.error('Error updating thresholds:', error);
      return false;
    }
  }
  
  /**
   * Process speech with fallback options
   * @param {string} speech - The speech input
   * @returns {Object} - Processing result
   */
  async processSpeech(speech) {
    try {
      // Try primary provider (Perplexity)
      const result = await this.processWithPerplexity(speech);
      return result;
    } catch (error) {
      console.error('Primary provider failed:', error);
      
      // Try fallback providers
      for (const provider of this.fallbackProviders) {
        try {
          console.log(`Trying fallback provider: ${provider}`);
          let result;
          
          if (provider === 'openai') {
            result = await this.processWithOpenAI(speech);
          } else {
            result = this.processWithRuleBased(speech);
          }
          
          if (result) {
            this.currentProvider = provider;
            return result;
          }
        } catch (fallbackError) {
          console.error(`Fallback provider ${provider} failed:`, fallbackError);
        }
      }
      
      throw new Error('All providers failed');
    }
  }
  
  /**
   * Process speech with OpenAI
   * @param {string} speech - The speech input
   * @returns {Object} - OpenAI processing result
   */
  async processWithOpenAI(speech) {
    try {
      const response = await axios.post(`${this.openaiConfig.baseUrl}/chat/completions`, {
        model: this.openaiConfig.model,
        messages: [
          {
            role: 'system',
            content: 'You are a voice command interpreter. Convert speech to structured commands.'
          },
          {
            role: 'user',
            content: speech
          }
        ],
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiConfig.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      return {
        provider: 'openai',
        result: response.data.choices[0].message.content,
        confidence: 0.9
      };
    } catch (error) {
      console.error('OpenAI processing error:', error);
      throw error;
    }
  }
  
  /**
   * Process speech with rule-based approach
   * @param {string} speech - The speech input
   * @returns {Object} - Rule-based processing result
   */
  processWithRuleBased(speech) {
    const corrected = this.correctSpeech(speech);
    const intent = this.extractIntent(corrected);
    
    return {
      provider: 'rule-based',
      result: {
        corrected,
        intent
      },
      confidence: 0.7
    };
  }
}

module.exports = new SpeechModel(); 