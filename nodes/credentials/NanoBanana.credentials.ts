export const nanoBanana = {
	displayName: 'Nano Banana',
	name: 'apiKey',
	type: 'string',
	typeOptions: {
		password: true,
	},
	required: true,
	default: '',
	description: 'Nano Banana API Key',
};

export const openai = {
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
