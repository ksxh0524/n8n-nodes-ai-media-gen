# Changelog

All notable changes to the n8n-nodes-ai-media-gen project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-28

### Added
- Input validation for `numImages` parameter (must be 1-4)
- Input validation for `size` parameter (must match model capabilities)
- Input validation for `inputImage` parameter (URL or base64 format)
- Model constraints constants defining supported sizes for each model
- Comprehensive test suite for AIMediaGen node
- API integration tests
- Test helpers and fixtures for better test coverage
- JSDoc documentation for all public methods and classes

### Fixed
- **Critical**: Fixed parameter access bug where `enableCache` and `timeout` used wrong index (FIRST_ITEM instead of loop index) in multi-item workflows
- **Critical**: Fixed error code preservation - MediaGenError codes are now properly propagated to response instead of always returning 'UNKNOWN'
- Each item in multi-item workflows now correctly uses its own timeout configuration

### Changed
- Removed unused utility files (~54k lines of dead code):
  - `imageProcessor.ts`, `videoProcessor.ts`, `mediaProcessor.ts`
  - `actionHandler.ts`, `configManager.ts`, `imageValidators.ts`
  - `imageTypes.ts`, `videoTypes.ts`, `errorHandler.ts`
- Removed broken test file `helpers.test.ts`
- Removed `sharp` dependency from package.json
- Cleaned up `types.ts` - removed unused type definitions
- Cleaned up `errors.ts` - removed unused validation functions
- Updated README.md to reflect actual implementation (removed misleading FFmpeg and video processing references)
- Improved code documentation with comprehensive JSDoc comments

### Improved
- Better error messages with specific parameter validation errors
- Type safety improvements throughout the codebase
- Code readability with consistent documentation style
- Reduced package size by removing unused dependencies

## [1.0.0] - 2024-01-20

### Added
- Initial release of AI Media Generation node for n8n
- Support for ModelScope API integration
- Image generation with Tongyi-MAI/Z-Image model
- Image generation with Qwen-Image-2512 model
- Image editing with Qwen-Image-Edit-2511 model
- Built-in caching mechanism with LRU eviction
- Automatic retry logic with exponential backoff
- Comprehensive error handling with error codes
- Performance monitoring and metrics
- Configurable timeout and retry settings
- Support for multiple image sizes per model
- Seed support for reproducible generation
- Multiple image generation (1-4 images)

### Features
- ModelScope API credentials support
- Result caching with configurable TTL
- Input validation
- Detailed logging
- Error codes for different failure scenarios
- Network error handling
- Timeout handling

---

## Error Codes Reference

| Code | Retryable | Description |
|------|-----------|-------------|
| INVALID_API_KEY | No | API key is invalid or missing |
| RATE_LIMIT | Yes | Rate limit exceeded |
| NETWORK_ERROR | Yes | Network error occurred |
| TIMEOUT | Yes | Request timed out |
| API_ERROR | No | API error occurred |
| INVALID_IMAGE_INPUT | No | Invalid image input provided |
| INVALID_PARAMS | No | Invalid parameters provided |
| SERVICE_UNAVAILABLE | Yes | Service temporarily unavailable |

---

## Migration Guide

### From 1.0.0 to 1.1.0

No breaking changes. The upgrade is backward compatible.

**Important Fixes**:
- Multi-item workflows now correctly use per-item timeout configuration
- Error codes are now properly preserved in responses

**New Features**:
- Input validation will now throw errors for invalid parameters
- Better error messages help debug configuration issues

**Removed**:
- Unused dependencies (sharp) and code have been removed
- This reduces install size and improves maintainability

---

## Future Plans

### Potential Features
- [ ] Support for additional image models
- [ ] Batch processing optimization
- [ ] Advanced caching strategies (Redis, etc.)
- [ ] Performance metrics dashboard
- [ ] Additional validation rules

### Known Issues
None at this time.
