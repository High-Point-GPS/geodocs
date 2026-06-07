import React from 'react';
import { createColumnHelper, sortingFns } from '@tanstack/react-table';

import { compareItems } from '@tanstack/match-sorter-utils';
import { Box, Typography, Tooltip, Checkbox } from '@mui/material';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import dayjs from 'dayjs';

import { getFileTypeMeta } from './formatter';

const columnHelper = createColumnHelper();

const FileTypeIcon = ({ kind, color, size = 18 }) => {
    const sx = { fontSize: size, color };
    if (kind === 'image') return <ImageOutlinedIcon sx={sx} />;
    if (kind === 'pdf') return <PictureAsPdfOutlinedIcon sx={sx} />;
    if (kind === 'doc') return <DescriptionOutlinedIcon sx={sx} />;
    if (kind === 'sheet') return <GridOnOutlinedIcon sx={sx} />;
    return <InsertDriveFileOutlinedIcon sx={sx} />;
};

const FileNameCell = ({ name, hideFromDriver }) => {
    const meta = getFileTypeMeta(name);
    const hidden = !!hideFromDriver;
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            <Box
                sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '8px',
                    bgcolor: meta.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                <FileTypeIcon kind={meta.kind} color={meta.color} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography
                    sx={{
                        fontWeight: 500,
                        fontSize: 14,
                        color: '#1f2937',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 240,
                    }}
                    title={name}
                >
                    {name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: '2px' }}>
                    <Box
                        sx={{
                            px: 0.75,
                            py: '1px',
                            borderRadius: '5px',
                            bgcolor: meta.bg,
                            color: meta.color,
                            fontSize: 10.5,
                            fontWeight: 700,
                            letterSpacing: '0.03em',
                        }}
                    >
                        {meta.label}
                    </Box>
                    <Tooltip title={hidden ? 'Hidden from driver' : 'Visible to driver'} arrow>
                        {hidden ? (
                            <VisibilityOffIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
                        ) : (
                            <VisibilityIcon sx={{ fontSize: 15, color: '#1B7A3D' }} />
                        )}
                    </Tooltip>
                </Box>
            </Box>
        </Box>
    );
};

const ListCell = ({ value }) => {
    if (!Array.isArray(value) || value.length === 0) {
        return <Typography sx={{ color: '#cbd5e1' }}>—</Typography>;
    }
    const shown = value.slice(0, 5).join(', ');
    const content = `${shown}${value.length > 5 ? '…' : ''}`;
    const text = (
        <Typography sx={{ fontSize: 14, color: '#334155' }}>{content}</Typography>
    );
    return value.length > 5 ? (
        <Tooltip title={value.join(', ')} arrow>
            {text}
        </Tooltip>
    ) : (
        text
    );
};

const StatusPill = ({ label, tone }) => {
    const tones = {
        expired: { bg: '#FEF3E2', color: '#C2630B' },
        active: { bg: '#E7F6EC', color: '#1B7A3D' },
    };
    const t = tones[tone] || tones.active;
    return (
        <Box
            sx={{
                px: 1,
                py: '2px',
                borderRadius: '999px',
                bgcolor: t.bg,
                color: t.color,
                fontSize: 11.5,
                fontWeight: 700,
                lineHeight: 1.6,
                whiteSpace: 'nowrap',
            }}
        >
            {label}
        </Box>
    );
};

const ExpiryCell = ({ value }) => {
    if (value === null || value === undefined || value === '') {
        return <Typography sx={{ color: '#cbd5e1' }}>No expiry</Typography>;
    }

    const hasExpired = dayjs(value) < dayjs();

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{ fontSize: 14, color: '#334155', whiteSpace: 'nowrap' }}>
                {dayjs(value).format('MMMM D, YYYY')}
            </Typography>
            <StatusPill label={hasExpired ? 'Expired' : 'Active'} tone={hasExpired ? 'expired' : 'active'} />
        </Box>
    );
};

const fuzzySort = (rowA, rowB, columnId) => {
    let dir = 0;

    if (rowA.columnFiltersMeta[columnId]) {
        dir = compareItems(
            rowA.columnFiltersMeta[columnId].itemRank,
            rowB.columnFiltersMeta[columnId].itemRank
        );
    }

    return dir === 0 ? sortingFns.alphanumeric(rowA, rowB, columnId) : dir;
};

// Owner columns hold arrays; the default alphanumeric sort stringifies arrays to ''
// (so every row ties). Join to a real string before comparing.
const ownersSort = (rowA, rowB, columnId) => {
    const a = (rowA.getValue(columnId) || []).join(', ').toLowerCase();
    const b = (rowB.getValue(columnId) || []).join(', ').toLowerCase();
    return a < b ? -1 : a > b ? 1 : 0;
};

// Match the expiry filter against the date the user actually sees, with an ISO fallback.
const expiryFilter = (row, columnId, filterValue) => {
    const v = row.getValue(columnId);
    if (v === null || v === undefined || v === '') return false;
    const needle = String(filterValue).toLowerCase();
    return (
        dayjs(v).format('MMMM D, YYYY').toLowerCase().includes(needle) ||
        String(v).toLowerCase().includes(needle)
    );
};

export const columns = [
    columnHelper.display({
        id: 'select',
        size: 44,
        enableSorting: false,
        enableColumnFilter: false,
        header: ({ table }) => (
            <Checkbox
                size="small"
                checked={table.getIsAllPageRowsSelected()}
                indeterminate={table.getIsSomePageRowsSelected()}
                onChange={table.getToggleAllPageRowsSelectedHandler()}
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                size="small"
                checked={row.getIsSelected()}
                onChange={row.getToggleSelectedHandler()}
            />
        ),
    }),
    columnHelper.accessor('fileName', {
        header: () => 'File',
        cell: (info) => (
            <FileNameCell
                name={info.renderValue() || ''}
                hideFromDriver={info.row.original.hideFromDriver}
            />
        ),
        filterFn: 'fuzzy',
        sortingFn: fuzzySort,
    }),
    columnHelper.accessor('owners.groups', {
        header: () => 'Groups',
        cell: (info) => <ListCell value={info.renderValue()} />,
        filterFn: 'fuzzy',
        sortingFn: ownersSort,
    }),
    columnHelper.accessor('owners.vehicles', {
        header: () => 'Vehicles',
        cell: (info) => <ListCell value={info.renderValue()} />,
        filterFn: 'fuzzy',
        sortingFn: ownersSort,
    }),
    columnHelper.accessor('owners.drivers', {
        header: () => 'Drivers',
        cell: (info) => <ListCell value={info.renderValue()} />,
        filterFn: 'fuzzy',
        sortingFn: ownersSort,
    }),
    columnHelper.accessor('owners.trailers', {
        header: () => 'Trailers',
        cell: (info) => <ListCell value={info.renderValue()} />,
        filterFn: 'fuzzy',
        sortingFn: ownersSort,
    }),
    columnHelper.accessor('expiryDate', {
        header: () => 'Expiry Date',
        cell: (info) => <ExpiryCell value={info.renderValue()} />,
        filterFn: expiryFilter,
        sortingFn: fuzzySort,
    }),
    columnHelper.accessor('action', {
        header: () => 'Action',
        cell: (info) => info.renderValue(),
        enableSorting: false,
        enableColumnFilter: false,
    }),
];

export const stringMatchFilter = (row, columnId, filterValue) => {
    let rowValue = row.getValue(columnId);
    if (rowValue == null) return false;
    if (Array.isArray(rowValue)) {
        rowValue = rowValue.join(' ');
    }
    return String(rowValue).toLowerCase().includes(String(filterValue).toLowerCase());
};

export const globalStringFilter = (row, _, filterValue) => {
    return row.getAllCells().some((cell) => {
        if (cell.column.id === 'action') return false;
        let cellValue = cell.getValue();
        if (cellValue == null) return false;
        if (Array.isArray(cellValue)) {
            cellValue = cellValue.join(' ');
        }
        return String(cellValue).toLowerCase().includes(String(filterValue).toLowerCase());
    });
};
