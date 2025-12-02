import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const ReviewSchema = z.object({
  summary: z.string().describe('A high-level summary of the changes in the PR'),
  inlineComments: z
    .array(
      z.object({
        path: z.string().describe('The file path for the comment'),
        line: z
          .number()
          .describe('The line number in the new file to comment on'),
        body: z.string().describe('The review comment content'),
      }),
    )
    .describe('List of inline review comments'),
  suggestions: z
    .array(z.string())
    .describe('General suggestions for improvement'),
  releaseNotes: z.string().describe('Draft release notes for these changes'),
});

@Injectable()
export class AiService {
  private openai: OpenAI;
  private readonly logger = new Logger(AiService.name);

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzePR(files: any[], config: any) {
    this.logger.log(`Analyzing ${files.length} files...`);

    const diffs = files
      .map((file) => `File: ${file.filename}\nDiff:\n${file.patch}`)
      .join('\n\n');

    const focusAreas = config.ai?.focusAreas?.join(', ');
    const strictness = config.ai?.strictness;
    const customInstructions = config.ai?.customInstructions;
    const maxDiffLines = config.ai?.maxDiffLines;

    // Calculate total lines in diffs
    const totalLines = diffs.split('\n').length;
    if (totalLines > maxDiffLines) {
      this.logger.warn(
        `PR too large to analyze: ${totalLines} lines (limit: ${maxDiffLines})`,
      );
      return {
        summary: `**Skipped Review**: This PR contains ${totalLines} lines of changes, which exceeds the limit of ${maxDiffLines} lines.`,
        inlineComments: [],
        suggestions: [],
        releaseNotes: '',
      };
    }

    const prompt = `
      You are an expert code reviewer. Analyze the following file diffs from a Pull Request.
      Provide a summary, inline comments for specific issues, general suggestions, and draft release notes.

      Configuration:
      - Focus Areas: ${focusAreas}
      - Strictness: ${strictness}
      ${customInstructions ? `- Custom Instructions: ${customInstructions}` : ''}

      Guidelines:
      - Focus primarily on the requested focus areas.
      - Adjust your tone and nit-picking based on the strictness level:
        - lenient: Only point out critical bugs and major security issues. Be encouraging.
        - balanced: Point out bugs, security issues, and clear code style violations.
        - strict: Point out everything including minor style nitpicks, optimization opportunities, and documentation gaps.
      - For inline comments, ensure the line number exists in the added lines of the diff (lines starting with +).
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: diffs },
        ],
        response_format: zodResponseFormat(ReviewSchema, 'review'),
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(response);
      return parsed;
    } catch (error) {
      this.logger.error('Error analyzing PR with AI', error);
      throw error;
    }
  }

  formatAnalysisAsMarkdown(analysis: any) {
    return `
**PR Summary:**
${analysis.summary}

**Suggestions:**
- ${analysis.suggestions.join('\n- ')}

**Release Notes:**
${analysis.releaseNotes}
`;
  }
}
