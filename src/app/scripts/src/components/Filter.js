import React from 'react';
import { InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DebouncedInput from './DebouncedInput';

function Filter({ column, name }) {
    const columnFilterValue = column.getFilterValue();

    return (
        <DebouncedInput
            type="text"
            value={columnFilterValue ?? ''}
            onChange={(value) => column.setFilterValue(value)}
            placeholder={`Search ${String(name).toLowerCase()}...`}
            fullWidth
            InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                    </InputAdornment>
                ),
                sx: { borderRadius: '10px', bgcolor: '#fff', fontSize: 13 },
            }}
            sx={{
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e5e7eb' },
            }}
        />
    );
}

export default Filter;
