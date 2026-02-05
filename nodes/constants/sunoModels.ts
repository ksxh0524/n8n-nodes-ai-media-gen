/**
 * Suno model configuration
 *
 * Defines all supported Suno models with their display names and API values
 */

export interface SunoModelConfig {
	/** Display name shown in UI */
	displayName: string;
	/** Version identifier (e.g., 'v5', 'v4.5') */
	version: string;
	/** Actual model name used in API request */
	apiValue: string;
	/** Description of the model */
	description: string;
}

/**
 * Available Suno models
 */
export const SUNO_MODELS: Record<string, SunoModelConfig> = {
	'chirp-crow': {
		displayName: 'v5',
		version: 'v5',
		apiValue: 'chirp-crow',
		description: 'Latest version - chirp-crow',
	},
	'chirp-bluejay': {
		displayName: 'v4.5',
		version: 'v4.5',
		apiValue: 'chirp-bluejay',
		description: 'Version 4.5+ - chirp-bluejay',
	},
};

/**
 * Default model to use
 */
export const DEFAULT_SUNO_MODEL = 'chirp-crow';

/**
 * Get model options for n8n UI
 */
export function getSunoModelOptions(): Array<{
	name: string;
	value: string;
	description: string;
}> {
	return Object.entries(SUNO_MODELS).map(([key, config]) => ({
		name: config.displayName,
		value: key,
		description: config.description,
	}));
}

/**
 * Get API value for a model key
 */
export function getSunoModelApiValue(modelKey: string): string {
	return SUNO_MODELS[modelKey]?.apiValue || DEFAULT_SUNO_MODEL;
}

/**
 * Get display name for a model key
 */
export function getSunoModelDisplayName(modelKey: string): string {
	return SUNO_MODELS[modelKey]?.displayName || 'Unknown';
}

/**
 * Get all supported model keys
 */
export function getSunoModelKeys(): string[] {
	return Object.keys(SUNO_MODELS);
}

/**
 * Check if a model key is valid
 */
export function isValidSunoModel(modelKey: string): boolean {
	return modelKey in SUNO_MODELS;
}
