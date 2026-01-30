import { ICredentialType, INodeProperties, ICredentialTestRequest } from 'n8n-workflow';

export class openaiApi implements ICredentialType {
	name = 'openaiApi';
	displayName = 'OpenAI API';
	documentationUrl = 'https://platform.openai.com/docs/api-reference';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'OpenAI API key for authentication',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.openai.com/v1',
			required: false,
			placeholder: 'https://api.openai.com/v1',
			description: 'Custom base URL (optional, uses OpenAI default if empty)',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl || "https://api.openai.com/v1"}}',
			url: '/models',
			method: 'GET' as const,
			headers: {
				'Authorization': 'Bearer {{$credentials.apiKey}}',
			},
		},
	};
}
