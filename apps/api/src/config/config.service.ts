import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import { minimatch } from 'minimatch';
import type { Config } from './config.interface';
import { DEFAULT_CONFIG } from './default-config';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  /**
   * Parse YAML content and merge with default configuration
   * @param yamlContent - Raw YAML file content
   * @returns Parsed and validated configuration
   */
  parseConfig(yamlContent: string): Config {
    try {
      const userConfig = yaml.load(yamlContent) as Partial<Config>;

      if (!userConfig || typeof userConfig !== 'object') {
        this.logger.warn('Invalid config format, using defaults');
        return DEFAULT_CONFIG;
      }

      // Deep merge user config with defaults
      const mergedConfig: Config = {
        ...DEFAULT_CONFIG,
        ...userConfig,
        comments: {
          ...DEFAULT_CONFIG.comments,
          ...userConfig.comments,
        },
        ai: {
          ...DEFAULT_CONFIG.ai,
          ...userConfig.ai,
        },
      };

      this.logger.log('Successfully parsed user configuration');
      return mergedConfig;
    } catch (error) {
      this.logger.error('Error parsing YAML config:', error);
      this.logger.warn('Falling back to default configuration');
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Get default configuration
   * @returns Default configuration object
   */
  getDefaultConfig(): Config {
    return DEFAULT_CONFIG;
  }

  /**
   * Validate if bot should run based on config and event action
   * @param config - Parsed configuration
   * @param action - GitHub webhook action (opened, reopened, synchronize, etc.)
   * @returns Whether the bot should process this event
   */
  shouldReview(config: Config, action: string): boolean {
    if (!config.enabled) {
      this.logger.log('Bot is disabled in config');
      return false;
    }

    if (!config.reviewOn?.includes(action as any)) {
      this.logger.log(`Action '${action}' not in reviewOn list`);
      return false;
    }

    return true;
  }

  /**
   * Check if a file should be reviewed based on include/exclude patterns
   * @param config - Parsed configuration
   * @param filePath - Path of the file to check
   * @returns Whether the file should be reviewed
   */
  shouldReviewFile(config: Config, filePath: string): boolean {
    // Check exclude patterns first
    if (config.excludePatterns) {
      for (const pattern of config.excludePatterns) {
        if (minimatch(filePath, pattern)) {
          this.logger.log(
            `File '${filePath}' excluded by pattern '${pattern}'`,
          );
          return false;
        }
      }
    }

    // Check include patterns
    if (config.includePatterns) {
      for (const pattern of config.includePatterns) {
        if (minimatch(filePath, pattern)) {
          return true;
        }
      }
      this.logger.log(`File '${filePath}' did not match any include patterns`);
      return false; // No include pattern matched
    }

    return true; // No patterns specified, include by default
  }
}
