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
	];
}
