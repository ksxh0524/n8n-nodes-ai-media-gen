import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
} from 'n8n-workflow';
import { ActionRegistry } from './utils/actionRegistry';
import type { ActionType } from './utils/actionHandler';
import { CacheManager } from './utils/cache';
import { PerformanceMonitor } from './utils/monitoring';
import * as CONSTANTS from './utils/constants';

interface ResultMetadata {
	cached?: boolean;
	[key: string]: unknown;
}

const ACTIONS: Array<{ name: string; value: ActionType }> = [
	{ name: 'ModelScope Generate Image', value: 'modelScopeGenerateImage' },
	{ name: 'ModelScope Edit Image', value: 'modelScopeEditImage' },
];

export class AIMediaGen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI Media Generation',
		name: 'aiMediaGen',
		icon: 'file:ai-media-gen.svg',
		description: 'Generate and process media using AI models',
		version: CONSTANTS.NODE_VERSION,
		group: ['transform'],
		subtitle: '={{$parameter.action}}',
		defaults: {
			name: 'AI Media Generation',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'modelScopeApi',
				required: false,
			},
		],
		properties: [
			{
				displayName: 'Action',
				name: 'action',
				type: 'options',
				noDataExpression: true,
				options: ACTIONS,
				default: '',
				required: true,
				description: 'Select the action to perform',
			},
			// ModelScope Generate Image parameters
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				default: 'Z-Image-Turbo',
				required: true,
				options: [
					{ name: 'Z-Image-Turbo', value: 'Z-Image-Turbo' },
					{ name: 'Qwen-Image-2512', value: 'Qwen-Image-2512' },
				],
				description: 'Select the ModelScope model',
				displayOptions: {
					show: {
						action: ['modelScopeGenerateImage'],
					},
				},
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: {
					rows: CONSTANTS.UI.TEXT_AREA_ROWS.PROMPT,
				},
				default: '',
				required: true,
				description: 'Text description of the image to generate',
				displayOptions: {
					show: {
						action: ['modelScopeGenerateImage', 'modelScopeEditImage'],
					},
				},
			},
			{
				displayName: 'Size',
				name: 'size',
				type: 'options',
				default: '1024x1024',
				options: [
					{ name: '512x512', value: '512x512' },
					{ name: '768x768', value: '768x768' },
					{ name: '1024x1024', value: '1024x1024' },
					{ name: '2048x2048', value: '2048x2048' },
					{ name: '512x1024', value: '512x1024' },
					{ name: '1024x512', value: '1024x512' },
				],
				description: 'Image size',
				displayOptions: {
					show: {
						action: ['modelScopeGenerateImage'],
					},
				},
			},
			{
				displayName: 'Seed',
				name: 'seed',
				type: 'number',
				default: 0,
				description: 'Random seed for reproducibility (0 = random)',
				displayOptions: {
					show: {
						action: ['modelScopeGenerateImage', 'modelScopeEditImage'],
					},
				},
			},
			{
				displayName: 'Number of Images',
				name: 'numImages',
				type: 'number',
				default: 1,
				typeOptions: {
					minValue: 1,
					maxValue: 4,
				},
				description: 'Number of images to generate (1-4)',
				displayOptions: {
					show: {
						action: ['modelScopeGenerateImage'],
					},
				},
			},
			// ModelScope Edit Image parameters
			{
				displayName: 'Edit Image',
				name: 'editImage',
				type: 'string',
				default: '',
				placeholder: 'https://example.com/image.jpg or data:image/jpeg;base64,...',
				description: 'URL or base64 of image to edit',
				displayOptions: {
					show: {
						action: ['modelScopeEditImage'],
					},
				},
			},
			// Options
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						type: 'number',
						typeOptions: {
							minValue: CONSTANTS.RETRY.MIN,
							maxValue: CONSTANTS.RETRY.MAX,
						},
						default: CONSTANTS.DEFAULTS.MAX_RETRIES,
						description: 'Maximum number of retry attempts for failed requests',
					},
					{
						displayName: 'Timeout (ms)',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: CONSTANTS.TIMEOUT.MIN_MS,
							maxValue: CONSTANTS.TIMEOUT.MAX_MS,
						},
						default: CONSTANTS.DEFAULTS.TIMEOUT_MS,
						description: 'Request timeout in milliseconds',
					},
					{
						displayName: 'Enable Caching',
						name: 'enableCache',
						type: 'boolean',
						default: true,
						description: 'Enable result caching to reduce API calls',
					},
					{
						displayName: 'Cache TTL (seconds)',
						name: 'cacheTtl',
						type: 'number',
						typeOptions: {
							minValue: CONSTANTS.CACHE.MIN_TTL_SECONDS,
							maxValue: CONSTANTS.CACHE.MAX_TTL_SECONDS,
						},
						default: CONSTANTS.DEFAULTS.CACHE_TTL_SECONDS,
						description: 'Cache time-to-live in seconds',
						displayOptions: {
							show: {
								enableCache: [true],
							},
						},
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		const actionRegistry = ActionRegistry.getInstance();
		const registeredActions = actionRegistry.getActionNames();

		if (registeredActions.length === 0) {
			for (let i = 0; i < items.length; i++) {
				results.push({
					json: {
						success: false,
						error: 'No actions are currently registered.',
						errorCode: 'NO_ACTIONS_REGISTERED',
						_metadata: {
							timestamp: new Date().toISOString(),
						},
					},
				});
			}
			return [this.helpers.constructExecutionMetaData(results, { itemData: { item: 0 } })];
		}

		const enableCache = this.getNodeParameter('options.enableCache', CONSTANTS.INDICES.FIRST_ITEM) as boolean;
		const cacheManager = new CacheManager();
		const performanceMonitor = new PerformanceMonitor();

		for (let i = 0; i < items.length; i++) {
			try {
				const action = this.getNodeParameter('action', i) as ActionType;
				const handler = actionRegistry.getHandler(action);

				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unknown action: ${action}. Available actions: ${registeredActions.join(', ')}`,
						{ itemIndex: i }
					);
				}

				let credentials;
				if (handler.requiresCredential) {
					const credentialType = handler.credentialType;
					credentials = await this.getCredentials(credentialType);

					if (!credentials) {
						throw new NodeOperationError(
							this.getNode(),
							`Credentials required for action: ${action}`,
							{ itemIndex: i }
						);
					}
				}

				const timerId = performanceMonitor.startTimer(action);
				let result: INodeExecutionData;

				if (enableCache) {
					const prompt = this.getNodeParameter('prompt', i) as string || '';
					const model = this.getNodeParameter('model', i) as string || '';
					const editImage = this.getNodeParameter('editImage', i) as string || '';
					const promptHash = AIMediaGen.hashString(prompt + editImage);
					const cacheKey = `${action}:${model}:${promptHash}`;
					const cached = await cacheManager.get(cacheKey);

					if (cached) {
						this.logger?.info('Cache hit', { action, cacheKey });
						result = {
							json: {
								success: true,
								...cached as Record<string, unknown>,
								_metadata: {
									action,
									cached: true,
									timestamp: new Date().toISOString(),
								},
							},
						};
					} else {
						this.logger?.info('Cache miss', { action, cacheKey });
						result = await handler.execute(this, i, credentials);

						if (result.json.success) {
							await cacheManager.set(cacheKey, result.json, this.getNodeParameter('options.cacheTtl', i) as number);
						}
					}
				} else {
					result = await handler.execute(this, i, credentials);
				}

				const elapsed = performanceMonitor.endTimer(timerId);

				performanceMonitor.recordMetric({
					timestamp: Date.now().toString(),
					provider: action,
					model: this.getNodeParameter('model', i) as string || 'unknown',
					mediaType: handler.mediaType,
					duration: elapsed,
					success: result.json.success as boolean,
					fromCache: (result.json._metadata as ResultMetadata)?.cached || false,
				});

				this.logger?.info('Action executed', {
					action,
					duration: elapsed,
					success: result.json.success,
				});

				results.push(result);
			} catch (error) {
				this.logger?.error('Action failed', {
					action: this.getNodeParameter('action', i),
					error: error instanceof Error ? error.message : String(error),
				});

				results.push({
					json: {
						success: false,
						error: error instanceof Error ? error.message : String(error),
						errorCode: 'UNKNOWN',
						_metadata: {
							timestamp: new Date().toISOString(),
						},
					},
				});

				if (this.continueOnFail()) {
					continue;
				}
				throw error;
			}
		}

		return [this.helpers.constructExecutionMetaData(results, { itemData: { item: 0 } })];
	}

	private static hashString(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(36);
	}
}
