import React, { useState, useMemo } from 'react';

import DebouncedInput from './DebouncedInput';
import Filter from './Filter';

import {
    Box,
    Button,
    Select,
    MenuItem,
    TextField,
    TableBody,
    Table,
    TableContainer,
    TableRow,
    TableHead,
    TableCell,
    Typography,
    Paper,
} from '@mui/material';

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

import '../../../styles/app-styles.css';
import { generateCSV } from '../utils/csv-generator';
import { CSVLink } from 'react-csv';

const DocumentTable = ({ files, geotabData,onOpenUploader }) => {
    const [columnFilters, setColumnFilters] = useState([]);
    const [globalFilter, setGlobalFilter] = useState('');

    const formatData = (dataIds, dataKey) => {
  if (!Array.isArray(dataIds) || !geotabData || !geotabData[dataKey]) return dataIds || [];
  return dataIds.map(id => {
    const d = geotabData[dataKey].find(x => x.value === id);
    return d ? d.label : id;
  });
};

const displayFiles = useMemo(() => {
  return files.map(file => {
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

const memoColumns = useMemo(() => columns, []);

    const table = useReactTable({
        data: displayFiles,
        columns: memoColumns,
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
        debugTable: false,
        debugHeaders: false,
        debugColumns: false,
    });

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                width: '100%',
                marginTop: '2rem',
            }}
        >
            <Box sx={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ flex: 1, marginLeft: '2.2rem' }}>
                    <DebouncedInput
                        value={globalFilter ?? ''}
                        onChange={(value) => setGlobalFilter(String(value))}
                        placeholder="Search all columns..."
                    />
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        marginRight: '1rem',
                        fontSize: '18px',
                    }}
                >
                    <CSVLink data={generateCSV(displayFiles)} filename={'geodoc.csv'}>
                        Export CSV
                    </CSVLink>
                </Box>
            </Box>
            <Box sx={{ width: '100%' }}>
                <TableContainer component={Paper} sx={{ width: '100%' }}>
                    <Table>
                        <TableHead>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableCell
                                                key={header.id}
                                                colSpan={header.colSpan}
                                                className={`${
                                                    header.id === 'fileName'
                                                        ? 'sticky'
                                                        : ''
                                                }`}
                                            >
                                                {header.isPlaceholder ? null : (
                                                    <Box
                                                        sx={{
                                                            textAlign: 'center',
                                                        }}
                                                    >
                                                        <Typography variant="h6">
                                                            {flexRender(
                                                                header.column
                                                                    .columnDef
                                                                    .header,
                                                                header.getContext()
                                                            )}
                                                        </Typography>
                                                        {header.id !==
                                                        'action' ? (
                                                            <div>
                                                                <Filter
                                                                    column={
                                                                        header.column
                                                                    }
                                                                    table={
                                                                        table
                                                                    }
                                                                    name={header.column.columnDef.header()}
                                                                />
                                                            </div>
                                                        ) : null}
                                                    </Box>
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableHead>
                        <TableBody>
                            {table.getRowModel().rows.map((row, index) => {
                                return (
                                    <TableRow key={row.id}>
                                        {row.getVisibleCells().map((cell) => {
                                            return (
                                                <TableCell
                                                    key={cell.id}
                                                    className={`${
                                                        cell.id.includes(
                                                            'fileName'
                                                        )
                                                            ? 'sticky'
                                                            : ''
                                                    }`}
                                                    sx={{
                                                        borderRight:
                                                            '1px solid lightgrey',
                                                    }}
                                                >
                                                    <div>
                                                        {flexRender(
                                                            cell.column
                                                                .columnDef.cell,
                                                            cell.getContext()
                                                        )}
                                                    </div>
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
                {displayFiles.length > table.getState().pagination.pageSize && (
                    <div
                        style={{ marginTop: '1.25rem' }}
                        className="geotabSecondaryText pagenation-foot"
                    >
                        <Button
                            onClick={() => table.setPageIndex(0)}
                            disabled={!table.getCanPreviousPage()}
                        >
                            {'<<'}
                        </Button>
                        <Button
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            {'<'}
                        </Button>
                        <Button
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            {'>'}
                        </Button>
                        <Button
                            onClick={() =>
                                table.setPageIndex(table.getPageCount() - 1)
                            }
                            disabled={!table.getCanNextPage()}
                        >
                            {'>>'}
                        </Button>
                        <span className="pagenation-foot">
                            <Typography>Page</Typography>
                            <Typography sx={{ fontWeight: 'bold' }}>
                                {table.getState().pagination.pageIndex + 1} of{' '}
                                {table.getPageCount()}
                            </Typography>
                        </span>
                        <span className="pagenation-foot">
                            <Typography>| Go to page:</Typography>
                            <TextField
                                sx={{ width: '75px' }}
                                type="number"
                                size="small"
                                defaultValue={
                                    table.getState().pagination.pageIndex + 1
                                }
                                onChange={(e) => {
                                    const page = e.target.value
                                        ? Number(e.target.value) - 1
                                        : 0;
                                    table.setPageIndex(page);
                                }}
                            />
                        </span>
                        <Select
                            size="small"
                            value={table.getState().pagination.pageSize}
                            onChange={(e) => {
                                table.setPageSize(Number(e.target.value));
                            }}
                            className="geotabFormEditField"
                        >
                            {[10, 20, 30, 40, 50].map((pageSize) => (
                                <MenuItem key={pageSize} value={pageSize}>
                                    Show {pageSize}
                                </MenuItem>
                            ))}
                        </Select>
                        <div>
                            {table.getPrePaginationRowModel().rows.length} Rows
                        </div>
                    </div>
                )}
            </Box>
        </Box>
    );
};

export default DocumentTable;
