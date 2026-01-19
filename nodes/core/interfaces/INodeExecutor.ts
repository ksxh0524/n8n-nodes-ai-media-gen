/**
 * Node executor interface
 * Handles execution logic for n8n nodes
 */

import { INodeExecutionData, IExecuteFunctions } from 'n8n-workflow';
import { IGenerationResult } from '../../types/core.types';

/**
 * Context passed to node executor
 */
export interface IExecutionContext {
  node: IExecuteFunctions;
  items: INodeExecutionData[];
  credentials: any;
  parameters: Record<string, any>;
}

/**
 * Node executor interface
 */
export interface INodeExecutor {
  /**
   * Execute the node logic
   * @param context - Execution context
   * @returns Execution results
   */
  execute(context: IExecutionContext): Promise<INodeExecutionData[]>;

  /**
   * Handle batch execution
   * @param context - Execution context
   * @param batchSize - Number of items per batch
   * @returns Execution results
   */
  executeBatch?(context: IExecutionContext, batchSize: number): Promise<INodeExecutionData[]>;

  /**
   * Handle async execution with polling
   * @param context - Execution context
   * @param pollingConfig - Polling configuration
   * @returns Execution results
   */
  executeAsync?(
    context: IExecutionContext,
    pollingConfig?: any
  ): Promise<INodeExecutionData[]>;

  /**
   * Format generation result for n8n output
   * @param result - Generation result
   * @param includeBinary - Whether to include binary data
   * @returns Formatted node execution data
   */
  formatOutput(
    result: IGenerationResult,
    includeBinary?: boolean
  ): INodeExecutionData;

  /**
   * Detect if execution is in tool mode (AI Agent)
   * @param context - Execution context
   * @returns True if in tool mode
   */
  isToolMode?(context: IExecutionContext): boolean;
}
