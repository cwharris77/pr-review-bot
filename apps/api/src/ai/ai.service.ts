import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
  async analyzePR(files: any[]) {
    // TODO: Implement AI analysis logic
    return {
      summary: 'Example summary',
      suggestions: ['Refactor X', 'Add test Y'],
      tests: ['test_example()'],
      releaseNotes: 'Added new feature',
    };
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
