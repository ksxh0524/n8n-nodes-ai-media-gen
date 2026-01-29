import { ICredentialType, INodeProperties, ICredentialTestRequest } from 'n8n-workflow';

export class doubaoApi implements ICredentialType {
	name = 'doubaoApi';
	displayName = 'Doubao API';
	documentationUrl = 'https://www.volcengine.com/docs/82379/1541523?lang=zh';
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
			description: 'Doubao API key for authentication (from Volcengine console)',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://ark.cn-beijing.volces.com/api/v3',
			required: false,
			placeholder: 'https://ark.cn-beijing.volces.com/api/v3',
			description: 'API base URL (optional, uses default if empty)',
		},
	];

	/**
	 * Test the credentials by making a simple API call
	 * Note: This will make a real API call and consume quota
	 */
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl || "https://ark.cn-beijing.volces.com/api/v3"}}',
			url: '/seedream/text2image/v1',
			method: 'POST' as const,
			body: {
				model: 'doubao-seedream-4-5-251128',
				prompt: 'test',
				size: '2048x2048',
				stream: false,
				watermark: false,
			},
			headers: {
				Authorization: 'Bearer {{$credentials.apiKey}}',
				'Content-Type': 'application/json',
			},
		},
	};
}
