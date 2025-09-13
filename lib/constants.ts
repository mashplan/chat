import { generateDummyPassword } from './db/utils';

export const isProductionEnvironment = process.env.NODE_ENV === 'production';
export const isDevelopmentEnvironment = process.env.NODE_ENV === 'development';
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT,
);
export const isDebugEnabled =
  process.env.DEBUG === 'true' || process.env.DEBUG === '1';

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();

// Feature flags
export const isMultiModelChooseEnabled =
  process.env.FEATURE_MULTI_MODEL_CHOOSE === 'true';

// Default answer language (if provided). Example: 'swedish', 'english'.
// If unset or empty, no default language instruction is applied.
export const defaultAnswerLanguage = (
  process.env.FEATURE_DEFAULT_ANSWER_LANGUAGE || ''
).trim();
