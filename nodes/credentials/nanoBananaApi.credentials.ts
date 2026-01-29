import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class nanoBananaApi implements ICredentialType {
	name = 'nanoBananaApi';
	displayName = 'Nano Banana API';
	documentationUrl = 'https://ai.google.dev/gemini-api/docs/image-generation';
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
			description: 'Google Gemini API key or compatible service API key',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://generativelanguage.googleapis.com',
			required: false,
			placeholder: 'https://generativelanguage.googleapis.com',
			description: 'API base URL (defaults to Google official, or use compatible service)',
		},
	];

	/**
	 * Test the credentials by making a simple API call
	 */
	test = {
		request: {
			baseURL: '={{$credentials.baseUrl || "https://generativelanguage.googleapis.com"}}',
			url: '/v1/models',
			method: 'GET' as const,
			headers: {
				Authorization: 'Bearer {{$credentials.apiKey}}',
			},
		},
	};
}
