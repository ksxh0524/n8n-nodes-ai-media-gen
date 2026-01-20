/**
 * n8n-nodes-ai-media-gen
 * Exports all AI Media Generation nodes
 */

import { NanoBanana } from './NanoBanana.node';
import { Sora } from './Sora.node';
import { ZImage } from './ZImage.node';
import { Qwen } from './Qwen.node';
import { Doubao } from './Doubao.node';

export const nodeClasses = [
	NanoBanana,
	Sora,
	ZImage,
	Qwen,
	Doubao,
];
