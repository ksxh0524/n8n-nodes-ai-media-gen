import {
	ICredentialType,
	NodeProperties,
	ICredentialDataFunctions,
	INodeProperties,
} from 'n8n-workflow';

export class QwenCredentials implements ICredentialType {
	static getDisplayName(): string {
		return 'Qwen';
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
			description: 'Qwen API Key (used by Qwen and Doubao nodes)',
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
