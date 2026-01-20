import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
} from 'n8n-workflow';
import { OpenAICredentials } from '../credentials/OpenAI.credentials';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { ConfigManager } from '../utils/configManager';

export class Sora implements INodeType {
	description: {
		displayName: 'Sora',
		name: 'sora',
		icon: 'file:ai-media-gen.svg',
		subgroup: 'media-generation',
		version: 1.0,
		defaults: {
			name: 'Sora',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'openai',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				required: true,
				options: ConfigManager.getNodeModels('Sora').map((model) => ({
					name: model.id,
					value: model.id,
					description: model.name,
				})),
				default: 'sora-2',
			},
			{
				displayName: 'Custom Model',
				name: 'customModel',
				type: 'string',
				displayOptions: {
					showWhen: {
						field: 'model',
						value: 'custom',
					},
				},
				placeholder: 'Enter custom model name',
			},
			{
				displayName: 'Add to Config',
				name: 'addToConfig',
				type: 'string',
				displayOptions: {
					showWhen: {
						field: 'model',
						value: 'custom',
					},
				},
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

		const credentials = await this.getCredentials('openai');
		OpenAIProvider.setApiKey(credentials.apiKey);

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
					ConfigManager.addCustomModel('Sora', addToConfig);
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

				this.logger?.info('Starting video generation', { model: actualModel, prompt });

				const response = await OpenAIProvider.generateVideo({
					model: actualModel,
					prompt,
					params: additionalParams,
				});

				const normalizedResponse = OpenAIProvider.normalizeResponse(response);

				results.push({
					json: normalizedResponse,
				});
			} catch (error) {
				this.logger?.error('Video generation failed', {
					error: error instanceof Error ? error.message : String(error),
					model: this.getNodeParameter('model', i) as string,
				});

				results.push({
					json: {
						success: false,
						error: error instanceof Error ? error.message : String(error),
						metadata: {
							provider: 'Sora',
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
