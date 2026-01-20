import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
} from 'n8n-workflow';
import { QwenCredentials } from '../credentials/Qwen.credentials';
import { QwenProvider } from '../providers/QwenProvider';
import { ConfigManager } from '../utils/configManager';

export class Qwen implements INodeType {
	description: {
		displayName: 'Qwen',
		name: 'qwen',
		icon: 'file:ai-media-gen.svg',
		subgroup: 'media-generation',
		version: 1.0,
		defaults: {
			name: 'Qwen',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'qwen',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				required: true,
				options: ConfigManager.getNodeModels('Qwen').map((model) => ({
					name: model.id,
					value: model.id,
					description: model.name,
				})),
				default: 'qwen-image',
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
				displayName: 'Image Input',
				name: 'imageInput',
				type: 'string',
				displayOptions: {
					showWhen: {
						field: 'model',
						value: 'qwen-image-edit',
					},
				},
				placeholder: 'Enter image URL for editing',
				description: 'Image URL for editing (only for image edit operation)',
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

		const credentials = await this.getCredentials('qwen');
		QwenProvider.setApiKey(credentials.apiKey);

		for (let i = 0; i < items.length; i++) {
			try {
				const model = this.getNodeParameter('model', i) as string;
				const prompt = this.getNodeParameter('prompt', i) as string;
				const imageInput = this.getNodeParameter('imageInput', i) as string;
				const additionalParamsJson = this.getNodeParameter('additionalParams', i) as string;
				const addToConfig = this.getNodeParameter('addToConfig', i) as string;
				const maxRetries = this.getNodeParameter('maxRetries', i) as number;
				const timeout = this.getNodeParameter('timeout', i) as number;

				let actualModel = model;
				if (model === 'custom') {
					actualModel = this.getNodeParameter('customModel', i) as string;
				}

				if (addToConfig) {
					ConfigManager.addCustomModel('Qwen', addToConfig);
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

				this.logger?.info('Starting generation', { model: actualModel, prompt, imageInput });

				let response;
				
				if (model === 'qwen-image-edit') {
					if (!imageInput) {
						throw new Error('Image input is required for image edit operation');
					}
					response = await QwenProvider.editImage({
						model: actualModel,
						prompt,
						image: imageInput,
						params: additionalParams,
					});
				} else {
					response = await QwenProvider.generateImage({
						model: actualModel,
						prompt,
						params: additionalParams,
					});
				}

				const normalizedResponse = QwenProvider.normalizeResponse(response);

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
							provider: 'Qwen',
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
