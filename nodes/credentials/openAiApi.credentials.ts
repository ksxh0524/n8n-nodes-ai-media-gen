import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class openAiApi implements ICredentialType {
	name = 'openAiApi';
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
			displayName: 'Organization ID',
			name: 'organizationId',
			type: 'string',
			default: '',
			required: false,
			description: 'OpenAI organization ID (optional)',
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
		{
			displayName: 'Max Retries',
			name: 'maxRetries',
			type: 'number',
			default: 3,
			required: false,
			description: 'Maximum number of retry attempts for failed requests',
		},
		{
			displayName: 'Timeout (seconds)',
			name: 'timeout',
			type: 'number',
			default: 120,
			required: false,
			description: 'Request timeout in seconds',
		},
	];
}
