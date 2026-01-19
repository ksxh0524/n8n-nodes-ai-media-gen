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
					name: 'OpenAI Compatible',
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
	],
};
