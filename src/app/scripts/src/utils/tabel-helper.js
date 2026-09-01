import React from 'react';
import { createColumnHelper, sortingFns } from '@tanstack/react-table';

import { compareItems } from '@tanstack/match-sorter-utils';
import { Box, Typography, Tooltip } from '@mui/material';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import PhoneIphoneOutlinedIcon from '@mui/icons-material/PhoneIphoneOutlined';
import dayjs from 'dayjs';

import { archivedLabel, getFileTypeMeta } from './formatter';
import FlatbedTrailerIcon from '../components/FlatbedTrailerIcon';

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
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
            <Tooltip title={hidden ? 'Hidden from driver' : 'Visible to driver'} arrow>
                {hidden ? (
                    <Box
                        sx={{
                            position: 'relative',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <VisibilityIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                        <CloseIcon
                            sx={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                fontSize: 18,
                                color: '#DC2626',
                                // White halo so the red X reads clearly over the eye lines.
                                filter: 'drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 1.5px #fff)',
                            }}
                        />
                    </Box>
                ) : (
                    <VisibilityIcon sx={{ fontSize: 17, color: '#1B7A3D', flexShrink: 0 }} />
                )}
            </Tooltip>
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
                </Box>
            </Box>
        </Box>
    );
};

// `archived` is positionally aligned with `value`: an entry whose asset Geotab no longer
// lists is greyed and tagged, so a document attached to a retired vehicle still reads as
// that vehicle rather than looking like a live association.
const ListCell = ({ value, archived, icon: Icon, dataKey }) => {
    // Empty -> just a muted dash, no icon.
    if (!Array.isArray(value) || value.length === 0) {
        return <Typography sx={{ color: '#cbd5e1' }}>—</Typography>;
    }
    const isArchived = (i) => Array.isArray(archived) && !!archived[i];
    const withMarker = (v, i) => (isArchived(i) ? `${v} (${archivedLabel(dataKey)})` : String(v));
    const shown = value.slice(0, 5);
    // Cap the cell width so a row with many (or long-named) owners can't stretch its
    // column. The table sits in an auto-layout container, so an uncapped nowrap cell
    // would size the whole column to its widest row, push the table past the viewport,
    // and force a horizontal scrollbar. The full list is always available on hover.
    const inner = (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, maxWidth: 220 }}>
            {Icon ? <Icon sx={{ fontSize: 16, color: '#94a3b8', flexShrink: 0 }} /> : null}
            <Typography
                sx={{
                    fontSize: 14,
                    color: '#334155',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}
            >
                {shown.map((v, i) => (
                    <React.Fragment key={i}>
                        {i > 0 ? ', ' : ''}
                        <Box
                            component="span"
                            sx={isArchived(i) ? { color: '#94a3b8', fontStyle: 'italic' } : undefined}
                        >
                            {withMarker(v, i)}
                        </Box>
                    </React.Fragment>
                ))}
                {value.length > 5 ? '…' : ''}
            </Typography>
        </Box>
    );
    return (
        <Tooltip title={value.map(withMarker).join(', ')} arrow>
            {inner}
        </Tooltip>
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

// What the document is (the fleet's own document type), plus a marker when a driver
// added it from the Drive add-in rather than an admin from here. Both are optional: a
// document uploaded before types existed simply has neither.
const TypeCell = ({ value, uploadedBy, description }) => {
    const label = String(value ?? '').trim();
    const driverLabel = uploadedBy
        ? uploadedBy.driverName || uploadedBy.userName || 'a driver'
        : null;

    if (!label && !driverLabel) {
        return <Typography sx={{ color: '#cbd5e1' }}>—</Typography>;
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5, minWidth: 0 }}>
            {label ? (
                <Tooltip title={description || ''} arrow disableHoverListener={!description}>
                    <Box
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            maxWidth: '100%',
                            px: 0.9,
                            py: '2px',
                            borderRadius: '7px',
                            bgcolor: '#eef2ff',
                            color: '#3730a3',
                            fontSize: 11.5,
                            fontWeight: 700,
                            lineHeight: 1.6,
                        }}
                    >
                        <LabelOutlinedIcon sx={{ fontSize: 13, flexShrink: 0 }} />
                        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {label}
                        </Box>
                    </Box>
                </Tooltip>
            ) : null}
            {driverLabel ? (
                <Tooltip title={`Uploaded from the Drive app by ${driverLabel}`} arrow>
                    <Box
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.4,
                            maxWidth: '100%',
                            color: '#64748b',
                            fontSize: 11,
                            fontWeight: 600,
                        }}
                    >
                        <PhoneIphoneOutlinedIcon sx={{ fontSize: 12, flexShrink: 0 }} />
                        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {driverLabel}
                        </Box>
                    </Box>
                </Tooltip>
            ) : null}
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

// The Type column shows two things — the document type and who uploaded it — so its
// filter has to search both, or filtering by a driver's name finds nothing.
const typeFilter = (row, columnId, filterValue) => {
    const needle = String(filterValue).toLowerCase();
    const uploadedBy = row.original.uploadedBy || {};
    return [row.getValue(columnId), uploadedBy.driverName, uploadedBy.userName, row.original.description]
        .filter((v) => v != null && v !== '')
        .some((v) => String(v).toLowerCase().includes(needle));
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
    columnHelper.accessor('documentType', {
        header: () => 'Type',
        cell: (info) => (
            <TypeCell
                value={info.renderValue()}
                uploadedBy={info.row.original.uploadedBy}
                description={info.row.original.description}
            />
        ),
        // Matches the driver's name too, so "Type: max" finds everything that driver added.
        filterFn: typeFilter,
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
        cell: (info) => (
            <ListCell
                value={info.renderValue()}
                archived={info.row.original.archivedOwners?.vehicles}
                dataKey="vehicles"
                icon={DirectionsCarOutlinedIcon}
            />
        ),
        filterFn: 'fuzzy',
        sortingFn: ownersSort,
    }),
    columnHelper.accessor('owners.drivers', {
        header: () => 'Drivers',
        cell: (info) => (
            <ListCell
                value={info.renderValue()}
                archived={info.row.original.archivedOwners?.drivers}
                dataKey="drivers"
                icon={PersonOutlinedIcon}
            />
        ),
        filterFn: 'fuzzy',
        sortingFn: ownersSort,
    }),
    columnHelper.accessor('owners.trailers', {
        header: () => 'Trailers',
        cell: (info) => (
            <ListCell
                value={info.renderValue()}
                archived={info.row.original.archivedOwners?.trailers}
                dataKey="trailers"
                icon={FlatbedTrailerIcon}
            />
        ),
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
