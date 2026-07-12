'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Trash2, Plus, Copy, ChevronDown } from 'lucide-react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import {
  PLANNER_ACTION_OPTIONS,
  PlannerAction,
  FRAME_OPTIONS,
  getMissionCommandDefinition,
  supportsCoordinates,
  supportsSpeed,
  MavlinkFrame,
} from '@/lib/mavlink/commands';
import type { MissionItem } from '@/types/mission';

const cellStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  color: 'var(--color-text)',
  padding: '1px 4px',
  whiteSpace: 'nowrap',
};

const inputCell: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  background: 'transparent',
  border: '1px solid transparent',
  color: 'var(--color-text)',
  width: '100%',
  padding: '1px 3px',
  borderRadius: '2px',
  outline: 'none',
  minWidth: '60px',
};

export function WaypointTable({ height }: { height?: number }) {
  const {
    mission,
    addMissionItem,
    deleteMissionItem,
    bulkDeleteMissionItems,
    duplicateMissionItem,
    reorderMissionItems,
    insertMissionItemAt,
    updateMissionItem,
    setMissionItemAction,
  } = useMissionStore();
  const { selectedMissionItemId, selectMissionItem, addToast } = useUIStore();

  const items = mission?.items ?? [];

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rowCtxMenu, setRowCtxMenu] = useState<{ x: number; y: number; itemId: string; index: number } | null>(null);
  const dragFromRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleAddWaypoint = () => {
    addMissionItem(PlannerAction.WAYPOINT);
    addToast('Waypoint added', 'success');
  };

  const handleDelete = (itemId: string) => {
    deleteMissionItem(itemId);
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
    addToast('Waypoint deleted', 'info');
  };

  const handleDuplicate = (itemId: string) => {
    duplicateMissionItem(itemId);
    addToast('Row duplicated', 'info');
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    bulkDeleteMissionItems([...selectedIds]);
    setSelectedIds(new Set());
    addToast(`Deleted ${selectedIds.size} items`, 'info');
  };

  const toggleSelect = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const handleNumberChange = (
    item: MissionItem,
    field: 'altitude' | 'latitude' | 'longitude',
    value: string
  ) => {
    const numericValue = parseFloat(value);
    if (Number.isNaN(numericValue)) return;
    updateMissionItem(item.id, { [field]: numericValue } as Partial<MissionItem>);
  };

  const handleParamChange = (
    item: MissionItem,
    field: 'param1' | 'param2' | 'param3' | 'param4',
    value: string
  ) => {
    const numericValue = parseFloat(value);
    if (Number.isNaN(numericValue)) return;
    updateMissionItem(item.id, { parameters: { ...item.parameters, [field]: numericValue } });
  };

  const handleSpeedChange = (item: MissionItem, value: string) => {
    const v = parseFloat(value);
    updateMissionItem(item.id, { speed: isNaN(v) ? undefined : v > 0 ? v : undefined });
  };

  const handleFrameChange = (item: MissionItem, value: string) => {
    const frame = parseInt(value) as MavlinkFrame;
    updateMissionItem(item.id, { frame });
  };

  // Drag to reorder
  const handleDragStart = useCallback((index: number) => {
    dragFromRef.current = index;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIdx(index);
  }, []);

  const handleDrop = useCallback((toIndex: number) => {
    const fromIndex = dragFromRef.current;
    if (fromIndex === null || fromIndex === toIndex) {
      setDragOverIdx(null);
      dragFromRef.current = null;
      return;
    }
    reorderMissionItems(fromIndex, toIndex);
    addToast('Row reordered', 'info');
    setDragOverIdx(null);
    dragFromRef.current = null;
  }, [reorderMissionItems, addToast]);

  const handleDragEnd = useCallback(() => {
    setDragOverIdx(null);
    dragFromRef.current = null;
  }, []);

  // Row right-click context menu
  const handleRowContextMenu = useCallback(
    (e: React.MouseEvent, itemId: string, index: number) => {
      e.preventDefault();
      setRowCtxMenu({ x: e.clientX, y: e.clientY, itemId, index });
    },
    []
  );

  const containerHeight = height ?? 224;

  return (
    <div
      style={{
        height: `${containerHeight}px`,
        backgroundColor: 'var(--color-bg-panel)',
        borderTop: '2px solid var(--color-border-mid)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
      onClick={() => setRowCtxMenu(null)}
    >
      {/* Table header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '3px 8px', backgroundColor: '#0d0d0d',
        borderBottom: '1px solid var(--color-border-mid)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
            color: 'var(--color-green)', textTransform: 'uppercase', letterSpacing: '0.6px',
          }}>
            FLIGHT PLAN
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              style={{
                display: 'flex', alignItems: 'center', gap: '3px',
                padding: '1px 6px', backgroundColor: 'var(--color-red-bg)',
                border: '1px solid var(--color-red)', borderRadius: '2px',
                color: 'var(--color-red)', fontFamily: 'var(--font-mono)',
                fontSize: '10px', cursor: 'pointer',
              }}
            >
              <Trash2 size={10} /> Delete {selectedIds.size}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)' }}>
            {items.length} items
          </span>
          <button
            onClick={handleAddWaypoint}
            title="Add waypoint row"
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              padding: '2px 7px', backgroundColor: 'var(--color-green-bg)',
              border: '1px solid var(--color-green)', borderRadius: '2px',
              color: 'var(--color-green)', fontFamily: 'var(--font-mono)',
              fontSize: '10px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={11} /> WP
          </button>
        </div>
      </div>

      {/* Table body */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {items.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono)', fontSize: '11px', gap: '8px',
          }}>
            No mission items — click map or press WP to add
          </div>
        ) : (
          <table className="wp-table">
            <thead>
              <tr>
                <th style={{ width: '24px', textAlign: 'center', padding: '3px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === items.length && items.length > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', accentColor: 'var(--color-green)' }}
                  />
                </th>
                <th style={{ width: '16px' }} title="Drag to reorder" />
                <th style={{ width: '30px', textAlign: 'center' }}>#</th>
                <th style={{ minWidth: '150px' }}>CMD</th>
                <th style={{ minWidth: '52px' }}>FRAME</th>
                <th style={{ minWidth: '92px' }}>LAT</th>
                <th style={{ minWidth: '92px' }}>LNG</th>
                <th style={{ minWidth: '64px' }}>ALT (m)</th>
                <th style={{ minWidth: '58px' }}>SPD</th>
                <th style={{ minWidth: '52px' }}>P1</th>
                <th style={{ minWidth: '44px' }}>P2</th>
                <th style={{ minWidth: '44px' }}>P3</th>
                <th style={{ minWidth: '44px' }}>P4</th>
                <th style={{ width: '52px' }}>ACT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const isSelected = item.id === selectedMissionItemId;
                const isChecked = selectedIds.has(item.id);
                const def = getMissionCommandDefinition(item.action);
                const hasSpatial = supportsCoordinates(item.action);
                const hasSpeedSupport = supportsSpeed(item.action);
                const isDragTarget = dragOverIdx === index;

                return (
                  <tr
                    key={item.id}
                    className={`${isSelected ? 'selected' : ''} ${index % 2 === 1 ? 'row-alt' : ''}`}
                    style={{
                      cursor: 'pointer',
                      outline: isDragTarget ? '1px solid var(--color-green)' : undefined,
                    }}
                    onClick={() => selectMissionItem(item.id)}
                    onContextMenu={(e) => handleRowContextMenu(e, item.id, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                  >
                    {/* Checkbox */}
                    <td style={{ ...cellStyle, textAlign: 'center', padding: '1px 3px' }}
                      onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(item.id)}
                        style={{ cursor: 'pointer', accentColor: 'var(--color-green)' }}
                      />
                    </td>

                    {/* Drag handle */}
                    <td
                      style={{ ...cellStyle, color: 'var(--color-text-muted)', cursor: 'grab', padding: '1px 2px', fontSize: '13px' }}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => e.stopPropagation()}
                      title="Drag to reorder"
                    >
                      ⠿
                    </td>

                    {/* # */}
                    <td style={{ ...cellStyle, textAlign: 'center', color: 'var(--color-text-dim)' }}>
                      {index + 1}
                    </td>

                    {/* Command */}
                    <td style={cellStyle}>
                      <select
                        value={item.action}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          setMissionItemAction(item.id, e.target.value as PlannerAction);
                        }}
                        style={{
                          background: 'transparent', border: '1px solid transparent',
                          color: 'var(--color-amber)', fontFamily: 'var(--font-mono)',
                          fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                          width: '100%', padding: '1px',
                        }}
                      >
                        {PLANNER_ACTION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value} style={{ background: 'var(--color-bg-raised)', color: 'var(--color-text)' }}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Frame */}
                    <td style={cellStyle}>
                      <select
                        value={item.frame}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleFrameChange(item, e.target.value)}
                        style={{
                          background: 'transparent', border: '1px solid transparent',
                          color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)',
                          fontSize: '10px', cursor: 'pointer', width: '100%',
                        }}
                      >
                        {FRAME_OPTIONS.map((fo) => (
                          <option key={fo.value} value={fo.value} style={{ background: 'var(--color-bg-raised)', color: 'var(--color-text)' }}>
                            {fo.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Lat */}
                    <td style={cellStyle}>
                      {hasSpatial ? (
                        <input
                          type="number"
                          defaultValue={item.latitude?.toFixed(7) ?? ''}
                          key={`lat-${item.id}-${item.latitude}`}
                          onBlur={(e) => handleNumberChange(item, 'latitude', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ ...inputCell, color: 'var(--color-cyan)' }}
                          step="0.0000001"
                          onFocus={(e) => { e.target.style.borderColor = 'var(--color-green)'; }}
                          onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
                        />
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Lng */}
                    <td style={cellStyle}>
                      {hasSpatial ? (
                        <input
                          type="number"
                          defaultValue={item.longitude?.toFixed(7) ?? ''}
                          key={`lng-${item.id}-${item.longitude}`}
                          onBlur={(e) => handleNumberChange(item, 'longitude', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ ...inputCell, color: 'var(--color-cyan)' }}
                          step="0.0000001"
                          onFocus={(e) => { e.target.style.borderColor = 'var(--color-green)'; }}
                          onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
                        />
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Alt */}
                    <td style={cellStyle}>
                      {def.supportsAltitude ? (
                        <input
                          type="number"
                          defaultValue={item.altitude?.toFixed(1) ?? ''}
                          key={`alt-${item.id}-${item.altitude}`}
                          onBlur={(e) => handleNumberChange(item, 'altitude', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={inputCell}
                          step="0.1"
                          onFocus={(e) => { e.target.style.borderColor = 'var(--color-green)'; }}
                          onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
                        />
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Speed */}
                    <td style={{ ...cellStyle, color: 'var(--color-text-dim)' }}>
                      {hasSpeedSupport ? (
                        <input
                          type="number"
                          defaultValue={item.speed ?? ''}
                          key={`spd-${item.id}-${item.speed}`}
                          placeholder="—"
                          onBlur={(e) => handleSpeedChange(item, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ ...inputCell, width: '50px' }}
                          step="0.1"
                          min="0"
                          onFocus={(e) => { e.target.style.borderColor = 'var(--color-green)'; }}
                          onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
                        />
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* P1 */}
                    <td style={{ ...cellStyle, color: 'var(--color-text-dim)' }}>
                      <input
                        type="number"
                        defaultValue={item.parameters.param1}
                        key={`p1-${item.id}`}
                        onBlur={(e) => handleParamChange(item, 'param1', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ ...inputCell, width: '48px' }}
                        title={def.paramLabels[0]}
                      />
                    </td>

                    {/* P2 */}
                    <td style={{ ...cellStyle, color: 'var(--color-text-dim)' }}>
                      <input
                        type="number"
                        defaultValue={item.parameters.param2}
                        key={`p2-${item.id}`}
                        onBlur={(e) => handleParamChange(item, 'param2', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ ...inputCell, width: '40px' }}
                        title={def.paramLabels[1]}
                      />
                    </td>

                    {/* P3 */}
                    <td style={{ ...cellStyle, color: 'var(--color-text-dim)' }}>
                      <input
                        type="number"
                        defaultValue={item.parameters.param3}
                        key={`p3-${item.id}`}
                        onBlur={(e) => handleParamChange(item, 'param3', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ ...inputCell, width: '40px' }}
                        title={def.paramLabels[2]}
                      />
                    </td>

                    {/* P4 */}
                    <td style={{ ...cellStyle, color: 'var(--color-text-dim)' }}>
                      <input
                        type="number"
                        defaultValue={item.parameters.param4}
                        key={`p4-${item.id}`}
                        onBlur={(e) => handleParamChange(item, 'param4', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ ...inputCell, width: '40px' }}
                        title={def.paramLabels[3]}
                      />
                    </td>

                    {/* Actions */}
                    <td style={{ ...cellStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDuplicate(item.id); }}
                          title="Duplicate row"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', padding: '2px', borderRadius: '2px' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-cyan)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                        >
                          <Copy size={11} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                          title="Delete item"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', padding: '2px', borderRadius: '2px' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-red)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Row context menu */}
      {rowCtxMenu && (
        <div
          className="context-menu"
          style={{ left: rowCtxMenu.x, top: rowCtxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={() => {
            insertMissionItemAt(PlannerAction.WAYPOINT, rowCtxMenu.index);
            addToast('Row inserted', 'info');
            setRowCtxMenu(null);
          }}>
            <ChevronDown size={12} /> Insert row above
          </div>
          <div className="context-menu-item" onClick={() => {
            handleDuplicate(rowCtxMenu.itemId);
            setRowCtxMenu(null);
          }}>
            <Copy size={12} /> Duplicate row
          </div>
          <div className="context-menu-sep" />
          <div className="context-menu-item danger" onClick={() => {
            handleDelete(rowCtxMenu.itemId);
            setRowCtxMenu(null);
          }}>
            <Trash2 size={12} /> Delete row
          </div>
        </div>
      )}
    </div>
  );
}
