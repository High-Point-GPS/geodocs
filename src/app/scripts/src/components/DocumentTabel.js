import React, { useState, useMemo, useEffect } from 'react';

import DebouncedInput from './DebouncedInput';
import Filter from './Filter';

import {
    Box,
    Button,
    TableBody,
    Table,
    TableContainer,
    TableRow,
    TableHead,
    TableCell,
    Typography,
    Paper,
    IconButton,
    InputAdornment,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import RvHookupOutlinedIcon from '@mui/icons-material/RvHookupOutlined';
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

import { generateCSV } from '../utils/csv-generator';
import { CSVLink } from 'react-csv';

// Resolve a column's header to its plain text label (header defs are functions returning strings).
const getHeaderLabel = (header) => {
    const h = header.column.columnDef.header;
    return typeof h === 'function' ? h(header.getContext()) : h;
};

// Icon shown before each column name in the filter band, keyed by column id.
const columnIcons = {
    fileName: InsertDriveFileOutlinedIcon,
    'owners.groups': GroupsOutlinedIcon,
    'owners.vehicles': DirectionsCarOutlinedIcon,
    'owners.drivers': PersonOutlinedIcon,
    'owners.trailers': RvHookupOutlinedIcon,
    expiryDate: EventOutlinedIcon,
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
                    groups: Array.isArray(owners.groups) ? owners.groups : owners.groups || [],
                },
            };
        });
    }, [files, geotabData]);

    const table = useReactTable({
        data: displayFiles,
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
                    <Box sx={{ width: '100%', maxWidth: 360 }}>
                        <DebouncedInput
                            value={globalFilter ?? ''}
                            onChange={(value) => setGlobalFilter(String(value))}
                            placeholder="Search all columns..."
                            fullWidth
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                                    </InputAdornment>
                                ),
                                sx: { borderRadius: '10px', bgcolor: '#fff' },
                            }}
                            sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e5e7eb' } }}
                        />
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
                            {/* Filter band */}
                            <TableRow sx={{ bgcolor: '#fbfcfe' }}>
                                {headers.map((header) => {
                                    const col = header.column;
                                    if (col.id === 'select') {
                                        return <TableCell key={header.id} sx={{ ...headCellSx, width: 44 }} />;
                                    }
                                    const label = getHeaderLabel(header);
                                    const Icon = columnIcons[col.id];
                                    return (
                                        <TableCell key={header.id} sx={headCellSx}>
                                            {col.id !== 'action' && (
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: 0.625,
                                                        mb: 0.75,
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
                                                </Box>
                                            )}
                                            {col.getCanFilter() ? <Filter column={col} name={label} /> : null}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>

                            {/* Sortable header band */}
                            <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                {headers.map((header) => {
                                    const col = header.column;
                                    if (col.id === 'select') {
                                        return (
                                            <TableCell key={header.id} sx={{ ...headCellSx, width: 44, py: 1 }}>
                                                {flexRender(col.columnDef.header, header.getContext())}
                                            </TableCell>
                                        );
                                    }
                                    const label = getHeaderLabel(header);
                                    const sorted = col.getIsSorted();
                                    const canSort = col.getCanSort();
                                    return (
                                        <TableCell key={header.id} sx={{ ...headCellSx, py: 1 }}>
                                            <Box
                                                onClick={canSort ? col.getToggleSortingHandler() : undefined}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5,
                                                    cursor: canSort ? 'pointer' : 'default',
                                                    userSelect: 'none',
                                                }}
                                            >
                                                <Typography sx={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
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
