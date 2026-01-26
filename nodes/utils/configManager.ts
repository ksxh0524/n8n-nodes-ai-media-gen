export interface ModelConfig {
	name: string;
	default?: boolean;
}

export interface NodeConfig {
	name: string;
	models: Record<string, ModelConfig>;
	operations?: string[];
}

export interface ModelsConfig {
	[key: string]: NodeConfig;
}

const DEFAULT_CONFIG: ModelsConfig = {
	NanoBanana: {
		name: 'Nano Banana',
		models: {
			nano_banana: { name: 'Nano Banana', default: true },
			nano_banana_pro: { name: 'Nano Banana Pro' },
			'z-image-turbo': { name: 'Z-Image Turbo' },
			'qwen-image': { name: 'Qwen Image' },
		},
	},
	Sora: {
		name: 'Sora',
		models: {
			'sora-2': { name: 'Sora 2', default: true },
			'sors-2-pro': { name: 'Sors 2 Pro' },
			'veo-3.1': { name: 'Veo 3.1' },
		},
	},
	ModelScope: {
		name: 'ModelScope',
		models: {
			'qwen-vl-plus': { name: 'Qwen VL Plus', default: true },
			'qwen-vl-max': { name: 'Qwen VL Max' },
			'z-image': { name: 'Z-Image' },
		},
	},
};

export class ConfigManager {
	private static config: ModelsConfig = DEFAULT_CONFIG;

	static loadConfig(): ModelsConfig {
		return ConfigManager.config;
	}

	static getNodeModels(nodeName: string): ModelConfig[] {
		const nodeConfig = ConfigManager.config[nodeName];

		if (!nodeConfig || !nodeConfig.models) {
			return [];
		}

		return Object.entries(nodeConfig.models).map(([id, model]) => ({
			...model,
			id,
		}));
	}

	static getNodeConfig(nodeName: string): NodeConfig | null {
		return ConfigManager.config[nodeName] || null;
	}
}
