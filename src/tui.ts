/**
 * Zod schemas matching @opencode-ai/sdk TUI types:
 * - TuiShowToastData, TuiAppendPromptData
 */

import { z } from "zod";

export const ToastVariantSchema = z.enum([
	"info",
	"success",
	"warning",
	"error",
]);
export type ToastVariant = z.infer<typeof ToastVariantSchema>;

export const ToastOptionsSchema = z.object({
	message: z.string(),
	variant: ToastVariantSchema.optional().default("info"),
	title: z.string().optional(),
	duration: z.number().positive().optional(),
});
export type ToastOptions = z.infer<typeof ToastOptionsSchema>;

export const AppendPromptOptionsSchema = z.object({
	text: z.string(),
});
export type AppendPromptOptions = z.infer<typeof AppendPromptOptionsSchema>;

export interface TuiClient {
	showToast(options: { body: ToastOptions }): Promise<boolean>;
	appendPrompt(options: { body: AppendPromptOptions }): Promise<boolean>;
}

export function createToastBody(options: ToastOptions): { body: ToastOptions } {
	return { body: ToastOptionsSchema.parse(options) };
}

export function createAppendPromptBody(options: AppendPromptOptions): {
	body: AppendPromptOptions;
} {
	return { body: AppendPromptOptionsSchema.parse(options) };
}
