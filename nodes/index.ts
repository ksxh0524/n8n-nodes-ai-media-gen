/**
 * n8n-nodes-ai-media-gen
 * Exports the AI Media Generation node
 */

import { AIMediaGen } from './nodes/AIMediaGen';

export const nodeClasses = [
  AIMediaGen,
];

// Register providers
// In production, these would be loaded dynamically
import { ProviderRegistry } from './core/registry/ProviderRegistry';
import { ExampleProvider } from './providers/example/ExampleProvider';
import { OpenAIProvider } from './providers/openai/OpenAIProvider';
import { StabilityProvider } from './providers/stability/StabilityProvider';
import { ElevenLabsProvider } from './providers/elevenlabs/ElevenLabsProvider';

// Register all providers
const registry = ProviderRegistry.getInstance();

// Example provider (for framework validation)
registry.registerProvider(new ExampleProvider());

// OpenAI provider
registry.registerProvider(new OpenAIProvider());

// Stability AI provider
registry.registerProvider(new StabilityProvider());

// ElevenLabs provider
registry.registerProvider(new ElevenLabsProvider());

// Export for external use
export { AIMediaGen };
export * from './types';
export * from './core/interfaces';
export * from './core/factories';
export * from './core/registry';
export * from './errors';
