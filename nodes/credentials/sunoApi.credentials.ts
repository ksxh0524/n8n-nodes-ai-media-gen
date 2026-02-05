import type {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class sunoApi implements ICredentialType {
	name = 'sunoApi';
	displayName = 'Suno API';
	documentationUrl = 'https://suno.ai';
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
			description: 'Suno API key for authentication',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.sunoservice.org',
			required: false,
			placeholder: 'https://api.sunoservice.org',
			description:
				'Custom base URL for third-party proxy services (optional)',
		},
	];
}
