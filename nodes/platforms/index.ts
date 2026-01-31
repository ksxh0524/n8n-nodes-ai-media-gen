/**
 * Platform Abstraction Layer
 *
 * Provides unified interfaces for working with different AI media generation platforms.
 */

// Request Builders
export { RequestBuilders } from './requestBuilders';

// Response Parsers
export { ResponseParsers } from './responseParsers';

// Platform Strategies
export {
	ModelScopeStrategy,
	DoubaoStrategy,
	SoraStrategy,
	VeoStrategy,
	NanoBananaStrategy,
	StrategyRegistry,
	initializeStrategies,
} from './strategies';
