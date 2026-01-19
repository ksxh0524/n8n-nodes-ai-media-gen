/**
 * Node Registry
 * Registry for n8n node configurations
 */

import { INodeTypeDescription } from 'n8n-workflow';

/**
 * Registry for managing node descriptions
 */
export class NodeRegistry {
  private static instance: NodeRegistry;
  private nodes: Map<string, INodeTypeDescription> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): NodeRegistry {
    if (!NodeRegistry.instance) {
      NodeRegistry.instance = new NodeRegistry();
    }
    return NodeRegistry.instance;
  }

  /**
   * Register a node
   * @param nodeDescription - Node type description
   */
  registerNode(nodeDescription: INodeTypeDescription): void {
    if (this.nodes.has(nodeDescription.name)) {
      console.warn(`Node "${nodeDescription.name}" is already registered, skipping`);
      return;
    }

    this.nodes.set(nodeDescription.name, nodeDescription);
  }

  /**
   * Register multiple nodes
   * @param nodeDescriptions - Array of node type descriptions
   */
  registerNodes(nodeDescriptions: INodeTypeDescription[]): void {
    for (const node of nodeDescriptions) {
      this.registerNode(node);
    }
  }

  /**
   * Unregister a node
   * @param nodeName - Node name
   */
  unregisterNode(nodeName: string): void {
    this.nodes.delete(nodeName);
  }

  /**
   * Get a node by name
   * @param nodeName - Node name
   * @returns Node description or undefined
   */
  getNode(nodeName: string): INodeTypeDescription | undefined {
    return this.nodes.get(nodeName);
  }

  /**
   * Get all registered nodes
   * @returns Array of node descriptions
   */
  getAllNodes(): INodeTypeDescription[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Check if a node exists
   * @param nodeName - Node name
   * @returns True if node exists
   */
  hasNode(nodeName: string): boolean {
    return this.nodes.has(nodeName);
  }

  /**
   * Get all node names
   * @returns Array of node names
   */
  getNodeNames(): string[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Clear all registered nodes
   */
  clear(): void {
    this.nodes.clear();
  }

  /**
   * Get count of registered nodes
   * @returns Number of registered nodes
   */
  get count(): number {
    return this.nodes.size;
  }
}
