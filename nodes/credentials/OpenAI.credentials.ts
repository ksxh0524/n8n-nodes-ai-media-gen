import {
	ICredentialType,
	NodeProperties,
	ICredentialDataFunctions,
	INodeProperties,
} from 'n8n-workflow';

export class OpenAICredentials implements ICredentialType {
	static getDisplayName(): string {
		return 'OpenAI';
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
			description: 'OpenAI API Key (used by Sora and Z-Image nodes)',
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
