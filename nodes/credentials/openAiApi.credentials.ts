import { ICredentialType, INodeProperties, ICredentialTestRequest } from 'n8n-workflow';

export class openAiApi implements ICredentialType {
	name = 'openAiApi';
	displayName = 'OpenAI API';
	documentationUrl = 'https://platform.openai.com/docs';
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
			description: 'OpenAI API key or third-party service API key for authentication',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.openai.com/v1',
			required: false,
			placeholder: 'https://api.openai.com/v1',
			description: 'Custom base URL for third-party proxy services (optional, uses OpenAI default if empty)',
		},
		{
			displayName: 'Organization ID',
			name: 'organizationId',
			type: 'string',
			default: '',
			required: false,
			description: 'OpenAI Organization ID (optional, only needed for official OpenAI API)',
		},
	];

	/**
	 * Test the credentials by making a simple API call
	 */
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl || "https://api.openai.com/v1"}}',
			url: '/models',
			method: 'GET' as const,
			headers: {
				Authorization: 'Bearer {{$credentials.apiKey}}',
			},
		},
	};
}
