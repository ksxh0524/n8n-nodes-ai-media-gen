import * as fs from 'fs';
import * as path from 'path';

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

const CONFIG_FILE_PATH = path.join(__dirname, '../../config/models.json');

export class ConfigManager {
	private static config: ModelsConfig | null = null;
	private static defaultConfig: ModelsConfig = {
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
	};

	static loadConfig(): ModelsConfig {
		if (ConfigManager.config) {
			return ConfigManager.config;
		}

		try {
			const configContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
			ConfigManager.config = JSON.parse(configContent) as ModelsConfig;
			return ConfigManager.config;
		} catch (error) {
			console.error('Failed to load config file:', error);
			return ConfigManager.defaultConfig;
		}
	}

	static saveConfig(config: ModelsConfig): void {
		try {
			const configContent = JSON.stringify(config, null, 2);
			fs.writeFileSync(CONFIG_FILE_PATH, configContent, 'utf-8');
			ConfigManager.config = config;
		} catch (error) {
			console.error('Failed to save config file:', error);
		}
	}

	static getNodeModels(nodeName: string): ModelConfig[] {
		const config = ConfigManager.loadConfig();
		const nodeConfig = config[nodeName];

		if (!nodeConfig || !nodeConfig.models) {
			return [];
		}

		return Object.entries(nodeConfig.models).map(([id, model]) => ({
			...model,
			id,
		}));
	}

	static addCustomModel(nodeName: string, modelName: string): void {
		const config = ConfigManager.loadConfig();
		
		if (!config[nodeName]) {
			config[nodeName] = {
				name: nodeName,
				models: {},
			};
		}

		const nodeConfig = config[nodeName];
		const customModelId = `user_custom_${Object.keys(nodeConfig.models).length + 1}`;
		
		nodeConfig.models[customModelId] = {
			name: modelName,
		};

		ConfigManager.saveConfig(config);
	}

	static getNodeConfig(nodeName: string): NodeConfig | null {
		const config = ConfigManager.loadConfig();
		return config[nodeName] || null;
	}
}
