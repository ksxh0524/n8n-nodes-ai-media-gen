import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class NanoBanana implements ICredentialType {
	name = 'nanoBanana';
	displayName = 'Nano Banana';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			required: true,
			default: '',
			description: 'Nano Banana API Key',
		},
	];
}

export class OpenAI implements ICredentialType {
	name = 'openai';
	displayName = 'OpenAI';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			required: true,
			default: '',
			description: 'OpenAI API Key (used by Sora and Z-Image nodes)',
		},
	];
}
