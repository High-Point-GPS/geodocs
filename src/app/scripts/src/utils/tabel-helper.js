import React from 'react';
import { createColumnHelper, sortingFns } from '@tanstack/react-table';

import { rankItem, compareItems } from '@tanstack/match-sorter-utils';
import { Box, Typography, Tooltip, Chip } from '@mui/material';
import dayjs from 'dayjs';

const columnHelper = createColumnHelper();

const displayCell = (value) => {
    const content = `${value.slice(0, 5).join(', ')}${
        value.length > 5 ? '...' : ''
    }`;
    return (
        <>
            {value.length > 5 ? (
                <Tooltip title={`${value.join(', ')}`}>
                    <Typography>{content}</Typography>
                </Tooltip>
            ) : (
                <Typography>{content}</Typography>
            )}
        </>
    );
};

const displayGroupCell = (value) => {
    const content = `${value.slice(0, 5).join(', ')}${
        value.length > 5 ? '...' : ''
    }`;
    return (
        <>
            {value.length > 5 ? (
                <Tooltip title={`${value.join(', ')}`}>
                    <Typography>{content}</Typography>
                </Tooltip>
            ) : (
                <Typography>{content}</Typography>
            )}
        </>
    );
};

const fuzzySort = (rowA, rowB, columnId) => {
    let dir = 0;

    // Only sort by rank if the column has ranking information
    if (rowA.columnFiltersMeta[columnId]) {
        dir = compareItems(
            rowA.columnFiltersMeta[columnId].itemRank,
            rowB.columnFiltersMeta[columnId].itemRank
        );
    }

    // Provide an alphanumeric fallback for when the item ranks are equal
    return dir === 0 ? sortingFns.alphanumeric(rowA, rowB, columnId) : dir;
};

export const columns = [
    columnHelper.accessor('fileName', {
        header: () => 'File',
        cell: (info) => <Typography>{info.renderValue()}</Typography>,
        filterFn: 'fuzzy',
        sortingFn: fuzzySort,
        className: 'sticky',
        headerClassName: 'sticky',
    }),
    columnHelper.accessor('owners.groups', {
        header: () => 'Groups',
        cell: (info) => {
            const value = info.renderValue();
            if (value === null || value.length < 0) {
                return;
            }

            return displayCell(value);
        },
        filterFn: 'fuzzy',
        sortingFn: fuzzySort,
    }),
    columnHelper.accessor('owners.vehicles', {
        header: () => 'Vehicles',
        cell: (info) => {
            const value = info.renderValue();
            if (value === null || value.length < 0) {
                return;
            }

            return displayCell(value);
        },
        filterFn: 'fuzzy',
        sortingFn: fuzzySort,
        width: 400,
    }),
    columnHelper.accessor('owners.drivers', {
        header: () => 'Drivers',
        cell: (info) => {
            const value = info.renderValue();
            if (value === null || value.length < 0) {
                return;
            }

            return displayCell(value);
        },
        filterFn: 'fuzzy',
        sortingFn: fuzzySort,
    }),
    columnHelper.accessor('owners.trailers', {
        header: () => 'Trailers',
        cell: (info) => {
            const value = info.renderValue();
            if (value === null || value.length < 0) {
                return;
            }

            return displayCell(value);
        },
        filterFn: 'fuzzy',
        sortingFn: fuzzySort,
    }),
    columnHelper.accessor('expiryDate', {
        header: () => 'Expiry Date',
        cell: (info) => {
            const value = info.renderValue();
            console.log(value);
            if (value === null || value.length < 0) {
                return (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <Typography>None</Typography>

                        <Chip label="Active" color="primary" size="small" />
                    </Box>
                );
            }

            const currentDate = dayjs();
            const expireDate = dayjs(value);

            const hasExpired = expireDate < currentDate;

            return (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <Typography>{dayjs(value).format('LL')} </Typography>
                    {hasExpired ? (
                        <Chip label="Expired" color="secondary" sx={{color: 'white'}} size="small"  />
                    ) : (
                        <Chip label="Active" color="primary" size="small" />
                    )}
                </Box>
            );
        },
        filterFn: 'fuzzy',
        sortingFn: fuzzySort,
    }),
    columnHelper.accessor('action', {
        header: () => 'Action',
        cell: (info) => info.renderValue(),
    }),
];

export const fuzzyFilter = (row, columnId, value, addMeta) => {
    // Rank the item
    const itemRank = rankItem(row.getValue(columnId), value);

    // Store the itemRank info
    addMeta({
        itemRank,
    });

    // Return if the item should be filtered in/out
    return itemRank.passed;
};

export const stringMatchFilter = (row, columnId, filterValue) => {
    let rowValue = row.getValue(columnId);
    if (rowValue == null) return false;
    // If it's an array, join its elements into a string.
    if (Array.isArray(rowValue)) {
      rowValue = rowValue.join(' ');
    }
    return String(rowValue).toLowerCase().includes(String(filterValue).toLowerCase());
  };

  export const globalStringFilter = (row, _, filterValue) => {
    return row.getAllCells().some(cell => {
      let cellValue = cell.getValue();
      if (cellValue == null) return false;
      if (Array.isArray(cellValue)) {
        cellValue = cellValue.join(' ');
      }
      return String(cellValue).toLowerCase().includes(String(filterValue).toLowerCase());
    });
  };
