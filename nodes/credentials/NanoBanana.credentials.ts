import {
	ICredentialType,
	NodeProperties,
	ICredentialDataFunctions,
	INodeProperties,
} from 'n8n-workflow';

export class NanoBananaCredentials implements ICredentialType {
	static getDisplayName(): string {
		return 'Nano Banana';
	}

	static getProperties(): NodeProperties {
		return {
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			required: true,
			default: '',
			description: 'Nano Banana API Key',
		};
	}

	static async getCredentials(
		nodeCredentialData: ICredentialDataFunctions,
	): Promise<{ apiKey: string }> {
		const apiKey = await nodeCredentialData.getNodeCredentials('apiKey');
		return {
			apiKey: apiKey as string,
		};
	}
}
