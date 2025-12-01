# Configuration

The PR Review Bot can be configured by adding a `probot.yaml` file to the `.github` folder in your repository.

## Configuration File Location

Place your configuration file at one of these locations:

- `.github/probot.yaml`
- `.github/probot.yml`

## Configuration Options

### `enabled`

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Enable or disable the PR review bot for this repository.

### `reviewOn`

- **Type:** `array of strings`
- **Default:** `['opened', 'reopened', 'synchronize']`
- **Options:** `opened`, `reopened`, `synchronize`
- **Description:** Trigger events that will cause the bot to review PRs.

### `includePatterns`

- **Type:** `array of strings` (glob patterns)
- **Default:** `['**/*']`
- **Description:** File patterns to include in review. Only files matching these patterns will be reviewed.

### `excludePatterns`

- **Type:** `array of strings` (glob patterns)
- **Default:** `['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.min.js', '**/*.lock', '**/package-lock.json', '**/yarn.lock', '**/pnpm-lock.yaml']`
- **Description:** File patterns to exclude from review. Files matching these patterns will be skipped.

### `comments`

Configuration for how the bot posts comments on PRs.

#### `comments.inline`

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Post inline comments on specific lines of code.

#### `comments.summary`

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Post a summary comment on the PR.

#### `comments.maxInlineComments`

- **Type:** `number`
- **Default:** `10`
- **Description:** Maximum number of inline comments to post per PR.

### `ai`

Configuration for AI review behavior.

#### `ai.customInstructions`

- **Type:** `string`
- **Default:** `undefined`
- **Description:** Custom instructions or prompts for the AI reviewer.

#### `ai.focusAreas`

- **Type:** `array of strings`
- **Default:** `['bugs', 'security', 'performance', 'best-practices']`
- **Options:** `bugs`, `security`, `performance`, `best-practices`, `style`, `documentation`
- **Description:** Areas the AI should focus on during review.

#### `ai.strictness`

- **Type:** `string`
- **Default:** `balanced`
- **Options:** `lenient`, `balanced`, `strict`
- **Description:** How strict the AI should be in its reviews.

## Example Configuration

```yaml
# Enable the bot
enabled: true

# Review on PR open, reopen, and new commits
reviewOn:
  - opened
  - reopened
  - synchronize

# Only review TypeScript and JavaScript files
includePatterns:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"

# Exclude test files and generated code
excludePatterns:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/generated/**"

# Comment preferences
comments:
  inline: true
  summary: true
  maxInlineComments: 15

# AI configuration
ai:
  customInstructions: "Focus on TypeScript best practices and potential runtime errors."
  focusAreas:
    - bugs
    - security
    - best-practices
  strictness: strict
```

## No Configuration File

If no configuration file is found, the bot will use default settings that review all files (except common build artifacts and dependencies) and post both inline and summary comments.
