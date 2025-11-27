import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
  async analyzePR(files: any[]) {
    // TODO: Implement AI analysis logic
    // For now, return example structured feedback
    const inlineComments: Array<{ path: string; line: number; body: string }> =
      [];

    // Example: Add inline comments for each file
    for (const file of files) {
      if (file.patch) {
        // Example comment on first changed line
        inlineComments.push({
          path: file.filename,
          line: this.getFirstChangedLine(file.patch),
          body: `Consider adding error handling here`,
        });
      }
    }

    return {
      summary: 'Example summary',
      suggestions: ['Refactor X', 'Add test Y'],
      tests: ['test_example()'],
      releaseNotes: 'Added new feature',
      inlineComments, // New: structured inline comments
    };
  }

  private getFirstChangedLine(patch: string): number {
    // Parse the patch to find the first changed line number
    const match = patch.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)/m);
    return match ? parseInt(match[1]) : 1;
  }

  formatAnalysisAsMarkdown(analysis: any) {
    return `
**PR Summary:**  
${analysis.summary}

**Suggestions:**  
- ${analysis.suggestions.join('\n- ')}

**Generated Tests:**  
\`\`\`ts
${analysis.tests.join('\n')}
\`\`\`

**Release Notes:**  
${analysis.releaseNotes}
`;
  }
}
