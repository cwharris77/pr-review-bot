import type { Config } from './config.interface';

export const DEFAULT_CONFIG: Config = {
  enabled: true,
  reviewOn: ['opened', 'reopened', 'synchronize'],
  includePatterns: ['**/*'],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/*.min.js',
    '**/*.lock',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/pnpm-lock.yaml',
  ],
  comments: {
    inline: true,
    summary: true,
    maxInlineComments: 10,
  },
  ai: {
    focusAreas: ['bugs', 'security', 'performance', 'best-practices'],
    strictness: 'balanced',
  },
};
