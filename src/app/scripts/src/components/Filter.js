import React from 'react';
import { Autocomplete, InputAdornment, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DebouncedInput from './DebouncedInput';

function Filter({ column, name, suggestions }) {
    const columnFilterValue = column.getFilterValue();
    const placeholder = `Search ${String(name).toLowerCase()}...`;

    const searchAdornment = (
        <InputAdornment position="start">
            <SearchIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
        </InputAdornment>
    );
    const inputSx = { borderRadius: '10px', bgcolor: '#fff', fontSize: 13 };
    const outlineSx = { '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e5e7eb' } };

    // Columns with no discrete values to suggest (e.g. Expiry Date) keep the plain
    // debounced text input.
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
        return (
            <DebouncedInput
                type="text"
                value={columnFilterValue ?? ''}
                onChange={(value) => column.setFilterValue(value)}
                placeholder={placeholder}
                fullWidth
                InputProps={{ startAdornment: searchAdornment, sx: inputSx }}
                sx={outlineSx}
            />
        );
    }

    // Typing still free-text filters this column; picking a suggestion sets the filter to
    // that exact value. Mirrors the global search box (see DocumentTable's Autocomplete).
    return (
        <Autocomplete
            freeSolo
            fullWidth
            size="small"
            options={suggestions}
            inputValue={columnFilterValue ?? ''}
            onInputChange={(e, value, reason) => {
                if (reason === 'input' || reason === 'clear') column.setFilterValue(value);
            }}
            onChange={(e, value) => column.setFilterValue(value == null ? '' : value)}
            renderInput={(params) => (
                <TextField
                    {...params}
                    placeholder={placeholder}
                    InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                            <>
                                <InputAdornment position="start" sx={{ ml: 0.5, mr: 0 }}>
                                    <SearchIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                                </InputAdornment>
                                {params.InputProps.startAdornment}
                            </>
                        ),
                        sx: inputSx,
                    }}
                    sx={outlineSx}
                />
            )}
        />
    );
}

export default Filter;
