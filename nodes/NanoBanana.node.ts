import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
} from 'n8n-workflow';

const MODELS = [
	{ name: 'nano_banana', value: 'nano_banana' },
	{ name: 'Nano Banana Pro', value: 'nano_banana_pro' },
	{ name: 'Z-Image Turbo', value: 'z-image-turbo' },
	{ name: 'Qwen Image', value: 'qwen-image' },
];

export class NanoBanana implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nano Banana',
		name: 'nano_banana',
		icon: 'file:ai-media-gen.svg',
		description: 'Generate images using Nano Banana',
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
				options: MODELS,
				default: 'nano_banana',
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: { rows: 5 },
				required: true,
				default: '',
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
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const model = this.getNodeParameter('model', i) as string;
				const prompt = this.getNodeParameter('prompt', i) as string;
				const additionalParamsJson = this.getNodeParameter('additionalParams', i) as string;

				let additionalParams: Record<string, unknown> = {};
				if (additionalParamsJson) {
					try {
						additionalParams = JSON.parse(additionalParamsJson);
					} catch (error) {
						this.logger?.error('Failed to parse additional params', { error });
					}
				}

				this.logger?.info('Starting generation', { model, prompt });

				const response = await this.helpers.httpRequest({
					method: 'POST',
					url: 'https://api.nanobanana.com/v1/generate',
					body: {
						model,
						prompt,
						...additionalParams,
					},
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${(await this.getCredentials('nanoBanana')).apiKey}`,
					},
				});

				results.push({
					json: response,
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
							provider: 'Nano Banana',
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
