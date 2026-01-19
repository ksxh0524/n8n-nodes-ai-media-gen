/**
 * Async Task Manager
 * Manages asynchronous task execution and polling
 */

import { IAsyncTask, AsyncTask, AsyncTaskType, TaskStatus } from './AsyncTask';
import { PollingStrategy, IPollingResult } from './PollingStrategy';
import { IGenerationResult } from '../../types/core.types';
import { MediaGenError } from '../../errors/MediaGenError';

/**
 * Task execution function
 */
export type TaskExecutionFunction = (
  task: IAsyncTask
) => Promise<IGenerationResult>;

/**
 * Task manager options
 */
export interface ITaskManagerOptions {
  maxConcurrentTasks?: number;
  defaultPollingConfig?: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  };
}

/**
 * Async Task Manager
 */
export class AsyncTaskManager {
  private static instance: AsyncTaskManager;
  private tasks: Map<string, IAsyncTask> = new Map();
  private maxConcurrentTasks: number = 10;
  private runningTasks: Set<string> = new Set();
  private defaultPollingConfig: Required<ITaskManagerOptions>['defaultPollingConfig'];

  private constructor(options?: ITaskManagerOptions) {
    if (options?.maxConcurrentTasks !== undefined) {
      this.maxConcurrentTasks = options.maxConcurrentTasks;
    }

    this.defaultPollingConfig = {
      maxAttempts: options?.defaultPollingConfig?.maxAttempts || 60,
      initialDelayMs: options?.defaultPollingConfig?.initialDelayMs || 1000,
      maxDelayMs: options?.defaultPollingConfig?.maxDelayMs || 30000,
    };

    // Start cleanup interval (remove old completed tasks every hour)
    setInterval(() => this.cleanupOldTasks(), 60 * 60 * 1000);
  }

  /**
   * Get singleton instance
   */
  static getInstance(options?: ITaskManagerOptions): AsyncTaskManager {
    if (!AsyncTaskManager.instance) {
      AsyncTaskManager.instance = new AsyncTaskManager(options);
    }
    return AsyncTaskManager.instance;
  }

  /**
   * Create a new task
   */
  createTask(
    type: AsyncTaskType,
    metadata: Record<string, any> = {}
  ): IAsyncTask {
    const taskId = this.generateTaskId();
    const task = new AsyncTask(taskId, type, metadata);
    this.tasks.set(taskId, task);
    return task;
  }

  /**
   * Submit and execute a task
   */
  async submitTask(
    executionFn: TaskExecutionFunction,
    type: AsyncTaskType,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    // Check if we can run more tasks
    if (this.runningTasks.size >= this.maxConcurrentTasks) {
      throw new MediaGenError(
        `Maximum concurrent tasks (${this.maxConcurrentTasks}) reached`,
        'concurrency_limit'
      );
    }

    const task = this.createTask(type, metadata);

    // Execute task asynchronously
    this.executeTask(task, executionFn).catch((error) => {
      console.error(`Task ${task.id} failed:`, error);
    });

    return task.id;
  }

  /**
   * Execute a task
   */
  private async executeTask(
    task: IAsyncTask,
    executionFn: TaskExecutionFunction
  ): Promise<void> {
    this.runningTasks.add(task.id);

    try {
      task.updateStatus('processing');

      const result = await executionFn(task);
      task.setResult(result);
    } catch (error: any) {
      task.setError(error.message || 'Unknown error');
    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): IAsyncTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): TaskStatus | undefined {
    return this.tasks.get(taskId)?.status;
  }

  /**
   * Poll a task until completion
   */
  async pollTask(taskId: string): Promise<IPollingResult<IGenerationResult>> {
    const task = this.tasks.get(taskId);

    if (!task) {
      return {
        success: false,
        attempts: 0,
        totalDuration: 0,
        error: `Task ${taskId} not found`,
      };
    }

    // If task is already finished, return immediately
    if (task.isFinished()) {
      if (task.status === 'completed' && task.result) {
        return {
          success: true,
          data: task.result,
          attempts: 0,
          totalDuration: 0,
        };
      } else {
        return {
          success: false,
          attempts: 0,
          totalDuration: 0,
          error: task.error || `Task ended with status: ${task.status}`,
        };
      }
    }

    // Poll until complete
    const strategy = new PollingStrategy(this.defaultPollingConfig);

    return strategy.poll(
      () => Promise.resolve(this.getTaskStatus(taskId)!),
      (status) =>
        status === 'completed' || status === 'failed' || status === 'cancelled',
      async () => {
        const t = this.tasks.get(taskId)!;
        if (t.status === 'completed' && t.result) {
          return t.result;
        }
        throw new MediaGenError(t.error || 'Task failed', 'task_failed');
      }
    );
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      task.cancel();
      return true;
    }
    return false;
  }

  /**
   * Delete a task
   */
  deleteTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);

    // Only delete finished tasks
    if (task && task.isFinished()) {
      this.tasks.delete(taskId);
      return true;
    }

    return false;
  }

  /**
   * Get all tasks
   */
  getAllTasks(): IAsyncTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): IAsyncTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.status === status);
  }

  /**
   * Get tasks by type
   */
  getTasksByType(type: AsyncTaskType): IAsyncTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.type === type);
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    byStatus: Record<TaskStatus, number>;
    byType: Record<string, number>;
    running: number;
  } {
    const byStatus: Record<TaskStatus, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    const byType: Record<string, number> = {};

    for (const task of this.tasks.values()) {
      byStatus[task.status]++;
      byType[task.type] = (byType[task.type] || 0) + 1;
    }

    return {
      total: this.tasks.size,
      byStatus,
      byType,
      running: this.runningTasks.size,
    };
  }

  /**
   * Clean up old completed tasks
   */
  private cleanupOldTasks(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const [id, task] of this.tasks.entries()) {
      if (
        task.isFinished() &&
        task.completedAt &&
        task.completedAt < oneHourAgo
      ) {
        this.tasks.delete(id);
      }
    }
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.tasks.clear();
    this.runningTasks.clear();
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate UUID-like string
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
