/**
 * Example Provider Credentials
 * Defines the credential schema for the example provider
 */

import { ICredentialType } from 'n8n-workflow';

/**
 * Example Provider Credentials Definition
 * This would be used in n8n's credential system
 */
export const ExampleProviderCredentials: ICredentialType = {
  name: 'exampleApi',
  displayName: 'Example Provider API',
  type: 'http',
  properties: [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
      description: 'Your Example Provider API key',
    },
    {
      displayName: 'Organization ID',
      name: 'organizationId',
      type: 'string',
      default: '',
      required: false,
      description: 'Your organization ID (optional)',
    },
  ],
  // Test credentials by making a request to the API
  test: {
    request: {
      baseURL: 'https://api.example.com/v1',
      url: '/health',
      method: 'GET',
    },
  },
};

// Note: In the actual n8n integration, credentials would be registered
// through the n8n credential system. This is for reference.
