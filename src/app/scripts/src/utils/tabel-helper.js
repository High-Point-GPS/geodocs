import React from 'react';
import { createColumnHelper, sortingFns } from '@tanstack/react-table';

import { compareItems } from '@tanstack/match-sorter-utils';
import { Box, Typography, Tooltip } from '@mui/material';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import MobileOffOutlinedIcon from '@mui/icons-material/MobileOffOutlined';
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

// Days from today (local calendar days) to a stored expiry date; negative once past.
export const daysUntil = (value) =>
    dayjs(value).startOf('day').diff(dayjs().startOf('day'), 'day');

// Within this many days a document is called out as expiring soon.
export const SOON_DAYS = 30;

export const expiryState = (value) => {
    if (value === null || value === undefined || value === '') return 'none';
    const days = daysUntil(value);
    if (days < 0) return 'expired';
    if (days <= SOON_DAYS) return 'soon';
    return 'active';
};

// The file's name, its kind, whether drivers can see it in the Drive app (a phone —
// the eye icon is the Preview action, so it is not reused for this), and who added it
// when a driver did.
const FileNameCell = ({ name, hideFromDriver, uploadedBy }) => {
    const meta = getFileTypeMeta(name);
    const hidden = !!hideFromDriver;
    const driverLabel = uploadedBy ? uploadedBy.driverName || uploadedBy.userName || 'a driver' : null;
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
            <Box sx={{ minWidth: 0 }}>
                <Typography
                    sx={{
                        fontWeight: 500,
                        fontSize: 14,
                        color: '#1f2937',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                    }}
                    title={name}
                >
                    {name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: '2px', minWidth: 0 }}>
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
                            flexShrink: 0,
                        }}
                    >
                        {meta.label}
                    </Box>
                    <Tooltip
                        title={hidden ? 'Hidden from drivers in the Drive app' : 'Drivers can see this in the Drive app'}
                        arrow
                    >
                        {hidden ? (
                            <MobileOffOutlinedIcon
                                aria-label="Hidden from drivers"
                                sx={{ fontSize: 15, color: '#DC2626', flexShrink: 0 }}
                            />
                        ) : (
                            <PhoneIphoneOutlinedIcon
                                aria-label="Visible to drivers"
                                sx={{ fontSize: 15, color: '#1B7A3D', flexShrink: 0 }}
                            />
                        )}
                    </Tooltip>
                    {driverLabel ? (
                        <Tooltip title={`Added from the Drive app by ${driverLabel}`} arrow>
                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.4,
                                    minWidth: 0,
                                    px: 0.75,
                                    py: '1px',
                                    borderRadius: '5px',
                                    bgcolor: '#f1f5f9',
                                    color: '#475569',
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                }}
                            >
                                <PersonOutlinedIcon sx={{ fontSize: 12, flexShrink: 0 }} />
                                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    by {driverLabel}
                                </Box>
                            </Box>
                        </Tooltip>
                    ) : null}
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
    // Fills its column and ellipsises inside it — the table uses a fixed layout, so the
    // column's share of the width is the cap. The full list is always available on hover.
    const inner = (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, maxWidth: '100%' }}>
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
        expired: { bg: '#FDECEA', color: '#B91C1C' },
        soon: { bg: '#FEF3E2', color: '#C2630B' },
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

// What the document is, from the fleet's own list. (Who added it — when a driver did —
// is shown under the file name instead, so it is not mistaken for a type.)
const TypeCell = ({ value, description }) => {
    const label = String(value ?? '').trim();
    if (!label) {
        return <Typography sx={{ color: '#cbd5e1' }}>—</Typography>;
    }
    return (
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
    );
};

const ExpiryCell = ({ value }) => {
    if (value === null || value === undefined || value === '') {
        return <Typography sx={{ color: '#cbd5e1' }}>No expiry</Typography>;
    }

    const state = expiryState(value);
    const days = daysUntil(value);
    const label =
        state === 'expired'
            ? 'Expired'
            : state === 'soon'
                ? days === 0
                    ? 'Expires today'
                    : `${days} day${days === 1 ? '' : 's'} left`
                : 'Active';

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
            <Typography sx={{ fontSize: 14, color: '#334155', whiteSpace: 'nowrap' }}>
                {dayjs(value).format('MMM D, YYYY')}
            </Typography>
            <StatusPill label={label} tone={state} />
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

// Expiry values are ISO strings (or legacy date strings); compare as instants so the
// order is chronological whatever the format, with "No expiry" after every date.
const dateSort = (rowA, rowB, columnId) => {
    const t = (v) => {
        const ms = v == null || v === '' ? NaN : dayjs(v).valueOf();
        return Number.isNaN(ms) ? Infinity : ms;
    };
    const a = t(rowA.getValue(columnId));
    const b = t(rowB.getValue(columnId));
    return a === b ? 0 : a < b ? -1 : 1;
};

// Owner columns hold arrays; the default alphanumeric sort stringifies arrays to ''
// (so every row ties). Join to a real string before comparing.
const ownersSort = (rowA, rowB, columnId) => {
    const a = (rowA.getValue(columnId) || []).join(', ').toLowerCase();
    const b = (rowB.getValue(columnId) || []).join(', ').toLowerCase();
    return a < b ? -1 : a > b ? 1 : 0;
};

// The Type filter also searches the document's note, which the type's tooltip shows.
const typeFilter = (row, columnId, filterValue) => {
    const needle = String(filterValue).toLowerCase();
    return [row.getValue(columnId), row.original.description]
        .filter((v) => v != null && v !== '')
        .some((v) => String(v).toLowerCase().includes(needle));
};

// The File column shows who added a driver upload, so its filter matches that name too
// ("File: max" finds everything that driver added).
const fileFilter = (row, columnId, filterValue) => {
    const needle = String(filterValue).toLowerCase();
    const uploadedBy = row.original.uploadedBy || {};
    return [row.getValue(columnId), uploadedBy.driverName, uploadedBy.userName]
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
                uploadedBy={info.row.original.uploadedBy}
            />
        ),
        filterFn: fileFilter,
        sortingFn: fuzzySort,
        // File and Action always show: without them a row can't be told apart or opened.
        enableHiding: false,
    }),
    columnHelper.accessor('documentType', {
        header: () => 'Type',
        cell: (info) => (
            <TypeCell value={info.renderValue()} description={info.row.original.description} />
        ),
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
        sortingFn: dateSort,
    }),
    columnHelper.accessor('action', {
        header: () => 'Action',
        cell: (info) => info.renderValue(),
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
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
    const needle = String(filterValue).toLowerCase();
    const uploadedBy = row.original.uploadedBy || {};
    if ([uploadedBy.driverName, uploadedBy.userName].some((v) => v && String(v).toLowerCase().includes(needle))) {
        return true;
    }
    return row.getAllCells().some((cell) => {
        if (cell.column.id === 'action') return false;
        let cellValue = cell.getValue();
        if (cellValue == null) return false;
        if (cell.column.id === 'expiryDate') return expiryFilter(row, 'expiryDate', filterValue);
        if (Array.isArray(cellValue)) {
            cellValue = cellValue.join(' ');
        }
        return String(cellValue).toLowerCase().includes(String(filterValue).toLowerCase());
    });
};
