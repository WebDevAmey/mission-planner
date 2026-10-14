#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/797d2cd086c0759828e87e956f9f06eaae2e677fba19abcd8dbafd267194ecea/contract';
import endContract from '../../snapshots/797d2cd086c0759828e87e956f9f06eaae2e677fba19abcd8dbafd267194ecea/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'AuthAttempt',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('identifier', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('success', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'EmailVerificationToken',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Mission',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('homeAltitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('homeLatitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('homeLongitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'MissionSettings',
        columns: [
          col('altitudeReference', 'text', {
            notNull: true,
            default: lit('relative'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('defaultAltitude', 'float8', {
            notNull: true,
            default: lit(80),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('defaultLoiterTime', 'float8', {
            notNull: true,
            default: lit(30),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('defaultSpeed', 'float8', {
            notNull: true,
            default: lit(12),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('defaultWaitTime', 'float8', {
            notNull: true,
            default: lit(10),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('maxAltM', 'float8', {
            notNull: true,
            default: lit(400),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('maxDistanceM', 'float8', {
            notNull: true,
            default: lit(10000),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('maxSpeedMs', 'float8', {
            notNull: true,
            default: lit(20),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('minAGLClearance', 'float8', {
            notNull: true,
            default: lit(30),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('minAltM', 'float8', {
            notNull: true,
            default: lit(10),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('missionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['missionId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'PasswordResetToken',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('usedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Session',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ipAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'User',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('emailVerified', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Waypoint',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('altitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('command', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('frame', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('latitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('longitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('missionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('param1', 'float8', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('param2', 'float8', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('param3', 'float8', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('param4', 'float8', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('param5', 'float8', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('param6', 'float8', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('param7', 'float8', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('sequence', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('speed', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Waypoint_action_check_79f774a0',
            `"action" IN ('takeoff', 'waypoint', 'loiter', 'loiter_unlim', 'loiter_turns', 'spline_waypoint', 'rtl', 'land', 'wait', 'condition_distance', 'set_speed', 'change_altitude', 'set_roi', 'cam_trigg_dist', 'do_jump')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'EmailVerificationToken',
        constraint: 'EmailVerificationToken_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'PasswordResetToken',
        constraint: 'PasswordResetToken_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Session',
        constraint: 'Session_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Waypoint',
        constraint: 'Waypoint_missionId_sequence_key',
        columns: ['missionId', 'sequence'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuthAttempt',
        index: 'AuthAttempt_identifier_kind_createdAt_idx_2cb00d78',
        columns: ['identifier', 'kind', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EmailVerificationToken',
        index: 'EmailVerificationToken_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Mission',
        index: 'Mission_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PasswordResetToken',
        index: 'PasswordResetToken_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Session',
        index: 'Session_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Waypoint',
        index: 'Waypoint_missionId_idx_25ef2118',
        columns: ['missionId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EmailVerificationToken',
        foreignKey: {
          name: 'EmailVerificationToken_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Mission',
        foreignKey: {
          name: 'Mission_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'MissionSettings',
        foreignKey: {
          name: 'MissionSettings_missionId_fkey',
          columns: ['missionId'],
          references: { schema: 'public', table: 'Mission', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PasswordResetToken',
        foreignKey: {
          name: 'PasswordResetToken_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Session',
        foreignKey: {
          name: 'Session_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Waypoint',
        foreignKey: {
          name: 'Waypoint_missionId_fkey',
          columns: ['missionId'],
          references: { schema: 'public', table: 'Mission', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
