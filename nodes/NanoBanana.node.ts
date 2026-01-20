import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
} from 'n8n-workflow';
import { nanoBanana } from '../credentials/NanoBanana.credentials';
import { openai } from '../credentials/OpenAI.credentials';
import { NanoBananaProvider } from '../providers/NanoBananaProvider';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { ConfigManager } from '../utils/configManager';

export class NanoBanana implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nano Banana',
		name: 'nano_banana',
		icon: 'file:ai-media-gen.svg',
		subgroup: 'media-generation',
		version: 1.0,
		defaults: {
			name: 'Nano Banana',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'nanoBanana',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				required: true,
				options: ConfigManager.getNodeModels('NanoBanana').map((model) => ({
					name: model.id,
					value: model.id,
					description: model.name,
				})),
				default: 'nano_banana',
			},
			{
				displayName: 'Custom Model',
				name: 'customModel',
				type: 'string',
				placeholder: 'Enter custom model name',
			},
			{
				displayName: 'Add to Config',
				name: 'addToConfig',
				type: 'string',
				placeholder: 'Enter model name to add to config (optional)',
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: { rows: 5 },
				required: true,
				description: 'Text prompt for generation',
			},
			{
				displayName: 'Additional Parameters (JSON)',
				name: 'additionalParams',
				type: 'string',
				typeOptions: { rows: 8 },
				default: '{}',
				description: 'Additional parameters as JSON object',
			},
			{
				displayName: 'Max Retries',
				name: 'maxRetries',
				type: 'number',
				default: 3,
				description: 'Maximum number of retry attempts',
			},
			{
				displayName: 'Timeout (ms)',
				name: 'timeout',
				type: 'number',
				default: 60000,
				description: 'Request timeout in milliseconds',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('nanoBanana');
		NanoBananaProvider.setApiKey(credentials.apiKey);

		for (let i = 0; i < items.length; i++) {
			try {
				const model = this.getNodeParameter('model', i) as string;
				const prompt = this.getNodeParameter('prompt', i) as string;
				const additionalParamsJson = this.getNodeParameter('additionalParams', i) as string;
				const addToConfig = this.getNodeParameter('addToConfig', i) as string;
				const maxRetries = this.getNodeParameter('maxRetries', i) as number;
				const timeout = this.getNodeParameter('timeout', i) as number;

				let actualModel = model;
				if (model === 'custom') {
					actualModel = this.getNodeParameter('customModel', i) as string;
				}

				if (addToConfig) {
					ConfigManager.addCustomModel('NanoBanana', addToConfig);
					this.logger?.info('Added custom model to config', { model: addToConfig });
				}

				let additionalParams: Record<string, unknown> = {};
				if (additionalParamsJson) {
					try {
						additionalParams = JSON.parse(additionalParamsJson);
					} catch (error) {
						this.logger?.error('Failed to parse additional params', { error });
					}
				}

				this.logger?.info('Starting generation', { model: actualModel, prompt });

				const response = await NanoBananaProvider.generate({
					model: actualModel,
					prompt,
					params: additionalParams,
				});

				const normalizedResponse = NanoBananaProvider.normalizeResponse(response);

				results.push({
					json: normalizedResponse,
				});
			} catch (error) {
				this.logger?.error('Generation failed', {
					error: error instanceof Error ? error.message : String(error),
					model: this.getNodeParameter('model', i) as string,
				});

				results.push({
					json: {
						success: false,
						error: error instanceof Error ? error.message : String(error),
						metadata: {
							provider: 'NanoBanana',
							model: this.getNodeParameter('model', i) as string,
							timestamp: new Date().toISOString(),
						},
					},
				});
			}
		}

		return [this.helpers.constructExecutionMetaData(results, { itemData: { item: 0 } })];
	}
}
