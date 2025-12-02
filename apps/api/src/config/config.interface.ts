export interface Config {
  /**
   * Enable or disable the PR review bot
   */
  enabled?: boolean;

  /**
   * Trigger events for PR reviews
   */
  reviewOn?: ('opened' | 'reopened' | 'synchronize')[];

  /**
   * File patterns to include in review (glob patterns)
   */
  includePatterns?: string[];

  /**
   * File patterns to exclude from review (glob patterns)
   */
  excludePatterns?: string[];

  /**
   * Comment style preferences
   */
  comments?: {
    /**
     * Post inline comments on specific lines
     */
    inline?: boolean;

    /**
     * Post a summary comment on the PR
     */
    summary?: boolean;

    /**
     * Maximum number of inline comments per PR
     */
    maxInlineComments?: number;
  };

  /**
   * AI model preferences
   */
  ai?: {
    /**
     * Custom instructions or prompts for the AI
     */
    customInstructions?: string;

    /**
     * Focus areas for review
     */
    focusAreas?: (
      | 'bugs'
      | 'security'
      | 'performance'
      | 'best-practices'
      | 'style'
      | 'documentation'
    )[];

    /**
     * Review strictness level
     */
    strictness?: 'lenient' | 'balanced' | 'strict';

    /**
     * Maximum number of lines of code to review per PR to control costs.
     * If the diff exceeds this, the review may be skipped or truncated.
     */
    maxDiffLines?: number;
  };
}
