/**
 * Response Validation Utilities
 *
 * Type-safe runtime validation for API responses and user inputs.
 */

/**
 * Validates that a value is an object (not null, not an array)
 *
 * @param value - The value to validate
 * @param fieldName - The field name for error messages
 * @returns The value as a Record<string, unknown>
 * @throws Error if validation fails
 */
export function validateObject(value: unknown, fieldName: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(`${fieldName} must be an object, received ${typeof value}`);
	}
	return value as Record<string, unknown>;
}

/**
 * Validates that a value is a string
 *
 * @param value - The value to validate
 * @param fieldName - The field name for error messages
 * @returns The value as a string
 * @throws Error if validation fails
 */
export function validateString(value: unknown, fieldName: string): string {
	if (typeof value !== 'string') {
		throw new Error(`${fieldName} must be a string, received ${typeof value}`);
	}
	return value;
}

/**
 * Validates that a value is an array
 *
 * @param value - The value to validate
 * @param fieldName - The field name for error messages
 * @returns The value as an array
 * @throws Error if validation fails
 */
export function validateArray(value: unknown, fieldName: string): unknown[] {
	if (!Array.isArray(value)) {
		throw new Error(`${fieldName} must be an array, received ${typeof value}`);
	}
	return value;
}

/**
 * Validates that a value is a number
 *
 * @param value - The value to validate
 * @param fieldName - The field name for error messages
 * @returns The value as a number
 * @throws Error if validation fails
 */
export function validateNumber(value: unknown, fieldName: string): number {
	if (typeof value !== 'number' || isNaN(value)) {
		throw new Error(`${fieldName} must be a number, received ${typeof value}`);
	}
	return value;
}

/**
 * Validates that a value is a boolean
 *
 * @param value - The value to validate
 * @param fieldName - The field name for error messages
 * @returns The value as a boolean
 * @throws Error if validation fails
 */
export function validateBoolean(value: unknown, fieldName: string): boolean {
	if (typeof value !== 'boolean') {
		throw new Error(`${fieldName} must be a boolean, received ${typeof value}`);
	}
	return value;
}

/**
 * Validates that a required field exists
 *
 * @param value - The value to validate
 * @param fieldName - The field name for error messages
 * @throws Error if value is null or undefined
 */
export function validateRequired(value: unknown, fieldName: string): void {
	if (value === null || value === undefined) {
		throw new Error(`${fieldName} is required`);
	}
}

/**
 * Safely gets a nested property from an object
 *
 * @param obj - The object to traverse
 * @param path - Dot-separated path (e.g., 'data.user.name')
 * @returns The value at the path, or undefined if not found
 */
export function safeGet(obj: Record<string, unknown>, path: string): unknown {
	return path.split('.').reduce((current: unknown, key) => {
		if (current && typeof current === 'object' && key in current) {
			return (current as Record<string, unknown>)[key];
		}
		return undefined;
	}, obj);
}
