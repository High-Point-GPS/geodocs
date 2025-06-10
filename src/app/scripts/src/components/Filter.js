import React from 'react';
import DebouncedInput from './DebouncedInput';

function Filter({ column, name }) {
    const columnFilterValue = column.getFilterValue();

    return (
        <>
            <DebouncedInput
                type="text"
                value={columnFilterValue ?? ''}
                onChange={(value) => column.setFilterValue(value)}
                placeholder={`Search ${name}`}
            />
        </>
    );
}

export default Filter;
