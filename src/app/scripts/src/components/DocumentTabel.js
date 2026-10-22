import React, { useState, useMemo, useEffect } from 'react';

import Filter from './Filter';

import {
    Autocomplete,
    Box,
    Button,
    Chip,
    TableBody,
    Table,
    TableContainer,
    TableRow,
    TableHead,
    TableCell,
    TextField,
    Typography,
    Paper,
    IconButton,
    InputAdornment,
    MenuItem,
    Select,
    Menu,
    Checkbox,
    Divider,
    Tooltip,
} from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import SearchIcon from '@mui/icons-material/Search';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import FlatbedTrailerIcon from './FlatbedTrailerIcon';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';

import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFacetedMinMaxValues,
    getPaginationRowModel,
    getSortedRowModel,
    flexRender,
} from '@tanstack/react-table';

import { columns, stringMatchFilter, globalStringFilter, expiryState } from '../utils/tabel-helper';
import { collapseCompanyGroup, resolveOwner } from '../utils/formatter';

import { generateCSV } from '../utils/csv-generator';
import { CSVLink } from 'react-csv';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import MobileOffOutlinedIcon from '@mui/icons-material/MobileOffOutlined';
import PhoneIphoneOutlinedIcon from '@mui/icons-material/PhoneIphoneOutlined';

// One-click views over the whole list, each with its live count. They replace the old
// "Show Expired" button: 7 of 15 documents expired was otherwise only discoverable row
// by row. `match` is applied to the table's data before the column filters.
const QUICK_FILTERS = [
    {
        key: 'expired',
        label: 'Expired',
        icon: EventBusyOutlinedIcon,
        tone: { fg: '#B91C1C', bg: '#FDECEA', border: '#f5c2c0' },
        match: (f) => expiryState(f.expiryDate) === 'expired',
    },
    {
        key: 'soon',
        label: 'Expiring in 30 days',
        icon: ScheduleOutlinedIcon,
        tone: { fg: '#C2630B', bg: '#FEF3E2', border: '#f0d6b5' },
        match: (f) => expiryState(f.expiryDate) === 'soon',
    },
    {
        key: 'driver',
        label: 'Added by drivers',
        icon: PhoneIphoneOutlinedIcon,
        tone: { fg: '#26477C', bg: '#eef2ff', border: '#c7d2fe' },
        match: (f) => !!f.uploadedBy,
    },
    {
        key: 'hidden',
        label: 'Hidden from drivers',
        icon: MobileOffOutlinedIcon,
        tone: { fg: '#475569', bg: '#f1f5f9', border: '#e2e8f0' },
        match: (f) => !!f.hideFromDriver,
    },
];

const PAGE_SIZES = [10, 25, 50, 100];

// Resolve a column's header to its plain text label (header defs are functions returning strings).
const getHeaderLabel = (header) => {
    const h = header.column.columnDef.header;
    return typeof h === 'function' ? h(header.getContext()) : h;
};

// Icon shown before each column name in the filter band, keyed by column id.
// Keyed by the column's display label (react-table mangles dotted accessor ids,
// e.g. "owners.groups" -> "owners_groups", so id-based keys miss the owner columns).
const columnIcons = {
    File: ArticleOutlinedIcon,
    Type: LabelOutlinedIcon,
    Groups: GroupsOutlinedIcon,
    Vehicles: DirectionsCarOutlinedIcon,
    Drivers: PersonOutlinedIcon,
    Trailers: FlatbedTrailerIcon,
    'Expiry Date': EventOutlinedIcon,
};

// Proportional column widths for the fixed table layout, keyed by display label —
// they must add up to 100%. Action is sized to fit its three icon buttons; the owner
// columns get the rest, since that is where long names live.
const COLUMN_WIDTHS = {
    File: '19%',
    Type: '12%',
    Groups: '10%',
    Vehicles: '12%',
    Drivers: '13%',
    Trailers: '12%',
    'Expiry Date': '12%',
    Action: '10%',
};

// Which columns the user hid, remembered per browser. MyGeotab pages share one origin, so
// the key is namespaced. Storage can be missing or blocked (private windows), so every
// access is guarded and the table simply shows every column then.
const HIDDEN_COLUMNS_KEY = 'geodocs.table.columnVisibility';
const loadColumnVisibility = () => {
    try {
        const saved = JSON.parse(window.localStorage.getItem(HIDDEN_COLUMNS_KEY) || '{}');
        return saved && typeof saved === 'object' ? saved : {};
    } catch (e) {
        return {};
    }
};
const saveColumnVisibility = (visibility) => {
    try {
        window.localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify(visibility));
    } catch (e) {
        // Not saved; the choice still holds until the page reloads.
    }
};

const buildPages = (current, count) => {
    if (count <= 7) return Array.from({ length: count }, (_, i) => i);
    const pages = [0];
    const left = Math.max(1, current - 1);
    const right = Math.min(count - 2, current + 1);
    if (left > 1) pages.push('left-ellipsis');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < count - 2) pages.push('right-ellipsis');
    pages.push(count - 1);
    return pages;
};

const DocumentTable = ({ files, geotabAssets, globalAlertEmail, onOrderedFilesChange }) => {
    const [columnFilters, setColumnFilters] = useState([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [quickFilter, setQuickFilter] = useState(null);
    // 25 a page: most fleets then see everything without paging.
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
    const [columnVisibility, setColumnVisibility] = useState(loadColumnVisibility);
    const [columnsMenuAnchor, setColumnsMenuAnchor] = useState(null);
    useEffect(() => saveColumnVisibility(columnVisibility), [columnVisibility]);

    // Owner columns carry the display NAMES, so filtering, sorting, suggestions and the
    // CSV export all work on what the user sees. Whether each entry is archived rides
    // alongside in `archivedOwners`, positionally aligned, and is applied by the cell
    // renderer — keeping the marker out of the values that get searched and exported.
    const formatData = (dataIds, priorNames, dataKey) => {
        if (!Array.isArray(dataIds)) return { labels: dataIds || [], archived: [] };
        const resolved = dataIds.map((id, i) =>
            resolveOwner(id, Array.isArray(priorNames) ? priorNames[i] : undefined, geotabAssets, dataKey)
        );
        return {
            labels: resolved.map((r) => r.label),
            archived: resolved.map((r) => r.archived),
            dataKey,
        };
    };

    const displayFiles = useMemo(() => {
        return files.map((file) => {
            const owners = file.owners || {};
            const names = file.ownerNames || {};
            const drivers = formatData(owners.drivers, names.drivers, 'drivers');
            const vehicles = formatData(owners.vehicles, names.vehicles, 'vehicles');
            const trailers = formatData(owners.trailers, names.trailers, 'trailers');
            return {
                ...file,
                owners: {
                    ...owners,
                    drivers: drivers.labels,
                    vehicles: vehicles.labels,
                    trailers: trailers.labels,
                    groups: collapseCompanyGroup(Array.isArray(owners.groups) ? owners.groups : []),
                },
                archivedOwners: {
                    drivers: drivers.archived,
                    vehicles: vehicles.archived,
                    trailers: trailers.archived,
                },
            };
        });
    }, [files, geotabAssets]);

    const quickCounts = useMemo(() => {
        const counts = {};
        QUICK_FILTERS.forEach((q) => {
            counts[q.key] = displayFiles.filter(q.match).length;
        });
        return counts;
    }, [displayFiles]);

    const tableData = useMemo(() => {
        const q = QUICK_FILTERS.find((f) => f.key === quickFilter);
        return q ? displayFiles.filter(q.match) : displayFiles;
    }, [displayFiles, quickFilter]);

    // Distinct values present in the visible rows, keyed by column label — these power
    // the autocomplete suggestions in both the global search box and each column's filter.
    // Keyed by display label (not column id) to match how columns are addressed elsewhere
    // (react-table mangles dotted accessor ids, e.g. "owners.groups" -> "owners_groups").
    const columnSuggestions = useMemo(() => {
        const sets = { File: new Set(), Type: new Set(), Groups: new Set(), Vehicles: new Set(), Drivers: new Set(), Trailers: new Set() };
        const ownerKinds = { groups: 'Groups', vehicles: 'Vehicles', drivers: 'Drivers', trailers: 'Trailers' };
        const add = (set, v) => {
            const label = String(v ?? '').trim();
            if (label) set.add(label);
        };
        tableData.forEach((f) => {
            add(sets.File, f.fileName);
            add(sets.Type, f.documentType);
            // Who added a driver upload shows under the file name, and the File filter
            // matches it (see fileFilter).
            add(sets.File, f.uploadedBy?.driverName || f.uploadedBy?.userName);
            Object.keys(ownerKinds).forEach((k) => {
                const list = Array.isArray(f.owners?.[k]) ? f.owners[k] : [];
                list.forEach((n) => add(sets[ownerKinds[k]], n));
            });
        });
        const sorted = (set) => [...set].sort((a, b) => a.localeCompare(b));
        return { File: sorted(sets.File), Type: sorted(sets.Type), Groups: sorted(sets.Groups), Vehicles: sorted(sets.Vehicles), Drivers: sorted(sets.Drivers), Trailers: sorted(sets.Trailers) };
    }, [tableData]);

    // Global search box options: owner names grouped by kind. Picking one sets the global
    // filter, which matches the owner columns (see globalStringFilter).
    const searchSuggestions = useMemo(
        () =>
            ['Vehicles', 'Drivers', 'Trailers', 'Groups'].flatMap((kind) =>
                (columnSuggestions[kind] || []).map((label) => ({ kind, label }))
            ),
        [columnSuggestions]
    );

    const table = useReactTable({
        data: tableData,
        columns: columns,
        getRowId: (row, i) => (row.id != null ? String(row.id) : String(i)),
        enableRowSelection: true,
        meta: {
            globalEmail: globalAlertEmail || '',
        },
        filterFns: {
            fuzzy: stringMatchFilter,
        },
        state: {
            columnFilters,
            globalFilter,
            pagination,
            columnVisibility,
        },
        onPaginationChange: setPagination,
        onColumnVisibilityChange: setColumnVisibility,
        // A filter that shrinks the list back to page 1 rather than an empty page 3.
        autoResetPageIndex: true,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        globalFilterFn: globalStringFilter,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        getFacetedMinMaxValues: getFacetedMinMaxValues(),
    });

    const headers = table.getHeaderGroups()[0]?.headers || [];
    const rows = table.getRowModel().rows;

    // COLUMN_WIDTHS add up to 100% with every column showing; spread the hidden columns'
    // share over the ones left.
    const visibleWidthTotal = headers.reduce((sum, h) => sum + parseFloat(COLUMN_WIDTHS[getHeaderLabel(h)] || 0), 0) || 100;
    const columnWidth = (label) =>
        COLUMN_WIDTHS[label] ? `${(parseFloat(COLUMN_WIDTHS[label]) / visibleWidthTotal) * 100}%` : 'auto';

    const hideableColumns = table.getAllLeafColumns().filter((c) => c.getCanHide());
    const hiddenCount = hideableColumns.filter((c) => !c.getIsVisible()).length;
    const toggleColumn = (col) => {
        // A hidden column's filter would keep narrowing the list with nothing on screen
        // to show or clear it.
        if (col.getIsVisible()) col.setFilterValue(undefined);
        col.toggleVisibility();
    };
    const columnLabel = (col) => {
        const h = col.columnDef.header;
        return typeof h === 'function' ? h() : h;
    };

    // Active column filters, resolved to their display label, for the toolbar summary chips.
    const activeFilters = columnFilters
        .filter((f) => f.value !== '' && f.value != null)
        .map((f) => {
            const col = table.getColumn(f.id);
            const headerDef = col?.columnDef?.header;
            const label = (typeof headerDef === 'function' ? headerDef() : headerDef) || f.id;
            return { id: f.id, value: String(f.value), label };
        });
    const hasGlobalFilter = String(globalFilter ?? '').length > 0;
    const hasActiveFilters = activeFilters.length > 0 || hasGlobalFilter || !!quickFilter;
    const activeQuick = QUICK_FILTERS.find((q) => q.key === quickFilter);

    const clearAllFilters = () => {
        setColumnFilters([]);
        setGlobalFilter('');
        setQuickFilter(null);
    };

    // Report the filtered + sorted order (across all pages) so the preview's prev/next
    // can walk exactly what the user sees.
    const sortedRows = table.getSortedRowModel().rows;
    const orderedOriginals = useMemo(() => sortedRows.map((r) => r.original), [sortedRows]);
    useEffect(() => {
        if (onOrderedFilesChange) onOrderedFilesChange(orderedOriginals);
    }, [orderedOriginals, onOrderedFilesChange]);

    const { pageIndex, pageSize } = table.getState().pagination;
    const total = table.getFilteredRowModel().rows.length;
    const start = total === 0 ? 0 : pageIndex * pageSize + 1;
    const end = Math.min((pageIndex + 1) * pageSize, total);
    const pageCount = table.getPageCount();

    const headCellSx = {
        borderBottom: '1px solid #eef2f7',
        py: 1.25,
        verticalAlign: 'bottom',
        bgcolor: '#fff',
    };

    return (
        <Box sx={{ px: { xs: 1, md: 2 }, pb: 4 }}>
            <Paper
                elevation={0}
                sx={{
                    width: '100%',
                    border: '1px solid #eef2f7',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(16, 24, 40, 0.06)',
                }}
            >
                {/* Toolbar: global search + export */}
                <Box
                    sx={{
                        display: 'flex',
                        gap: 1.5,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        p: 2,
                        borderBottom: '1px solid #eef2f7',
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.25,
                            flexWrap: 'wrap',
                            flex: 1,
                            minWidth: 0,
                        }}
                    >
                        <Box sx={{ width: '100%', maxWidth: 360 }}>
                            <Autocomplete
                                freeSolo
                                fullWidth
                                size="small"
                                options={searchSuggestions}
                                groupBy={(o) => (typeof o === 'string' ? '' : o.kind)}
                                getOptionLabel={(o) => (typeof o === 'string' ? o : o.label)}
                                isOptionEqualToValue={(o, v) => o.kind === v.kind && o.label === v.label}
                                inputValue={globalFilter ?? ''}
                                onInputChange={(e, value, reason) => {
                                    if (reason === 'input' || reason === 'clear') setGlobalFilter(String(value));
                                }}
                                onChange={(e, value) => {
                                    setGlobalFilter(value == null ? '' : (typeof value === 'string' ? value : value.label));
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        placeholder="Search files, vehicles, drivers, trailers, groups..."
                                        InputProps={{
                                            ...params.InputProps,
                                            startAdornment: (
                                                <>
                                                    <InputAdornment position="start" sx={{ ml: 0.5, mr: 0 }}>
                                                        <SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                                                    </InputAdornment>
                                                    {params.InputProps.startAdornment}
                                                </>
                                            ),
                                            sx: { borderRadius: '10px', bgcolor: '#fff' },
                                        }}
                                        sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e5e7eb' } }}
                                    />
                                )}
                            />
                        </Box>

                        {/* Active-filter summary: shows what's filtered now, each with an X to clear it */}
                        {hasActiveFilters && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                <FilterAltOutlinedIcon sx={{ fontSize: 17, color: '#94a3b8' }} />

                                {hasGlobalFilter && (
                                    <Chip
                                        size="small"
                                        icon={<SearchIcon sx={{ fontSize: 15 }} />}
                                        label={`All columns: ${String(globalFilter)}`}
                                        onDelete={() => setGlobalFilter('')}
                                        sx={{
                                            maxWidth: 240,
                                            bgcolor: '#eef2ff',
                                            color: '#26477C',
                                            fontWeight: 600,
                                            borderRadius: '8px',
                                            '& .MuiChip-icon': { color: '#26477C' },
                                            '& .MuiChip-deleteIcon': {
                                                color: '#26477C',
                                                '&:hover': { color: '#1e3a5f' },
                                            },
                                        }}
                                    />
                                )}

                                {activeFilters.map((f) => {
                                    const Icon = columnIcons[f.label];
                                    return (
                                        <Chip
                                            key={f.id}
                                            size="small"
                                            icon={Icon ? <Icon sx={{ fontSize: 15 }} /> : undefined}
                                            label={`${f.label}: ${f.value}`}
                                            onDelete={() => table.getColumn(f.id)?.setFilterValue('')}
                                            sx={{
                                                maxWidth: 240,
                                                bgcolor: '#eef2ff',
                                                color: '#26477C',
                                                fontWeight: 600,
                                                borderRadius: '8px',
                                                '& .MuiChip-icon': { color: '#26477C' },
                                                '& .MuiChip-deleteIcon': {
                                                    color: '#26477C',
                                                    '&:hover': { color: '#1e3a5f' },
                                                },
                                            }}
                                        />
                                    );
                                })}

                                {activeQuick && (
                                    <Chip
                                        size="small"
                                        icon={<activeQuick.icon sx={{ fontSize: 15 }} />}
                                        label={activeQuick.label}
                                        onDelete={() => setQuickFilter(null)}
                                        sx={{
                                            bgcolor: activeQuick.tone.bg,
                                            color: activeQuick.tone.fg,
                                            fontWeight: 600,
                                            borderRadius: '8px',
                                            '& .MuiChip-icon': { color: activeQuick.tone.fg },
                                            '& .MuiChip-deleteIcon': { color: activeQuick.tone.fg },
                                        }}
                                    />
                                )}

                                <Button
                                    size="small"
                                    onClick={clearAllFilters}
                                    sx={{
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        color: '#64748b',
                                        minWidth: 'auto',
                                        px: 1,
                                        '&:hover': { bgcolor: '#f1f5f9' },
                                    }}
                                >
                                    Clear all
                                </Button>
                            </Box>
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tooltip title="Show or hide columns" arrow>
                        <IconButton
                            aria-label="Show or hide columns"
                            aria-haspopup="true"
                            onClick={(e) => setColumnsMenuAnchor(e.currentTarget)}
                            sx={{
                                border: '1px solid',
                                borderColor: hiddenCount ? '#26477C' : '#e5e7eb',
                                borderRadius: '10px',
                                bgcolor: hiddenCount ? '#eef2ff' : '#fff',
                                color: hiddenCount ? '#26477C' : '#334155',
                                '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' },
                            }}
                        >
                            <SettingsOutlinedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Menu
                        anchorEl={columnsMenuAnchor}
                        open={Boolean(columnsMenuAnchor)}
                        onClose={() => setColumnsMenuAnchor(null)}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                        PaperProps={{ sx: { borderRadius: '12px', minWidth: 220, mt: 0.75 } }}
                    >
                        <Typography sx={{ px: 2, pt: 1, pb: 0.75, fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            Columns
                        </Typography>
                        {hideableColumns.map((col) => {
                            const label = columnLabel(col);
                            const Icon = columnIcons[label];
                            return (
                                <MenuItem key={col.id} onClick={() => toggleColumn(col)} sx={{ py: 0.25, pl: 1, gap: 0.75 }}>
                                    <Checkbox size="small" checked={col.getIsVisible()} tabIndex={-1} disableRipple />
                                    {Icon ? <Icon sx={{ fontSize: 17, color: '#64748b' }} /> : null}
                                    <Typography sx={{ fontSize: 14, color: '#1f2937' }}>{label}</Typography>
                                </MenuItem>
                            );
                        })}
                        <Divider sx={{ my: 0.5 }} />
                        <MenuItem
                            disabled={!hiddenCount}
                            onClick={() => table.toggleAllColumnsVisible(true)}
                            sx={{ fontSize: 13.5, fontWeight: 600, color: '#26477C', justifyContent: 'center' }}
                        >
                            Show all columns
                        </MenuItem>
                    </Menu>
                    <CSVLink data={generateCSV(displayFiles)} filename={'geodoc.csv'} style={{ textDecoration: 'none' }}>
                        <Button
                            component="span"
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                borderRadius: '10px',
                                borderColor: '#e5e7eb',
                                color: '#334155',
                                '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' },
                            }}
                        >
                            Export CSV
                        </Button>
                    </CSVLink>
                    </Box>
                </Box>

                {/* At-a-glance counts, each a one-click view. Hidden while a count is 0. */}
                {QUICK_FILTERS.some((q) => quickCounts[q.key] > 0) && (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 1,
                            px: 2,
                            py: 1.25,
                            borderBottom: '1px solid #eef2f7',
                            bgcolor: '#fbfcfe',
                        }}
                    >
                        <Typography sx={{ fontSize: 12.5, color: '#64748b', fontWeight: 600, mr: 0.5 }}>
                            {displayFiles.length} document{displayFiles.length === 1 ? '' : 's'}
                        </Typography>
                        {QUICK_FILTERS.filter((q) => quickCounts[q.key] > 0).map((q) => {
                            const active = quickFilter === q.key;
                            const Icon = q.icon;
                            return (
                                <Box
                                    key={q.key}
                                    component="button"
                                    type="button"
                                    onClick={() => setQuickFilter(active ? null : q.key)}
                                    aria-pressed={active}
                                    sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 0.6,
                                        px: 1.25,
                                        py: 0.5,
                                        borderRadius: '999px',
                                        border: '1px solid',
                                        borderColor: active ? q.tone.fg : q.tone.border,
                                        bgcolor: active ? q.tone.fg : q.tone.bg,
                                        color: active ? '#fff' : q.tone.fg,
                                        fontFamily: 'inherit',
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        '&:hover': { borderColor: q.tone.fg },
                                    }}
                                >
                                    <Icon sx={{ fontSize: 15 }} />
                                    {quickCounts[q.key]} {q.label.toLowerCase()}
                                </Box>
                            );
                        })}
                    </Box>
                )}

                <TableContainer sx={{ width: '100%' }}>
                    <Table sx={{ tableLayout: 'fixed', width: '100%' }}>
                        <TableHead>
                            {/* Single header band: sortable column name + icon above each search box */}
                            <TableRow sx={{ bgcolor: '#fbfcfe' }}>
                                {headers.map((header) => {
                                    const col = header.column;
                                    const label = getHeaderLabel(header);
                                    const Icon = columnIcons[label];
                                    const sorted = col.getIsSorted();
                                    const canSort = col.getCanSort();
                                    const canFilter = col.getCanFilter();
                                    return (
                                        <TableCell
                                            key={header.id}
                                            sx={{ ...headCellSx, width: columnWidth(label) }}
                                        >
                                            <Box
                                                onClick={canSort ? col.getToggleSortingHandler() : undefined}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 0.625,
                                                    mb: canFilter ? 0.75 : 0,
                                                    cursor: canSort ? 'pointer' : 'default',
                                                    userSelect: 'none',
                                                }}
                                            >
                                                {Icon ? (
                                                    <Icon sx={{ fontSize: 16, color: '#64748b' }} />
                                                ) : null}
                                                <Typography
                                                    sx={{ fontWeight: 700, fontSize: 12.5, color: '#334155' }}
                                                >
                                                    {label}
                                                </Typography>
                                                {canSort &&
                                                    (sorted === 'asc' ? (
                                                        <ArrowUpwardIcon sx={{ fontSize: 15, color: '#475569' }} />
                                                    ) : sorted === 'desc' ? (
                                                        <ArrowDownwardIcon sx={{ fontSize: 15, color: '#475569' }} />
                                                    ) : (
                                                        <UnfoldMoreIcon sx={{ fontSize: 15, color: '#cbd5e1' }} />
                                                    ))}
                                            </Box>
                                            {canFilter ? <Filter column={col} name={label} suggestions={columnSuggestions[label]} /> : null}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={headers.length} sx={{ borderBottom: 'none', py: 6 }}>
                                        <Box sx={{ textAlign: 'center', color: '#94a3b8' }}>
                                            <Typography sx={{ fontWeight: 600 }}>No documents found</Typography>
                                            <Typography variant="body2">Try adjusting your search or filters.</Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        selected={row.getIsSelected()}
                                        hover
                                        sx={{
                                            '&.Mui-selected': { backgroundColor: 'rgba(38, 71, 124, 0.06)' },
                                            '&.Mui-selected:hover': { backgroundColor: 'rgba(38, 71, 124, 0.1)' },
                                        }}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell
                                                key={cell.id}
                                                sx={{ borderBottom: '1px solid #f1f5f9', py: 1.25 }}
                                            >
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                {/* Footer: results count + pagination */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 1.5,
                        px: 2.5,
                        py: 2,
                        borderTop: '1px solid #eef2f7',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontSize: 13.5, color: '#64748b' }}>
                            Showing {start} to {end} of {total} results
                        </Typography>
                        {total > PAGE_SIZES[0] && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Typography sx={{ fontSize: 13, color: '#94a3b8' }}>Per page</Typography>
                                <Select
                                    size="small"
                                    value={pageSize}
                                    onChange={(e) => table.setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })}
                                    sx={{ fontSize: 13, borderRadius: '8px', '& .MuiSelect-select': { py: 0.5, pl: 1.25 } }}
                                    inputProps={{ 'aria-label': 'Documents per page' }}
                                >
                                    {PAGE_SIZES.map((n) => (
                                        <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>
                                            {n}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </Box>
                        )}
                    </Box>

                    {pageCount > 1 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <IconButton
                                size="small"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                                sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}
                            >
                                <ChevronLeftIcon fontSize="small" />
                            </IconButton>

                            {buildPages(pageIndex, pageCount).map((p, idx) =>
                                typeof p === 'string' ? (
                                    <Typography key={p + idx} sx={{ px: 0.5, color: '#94a3b8' }}>
                                        …
                                    </Typography>
                                ) : (
                                    <Box
                                        key={p}
                                        onClick={() => table.setPageIndex(p)}
                                        sx={{
                                            minWidth: 32,
                                            height: 32,
                                            px: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: 13.5,
                                            fontWeight: 600,
                                            border: '1px solid',
                                            borderColor: p === pageIndex ? '#26477C' : '#e5e7eb',
                                            bgcolor: p === pageIndex ? '#26477C' : '#fff',
                                            color: p === pageIndex ? '#fff' : '#475569',
                                            '&:hover': { bgcolor: p === pageIndex ? '#26477C' : '#f8fafc' },
                                        }}
                                    >
                                        {p + 1}
                                    </Box>
                                )
                            )}

                            <IconButton
                                size="small"
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                                sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}
                            >
                                <ChevronRightIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    )}
                </Box>
            </Paper>
        </Box>
    );
};

export default DocumentTable;
