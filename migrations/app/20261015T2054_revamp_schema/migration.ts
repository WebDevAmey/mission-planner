#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/797d2cd086c0759828e87e956f9f06eaae2e677fba19abcd8dbafd267194ecea/contract';
import startContract from '../../snapshots/797d2cd086c0759828e87e956f9f06eaae2e677fba19abcd8dbafd267194ecea/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/99949b9337b98556cf784c06d24138af8dfc080fac930dc4c663577bbf38dba9/contract';
import endContract from '../../snapshots/99949b9337b98556cf784c06d24138af8dfc080fac930dc4c663577bbf38dba9/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Zone',
        columns: [
          col('centerLat', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('centerLng', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('enabled', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('label', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('maxAltM', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('minAltM', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('missionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('radiusM', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('shape', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('vertices', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Zone_kind_check_6eea59b1',
            `"kind" IN ('no_fly', 'keep_in', 'keep_out')`,
          ),
          checkExpression('Zone_shape_check_0f40d968', `"shape" IN ('circle', 'polygon')`),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Mission',
        column: col('bboxMaxLat', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Mission',
        column: col('bboxMaxLng', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Mission',
        column: col('bboxMinLat', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Mission',
        column: col('bboxMinLng', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Mission',
        column: col('distanceM', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Mission',
        column: col('durationS', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Mission',
        column: col('errorCount', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Mission',
        column: col('lastValidatedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Mission',
        column: col('status', 'text', {
          notNull: true,
          default: lit('draft'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Mission',
        column: col('vehicleType', 'text', {
          notNull: true,
          default: lit('multirotor'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Mission',
        column: col('version', 'int4', {
          notNull: true,
          default: lit(1),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Mission',
        column: col('warningCount', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Mission',
        column: col('waypointCount', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'MissionSettings',
        column: col('cruiseSpeed', 'float8', {
          notNull: true,
          default: lit(12),
          codecRef: { codecId: 'pg/float8@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'MissionSettings',
        column: col('homeElevationM', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'MissionSettings',
        column: col('hoverSpeed', 'float8', {
          notNull: true,
          default: lit(5),
          codecRef: { codecId: 'pg/float8@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'MissionSettings',
        column: col('ratedEnduranceS', 'float8', {
          notNull: true,
          default: lit(1200),
          codecRef: { codecId: 'pg/float8@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'MissionSettings',
        column: col('turnaroundM', 'float8', {
          notNull: true,
          default: lit(10),
          codecRef: { codecId: 'pg/float8@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Session',
        column: col('lastSeenAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Mission',
        constraint: 'Mission_status_check_f28e65a1',
        expression: `"status" IN ('draft', 'ready', 'archived')`,
      }),
      this.createIndex({
        schema: 'public',
        table: 'Mission',
        index: 'Mission_userId_updatedAt_idx_42f5280d',
        columns: ['userId', 'updatedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Zone',
        index: 'Zone_missionId_idx_25ef2118',
        columns: ['missionId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Zone',
        foreignKey: {
          name: 'Zone_missionId_fkey',
          columns: ['missionId'],
          references: { schema: 'public', table: 'Mission', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
