import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
} from 'n8n-workflow';

const MODELS = [
	{ name: 'Sora 2', value: 'sora-2' },
	{ name: 'Sors 2 Pro', value: 'sors-2-pro' },
	{ name: 'Veo 3.1', value: 'veo-3.1' },
];

export class Sora implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Sora',
		name: 'sora',
		icon: 'file:ai-media-gen.svg',
		description: 'Generate videos using OpenAI Sora',
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
				options: MODELS,
				default: 'sora-2',
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

				this.logger?.info('Starting video generation', { model, prompt });

				const response = await this.helpers.httpRequest({
					method: 'POST',
					url: 'https://api.openai.com/v1/videos/generations',
					body: {
						model,
						prompt,
						...additionalParams,
					},
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${(await this.getCredentials('openai')).apiKey}`,
					},
				});

				results.push({
					json: response,
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
