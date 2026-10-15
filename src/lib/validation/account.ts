import { z } from 'zod';
import { passwordSchema } from '@/lib/validation/auth';

export const updateAccountSchema = z.object({
  name: z.string().trim().max(120, 'Name is too long').nullable(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(200),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required').max(200),
});

export const revokeSessionsQuerySchema = z.object({
  id: z.string().uuid().optional(),
  scope: z.enum(['others', 'all']).default('others'),
});
