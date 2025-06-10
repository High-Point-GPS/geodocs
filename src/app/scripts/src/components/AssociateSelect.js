import React, { useState, useEffect } from 'react';

import { Box, Autocomplete, TextField } from '@mui/material';

const AssociateSelect = ({
	options,
	label,
	currentSelections,
	onUpdateUploadSelections,
	onUpdateCurrentSelections,
	isDisabled,
	isGroup = false,
	selectWidth = '100%',
}) => {
	const [currentOptions, setCurrentOptions] = useState([]);

	const handleUpdateSelections = (selections) => {
		if (selections.length > 0) {
			let newSelectionsToUpload = [];
			let allSelect = false;
			const childrenSelection = [];
			for (let i = 0; i < selections.length; ++i) {
				const selection = selections[i];

				if (selection.value === `All ${label}s`) {
					allSelect = true;
					newSelectionsToUpload = [...options];
					break;
				} else {
					newSelectionsToUpload.push(selection);
				}

				if (isGroup) {
					if (selection.children) {
						selection.children.forEach((child) => {
							newSelectionsToUpload.push(child);
							childrenSelection.push(child);
						});
					}
				}
			}

			onUpdateUploadSelections(newSelectionsToUpload);

			if (allSelect) {
				setCurrentOptions([]);
				onUpdateCurrentSelections([{ label: `All ${label}s`, value: `All ${label}s` }]);
			} else {
				onUpdateCurrentSelections([...selections, ...childrenSelection]);
			}
		} else {
			onUpdateUploadSelections([]);
			onUpdateCurrentSelections([]);
			setCurrentOptions([{ label: `All ${label}s`, value: `All ${label}s` }, ...options]);
		}
	};

	useEffect(() => {
		if (isGroup) {
			setCurrentOptions([...options]);
		} else {
			setCurrentOptions([{ label: `All ${label}s`, value: `All ${label}s` }, ...options]);
		}
	}, [options]);

	useEffect(() => {
		if (currentSelections.length === 0) {
			setCurrentOptions([{ label: `All ${label}s`, value: `All ${label}s` }, ...options]);
		}
	}, [currentSelections]);

	return (
		<Box sx={{ width: { xs: '100%', sm: '100%', md: selectWidth } }}>
			<Autocomplete
				multiple
				limitTags={1}
				options={currentOptions}
				value={currentSelections}
				getOptionLabel={(option) => option.label}
				filterSelectedOptions
				renderInput={(params) => <TextField {...params} label={`${label}s`} />}
				onChange={(event, newValue) => {
					handleUpdateSelections(newValue);
				}}
				disabled={isDisabled}
			/>
		</Box>
	);
};

export default AssociateSelect;
