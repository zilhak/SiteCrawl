/**
 * Pipeline DAG 커스텀 노드 컴포넌트
 */

import { useState } from 'react'
import { Handle, Position } from 'reactflow'
import { Box, Paper, Typography, IconButton, Stack, Chip } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import type { TaskCategory } from '../../types'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../constants/taskIO'

export interface TaskNodeData {
  nodeId: string
  taskName: string
  taskCategory?: TaskCategory
  taskConfig?: Record<string, unknown>
  isRoot?: boolean
  isConfigured: boolean
  isSelected?: boolean
  onAddChild: (nodeId: string) => void
  onDelete: (nodeId: string) => void
  onSelect: (nodeId: string) => void
}

export default function TaskNode({ data }: { data: TaskNodeData }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        if (!data.isRoot) {
          data.onSelect(data.nodeId)
        }
      }}
      sx={{ position: 'relative', cursor: data.isRoot ? 'default' : 'pointer' }}
    >
      {/* Handle: 존재하지만 보이지 않음 */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: 'none' }}
      />

      <Paper
        elevation={data.isSelected ? 6 : isHovered ? 4 : 1}
        sx={{
          px: 1.5,
          py: 0.75,
          width: 140,
          textAlign: 'center',
          bgcolor: data.isRoot
            ? 'primary.main'
            : data.isConfigured
              ? 'background.paper'
              : 'background.default',
          color: data.isRoot ? 'white' : 'text.primary',
          transition: 'all 0.2s',
          border: data.isSelected
            ? '1.5px solid'
            : data.isConfigured || data.isRoot
              ? '1.5px solid transparent'
              : '1.5px dashed',
          borderColor: data.isSelected
            ? 'primary.light'
            : isHovered
              ? 'primary.main'
              : data.isConfigured || data.isRoot
                ? 'transparent'
                : 'grey.500',
          boxShadow: data.isSelected
            ? (theme: any) => `0 0 0 2px ${theme.palette.primary.main}40`
            : undefined,
        }}
      >
        {data.isRoot ? (
          <Typography sx={{ fontSize: '11px', fontWeight: 700 }}>
            _run_
          </Typography>
        ) : data.isConfigured && data.taskCategory ? (
          <Stack spacing={0.25} alignItems="center">
            <Typography sx={{ fontSize: '11px', fontWeight: 600 }} noWrap>
              {data.taskName}
            </Typography>
            <Chip
              label={CATEGORY_LABELS[data.taskCategory]}
              size="small"
              color={CATEGORY_COLORS[data.taskCategory]}
              sx={{ height: 16, fontSize: '9px', '& .MuiChip-label': { px: 0.75 } }}
            />
          </Stack>
        ) : (
          <Typography sx={{ fontSize: '10px', color: 'text.secondary', fontStyle: 'italic' }}>
            클릭하여 설정
          </Typography>
        )}
      </Paper>

      {/* 하단 + 버튼: 호버 시에만 */}
      {isHovered && (
        <IconButton
          size="small"
          sx={{
            position: 'absolute',
            bottom: -10,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'primary.main',
            color: 'white',
            width: 20,
            height: 20,
            boxShadow: 1,
            '&:hover': { bgcolor: 'primary.dark' },
            zIndex: 1000
          }}
          onClick={(e) => {
            e.stopPropagation()
            data.onAddChild(data.nodeId)
          }}
        >
          <AddIcon sx={{ fontSize: 14 }} />
        </IconButton>
      )}

      {/* 삭제 버튼: 호버 시에만, root 제외 */}
      {!data.isRoot && isHovered && (
        <IconButton
          size="small"
          sx={{
            position: 'absolute',
            top: -8,
            right: -8,
            bgcolor: 'error.main',
            color: 'white',
            width: 18,
            height: 18,
            boxShadow: 1,
            '&:hover': { bgcolor: 'error.dark' },
            zIndex: 1000
          }}
          onClick={(e) => {
            e.stopPropagation()
            data.onDelete(data.nodeId)
          }}
        >
          <DeleteIcon sx={{ fontSize: 12 }} />
        </IconButton>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: 'none' }}
      />
    </Box>
  )
}
