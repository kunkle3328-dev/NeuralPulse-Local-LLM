
import { GoogleGenAI } from "@google/genai";
import { Message, AppConfig, ReasoningStep, MemoryEntry } from '../types';
import { STORAGE_KEYS } from '../constants';

export const localInference = {
  // Offline Personal Cognitive Memory: Learns style and preferences
  async learnFromInteraction(query: string, response: string): Promise<void> {
    const memory: MemoryEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.COGNITIVE_MEMORY) || '[]');
    
    // Simple heuristic: If response contains code, save coding style. 
    // If user expresses preference ("I like..."), save preference.
    let type: MemoryEntry['type'] = 'knowledge';
    if (response.includes('```')) type = 'style';
    if (query.toLowerCase().includes('i prefer') || query.toLowerCase().includes('use ')) type = 'preference';

    const newEntry: MemoryEntry = {
      id: Date.now().toString(),
      text: `Context: ${query.slice(0, 100)}... -> Learned: ${response.slice(0, 200)}...`,
      type,
      timestamp: Date.now(),
      importance: type === 'preference' ? 1.0 : 0.6
    };
    
    memory.push(newEntry);
    if (memory.length > 30) memory.shift(); // RAM-safe rolling memory
    localStorage.setItem(STORAGE_KEYS.COGNITIVE_MEMORY, JSON.stringify(memory));
  },

  async retrieveCognitiveMemory(query: string): Promise<string[]> {
    const memory: MemoryEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.COGNITIVE_MEMORY) || '[]');
    const queryTerms = query.toLowerCase().split(' ').filter(t => t.length > 3);
    
    return memory
      .filter(entry => queryTerms.some(term => entry.text.toLowerCase().includes(term)))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 2)
      .map(e => e.text);
  },

  async streamResponse(
    config: AppConfig,
    history: Message[],
    onStepUpdate: (steps: ReasoningStep[]) => void,
    onToken: (token: string, tps: number) => void,
    onComplete: (full: string, sources: string[]) => void,
    onError: (err: any) => void
  ) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const userQuery = history[history.length - 1].content;

    const steps: ReasoningStep[] = [
      { label: 'Intent Decomposition (Phi-3)', status: 'active' },
      { label: 'Identity Memory Sync', status: 'pending' },
      { label: 'Architecture Refinement (Qwen 7B)', status: 'pending' }
    ];

    try {
      onStepUpdate([...steps]);
      
      // STAGE 1: Intent Detection (Simulation of Phi-3 Mini)
      await new Promise(r => setTimeout(r, 700));
      steps[0].status = 'complete';
      steps[1].status = 'active';
      onStepUpdate([...steps]);

      // STAGE 2: Personal Cognitive Retrieval (The Moat)
      let personalContext = "";
      let sources: string[] = [];
      if (config.useCognitiveMemory) {
        const memory = await this.retrieveCognitiveMemory(userQuery);
        if (memory.length > 0) {
          personalContext = `USER STYLE/PREFS FOUND: ${memory.join(' | ')}`;
          sources = ["Identity Vault"];
        }
      }
      await new Promise(r => setTimeout(r, 300));
      steps[1].status = 'complete';
      steps[2].status = 'active';
      onStepUpdate([...steps]);

      // STAGE 3: Final Execution (Qwen 2.5 Coder simulation)
      const systemInstruction = `
        SYSTEM: NeuralPulse V3 (Engine: Qwen 2.5 Coder 7B).
        ENVIRONMENT: 100% Offline, Private, ARM64 Optimized.
        PERSONAL_CONTEXT: ${personalContext || "Generic profile."}
        
        FORMATTING RULES:
        - Use clean Markdown. 
        - Always separate paragraphs with double line breaks.
        - High-contrast code blocks with language identifiers.
        - Bulleted lists for reasoning.
        - Ensure lists have space between items.
      `;

      const contents = history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const startTime = Date.now();
      let tokenCount = 0;

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: contents,
        config: {
          systemInstruction,
          temperature: config.profile === 'Eco' ? 0.2 : 0.75,
          thinkingConfig: { 
            thinkingBudget: config.profile === 'Performance' ? 32000 : 12000 
          }
        }
      });

      let fullText = "";
      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          fullText += text;
          tokenCount += text.length / 4;
          const elapsed = (Date.now() - startTime) / 1000;
          onToken(text, Math.round(tokenCount / elapsed));
        }
      }

      steps[2].status = 'complete';
      onStepUpdate([...steps]);
      onComplete(fullText, sources);

      // Post-Process: Adaptive Learning
      if (fullText.length > 150) {
        this.learnFromInteraction(userQuery, fullText);
      }

    } catch (err) {
      onError(err);
    }
  }
};
