import React, { useState, useEffect } from 'react';
import { TextField } from '@mui/material';

const DebouncedInput = ({ value: initialValue, onChange, debounce = 500, ...props }) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            onChange(value);
        }, debounce);

        return () => clearTimeout(timeout);
    }, [value]);

    return (
        <TextField
            sx={{ width: '200px' }}
            size="small"
            {...props}
            value={value}
            onChange={(e) => setValue(e.target.value)}
        />
    );
};

export default DebouncedInput;
