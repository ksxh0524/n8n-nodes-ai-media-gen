/**
 * Action Registry for n8n-nodes-ai-media-gen
 * Manages registration and retrieval of action handlers
 */

import { type IActionHandler, type ActionType } from './actionHandler';
import { SoraActionHandler } from '../actions/soraActionHandler';
import { NanoBananaActionHandler } from '../actions/nanoBananaActionHandler';
import { ModelScopeActionHandler } from '../actions/modelScopeActionHandler';
import { MediaProcessingActionHandler } from '../actions/mediaProcessingActionHandler';

/**
 * Action Registry class
 */
export class ActionRegistry {
	private static instance: ActionRegistry;
	private handlers: Map<ActionType, IActionHandler>;

	private constructor() {
		this.handlers = new Map();
		this.registerDefaultHandlers();
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(): ActionRegistry {
		if (!ActionRegistry.instance) {
			ActionRegistry.instance = new ActionRegistry();
		}
		return ActionRegistry.instance;
	}

	/**
	 * Register default action handlers
	 */
	private registerDefaultHandlers(): void {
		this.registerHandler(new SoraActionHandler());
		this.registerHandler(new NanoBananaActionHandler());
		this.registerHandler(new ModelScopeActionHandler());
		this.registerHandler(new MediaProcessingActionHandler());
	}

	/**
	 * Register an action handler
	 */
	registerHandler(handler: IActionHandler): void {
		this.handlers.set(handler.actionName, handler);
	}

	/**
	 * Get action handler by action name
	 */
	getHandler(actionName: ActionType): IActionHandler | undefined {
		return this.handlers.get(actionName);
	}

	/**
	 * Get all registered action handlers
	 */
	getAllHandlers(): IActionHandler[] {
		return Array.from(this.handlers.values());
	}

	/**
	 * Get all action names
	 */
	getActionNames(): ActionType[] {
		return Array.from(this.handlers.keys());
	}

	/**
	 * Check if action is registered
	 */
	hasAction(actionName: ActionType): boolean {
		return this.handlers.has(actionName);
	}

	/**
	 * Get action handler display info
	 */
	getActionDisplayInfo(): Array<{
		name: ActionType;
		displayName: string;
		description: string;
		mediaType: string;
		requiresCredential: boolean;
	}> {
		return Array.from(this.handlers.values()).map(handler => ({
			name: handler.actionName,
			displayName: handler.displayName,
			description: handler.description,
			mediaType: handler.mediaType,
			requiresCredential: handler.requiresCredential,
		}));
	}

	/**
	 * Clear all registered handlers
	 */
	clearHandlers(): void {
		this.handlers.clear();
	}
}
