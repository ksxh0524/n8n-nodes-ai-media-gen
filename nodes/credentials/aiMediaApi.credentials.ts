export const aiMediaApi = {
	displayName: 'AI Media API',
	name: 'aiMediaApi',
	documentationUrl: '',
	properties: [
		{
			displayName: 'API Format',
			name: 'apiFormat',
			type: 'options',
			options: [
				{
					name: 'OpenAI',
					value: 'openai',
					description: 'OpenAI API format (Authorization: Bearer <key>)',
				},
				{
					name: 'Gemini (Google)',
					value: 'gemini',
					description: 'Google Gemini API format (API key in URL or headers)',
				},
				{
					name: 'Bailian (阿里百炼)',
					value: 'bailian',
					description: 'Alibaba Bailian API format (Authorization: Bearer <key>)',
				},
				{
					name: 'Replicate',
					value: 'replicate',
					description: 'Replicate API format (Authorization: Bearer <key>)',
				},
				{
					name: 'Hugging Face',
					value: 'huggingface',
					description: 'Hugging Face API format (Authorization: Bearer <key>)',
				},
			],
			default: 'openai',
			required: true,
			description: 'Select the API format to use',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'API key for the selected service',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			required: false,
			placeholder: 'https://api.openai.com/v1',
			description: 'Custom base URL (optional, uses provider default if empty)',
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
			default: 3600,
			description: 'Cache time-to-live in seconds (default: 3600 = 1 hour)',
			displayOptions: {
				showWhen: {
					field: 'enableCache',
					value: true,
				},
			},
		},
	],
};
