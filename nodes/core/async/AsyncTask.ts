/**
 * Async Task interface and types
 */

import { IGenerationResult } from '../../types/core.types';

/**
 * Async task types
 */
export type AsyncTaskType = 'generation' | 'processing' | 'custom';

/**
 * Async task status
 */
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Async task interface
 */
export interface IAsyncTask {
  id: string;
  type: AsyncTaskType;
  status: TaskStatus;
  progress: number; // 0-100
  result?: IGenerationResult;
  error?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletionTime?: Date;

  // Check if task is finished
  isFinished(): boolean;

  // Check if task is running
  isRunning(): boolean;

  // Update task status
  updateStatus(status: TaskStatus): void;

  // Update progress
  updateProgress(progress: number): void;

  // Set result
  setResult(result: IGenerationResult): void;

  // Set error
  setError(error: string): void;

  // Cancel task
  cancel(): void;
}

/**
 * Base implementation of async task
 */
export class AsyncTask implements IAsyncTask {
  id: string;
  type: AsyncTaskType;
  status: TaskStatus;
  progress: number;
  result?: IGenerationResult;
  error?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletionTime?: Date;
  private cancelled: boolean = false;

  constructor(
    id: string,
    type: AsyncTaskType,
    metadata: Record<string, any> = {}
  ) {
    this.id = id;
    this.type = type;
    this.status = 'pending';
    this.progress = 0;
    this.metadata = metadata;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  isFinished(): boolean {
    return (
      this.status === 'completed' ||
      this.status === 'failed' ||
      this.status === 'cancelled'
    );
  }

  isRunning(): boolean {
    return this.status === 'processing';
  }

  updateStatus(status: TaskStatus): void {
    if (this.cancelled && status !== 'cancelled') {
      return; // Don't update status if task was cancelled
    }

    this.status = status;
    this.updatedAt = new Date();

    if (status === 'processing' && !this.startedAt) {
      this.startedAt = new Date();
    }

    if (
      (status === 'completed' ||
        status === 'failed' ||
        status === 'cancelled') &&
      !this.completedAt
    ) {
      this.completedAt = new Date();
    }
  }

  updateProgress(progress: number): void {
    this.progress = Math.max(0, Math.min(100, progress));
    this.updatedAt = new Date();
  }

  setResult(result: IGenerationResult): void {
    this.result = result;
    this.updateStatus('completed');
    this.progress = 100;
  }

  setError(error: string): void {
    this.error = error;
    this.updateStatus('failed');
  }

  cancel(): void {
    if (!this.isFinished()) {
      this.cancelled = true;
      this.updateStatus('cancelled');
    }
  }

  /**
   * Get task duration in seconds
   */
  getDuration(): number {
    const end = this.completedAt || new Date();
    const start = this.startedAt || this.createdAt;
    return (end.getTime() - start.getTime()) / 1000;
  }

  /**
   * Get estimated time remaining (in seconds)
   */
  getEstimatedTimeRemaining(): number | undefined {
    if (!this.estimatedCompletionTime) {
      return undefined;
    }

    const now = new Date();
    const remaining = this.estimatedCompletionTime.getTime() - now.getTime();
    return Math.max(0, remaining / 1000);
  }

  /**
   * Calculate estimated completion time based on progress
   */
  calculateEstimatedCompletion(): void {
    if (this.progress <= 0 || !this.startedAt) {
      return;
    }

    const elapsed = (new Date().getTime() - this.startedAt.getTime()) / 1000;
    const estimatedTotal = (elapsed / this.progress) * 100;
    const remaining = estimatedTotal - elapsed;

    this.estimatedCompletionTime = new Date(Date.now() + remaining * 1000);
  }

  /**
   * Serialize task to JSON
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      progress: this.progress,
      result: this.result,
      error: this.error,
      metadata: this.metadata,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      startedAt: this.startedAt?.toISOString(),
      completedAt: this.completedAt?.toISOString(),
      estimatedCompletionTime: this.estimatedCompletionTime?.toISOString(),
      duration: this.getDuration(),
      estimatedTimeRemaining: this.getEstimatedTimeRemaining(),
    };
  }
}
