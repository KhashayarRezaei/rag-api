import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GroundingSource {
  index: number; // 1-based citation number
  documentTitle: string;
  content: string;
}

const SYSTEM = [
  'You answer questions strictly from the provided numbered context sources.',
  'Cite every claim with the bracket number(s) of the supporting source, e.g. [1] or [2][3].',
  "If the context does not contain the answer, say you don't know — do not use outside knowledge.",
  'Respond with only the answer: no preamble, no restating the question.',
].join(' ');

/**
 * Grounded answer generation with Gemini `gemini-1.5-flash`. Without a key, a
 * transparent extractive fallback returns the top source so `/query` still works
 * (retrieval is the product; generation is a thin layer on top).
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly modelName: string;
  private readonly client: GoogleGenerativeAI | null;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.modelName = config.get<string>('gemini.llmModel') ?? 'gemini-1.5-flash';
    const apiKey = config.get<string | null>('gemini.apiKey');
    this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async generateAnswer(question: string, sources: GroundingSource[]): Promise<string> {
    if (sources.length === 0) return "I don't know — no relevant sources were found.";
    if (!this.client) return this.extractiveFallback(sources);

    const context = sources
      .map((s) => `[${s.index}] (${s.documentTitle})\n${s.content}`)
      .join('\n\n');
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: SYSTEM,
    });
    const result = await model.generateContent(`Context:\n${context}\n\nQuestion: ${question}`);
    return result.response.text().trim();
  }

  private extractiveFallback(sources: GroundingSource[]): string {
    const top = sources[0];
    const snippet = top.content.length > 500 ? `${top.content.slice(0, 500)}…` : top.content;
    return `${snippet} [1]`;
  }
}
