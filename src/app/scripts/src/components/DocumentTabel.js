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
} from '@mui/material';

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

import { columns, stringMatchFilter, globalStringFilter } from '../utils/tabel-helper';
import { collapseCompanyGroup } from '../utils/formatter';

import { generateCSV } from '../utils/csv-generator';
import { CSVLink } from 'react-csv';
import dayjs from 'dayjs';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';

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
    Groups: GroupsOutlinedIcon,
    Vehicles: DirectionsCarOutlinedIcon,
    Drivers: PersonOutlinedIcon,
    Trailers: FlatbedTrailerIcon,
    'Expiry Date': EventOutlinedIcon,
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

const DocumentTable = ({ files, geotabData, globalAlertEmail, onOrderedFilesChange }) => {
    const [columnFilters, setColumnFilters] = useState([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [showExpiredOnly, setShowExpiredOnly] = useState(false);

    const formatData = (dataIds, dataKey) => {
        if (!Array.isArray(dataIds) || !geotabData || !geotabData[dataKey]) return dataIds || [];
        return dataIds.map((id) => {
            const d = geotabData[dataKey].find((x) => x.value === id);
            return d ? d.label : id;
        });
    };

    const displayFiles = useMemo(() => {
        return files.map((file) => {
            const owners = file.owners || {};
            return {
                ...file,
                owners: {
                    ...owners,
                    drivers: Array.isArray(owners.drivers) ? formatData(owners.drivers, 'drivers') : owners.drivers || [],
                    vehicles: Array.isArray(owners.vehicles) ? formatData(owners.vehicles, 'vehicles') : owners.vehicles || [],
                    trailers: Array.isArray(owners.trailers) ? formatData(owners.trailers, 'trailers') : owners.trailers || [],
                    groups: collapseCompanyGroup(Array.isArray(owners.groups) ? owners.groups : []),
                },
            };
        });
    }, [files, geotabData]);

    // "Show Expired" filter: narrow to documents whose expiry date is in the past.
    const tableData = useMemo(() => {
        if (!showExpiredOnly) return displayFiles;
        const now = dayjs();
        return displayFiles.filter((f) => f.expiryDate && dayjs(f.expiryDate) < now);
    }, [displayFiles, showExpiredOnly]);

    // Distinct values present in the visible rows, keyed by column label — these power
    // the autocomplete suggestions in both the global search box and each column's filter.
    // Keyed by display label (not column id) to match how columns are addressed elsewhere
    // (react-table mangles dotted accessor ids, e.g. "owners.groups" -> "owners_groups").
    const columnSuggestions = useMemo(() => {
        const sets = { File: new Set(), Groups: new Set(), Vehicles: new Set(), Drivers: new Set(), Trailers: new Set() };
        const ownerKinds = { groups: 'Groups', vehicles: 'Vehicles', drivers: 'Drivers', trailers: 'Trailers' };
        const add = (set, v) => {
            const label = String(v ?? '').trim();
            if (label) set.add(label);
        };
        tableData.forEach((f) => {
            add(sets.File, f.fileName);
            Object.keys(ownerKinds).forEach((k) => {
                const list = Array.isArray(f.owners?.[k]) ? f.owners[k] : [];
                list.forEach((n) => add(sets[ownerKinds[k]], n));
            });
        });
        const sorted = (set) => [...set].sort((a, b) => a.localeCompare(b));
        return { File: sorted(sets.File), Groups: sorted(sets.Groups), Vehicles: sorted(sets.Vehicles), Drivers: sorted(sets.Drivers), Trailers: sorted(sets.Trailers) };
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
        },
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
    const hasActiveFilters = activeFilters.length > 0 || hasGlobalFilter || showExpiredOnly;

    const clearAllFilters = () => {
        setColumnFilters([]);
        setGlobalFilter('');
        setShowExpiredOnly(false);
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

                                {showExpiredOnly && (
                                    <Chip
                                        size="small"
                                        icon={<EventBusyOutlinedIcon sx={{ fontSize: 15 }} />}
                                        label="Expired"
                                        onDelete={() => setShowExpiredOnly(false)}
                                        sx={{
                                            bgcolor: '#FEF3E2',
                                            color: '#C2630B',
                                            fontWeight: 600,
                                            borderRadius: '8px',
                                            '& .MuiChip-icon': { color: '#C2630B' },
                                            '& .MuiChip-deleteIcon': {
                                                color: '#C2630B',
                                                '&:hover': { color: '#9a4e08' },
                                            },
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

                <TableContainer sx={{ width: '100%' }}>
                    <Table>
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
                                        <TableCell key={header.id} sx={headCellSx}>
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
                                            {col.id === 'action' && (
                                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
                                                    <Button
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowExpiredOnly((v) => !v);
                                                        }}
                                                        variant={showExpiredOnly ? 'contained' : 'outlined'}
                                                        startIcon={<EventBusyOutlinedIcon sx={{ fontSize: 15 }} />}
                                                        sx={{
                                                            textTransform: 'none',
                                                            fontWeight: 600,
                                                            fontSize: 11.5,
                                                            borderRadius: '8px',
                                                            py: 0.25,
                                                            px: 1,
                                                            whiteSpace: 'nowrap',
                                                            boxShadow: 'none',
                                                            ...(showExpiredOnly
                                                                ? { bgcolor: '#C2630B', color: '#fff', '&:hover': { bgcolor: '#9a4e08', boxShadow: 'none' } }
                                                                : { borderColor: '#f0d6b5', color: '#C2630B', '&:hover': { borderColor: '#C2630B', bgcolor: '#FEF3E2' } }),
                                                        }}
                                                    >
                                                        {showExpiredOnly ? 'Expired' : 'Show Expired'}
                                                    </Button>
                                                </Box>
                                            )}
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
                    <Typography sx={{ fontSize: 13.5, color: '#64748b' }}>
                        Showing {start} to {end} of {total} results
                    </Typography>

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
