import { z } from 'zod';
export const updateUserProfileSchema=z.object({displayName:z.string().trim().min(1).max(80).optional(),bio:z.string().trim().max(500).nullable().optional(),city:z.string().trim().max(120).nullable().optional(),phone:z.string().trim().max(40).nullable().optional(),avatarUrl:z.string().url().nullable().optional()});
export const updateUserPreferencesSchema=z.object({theme:z.enum(['system','light','dark']).optional(),locale:z.string().trim().min(2).max(16).optional(),marketingEmails:z.boolean().optional(),safetyAlerts:z.boolean().optional(),marketplaceMessages:z.boolean().optional()});
export type UpdateUserProfileInput=z.infer<typeof updateUserProfileSchema>;export type UpdateUserPreferencesInput=z.infer<typeof updateUserPreferencesSchema>;
