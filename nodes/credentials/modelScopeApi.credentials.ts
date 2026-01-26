import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class modelScopeApi implements ICredentialType {
	name = 'modelScopeApi';
	displayName = 'ModelScope API';
	documentationUrl = 'https://modelscope.cn/docs';
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
			description: 'ModelScope API key for authentication',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.modelscope.cn/v1',
			required: false,
			placeholder: 'https://api.modelscope.cn/v1',
			description: 'Custom base URL (optional, uses ModelScope default if empty)',
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
				show: {
					enableCache: [true],
				},
			},
		},
	];
}
