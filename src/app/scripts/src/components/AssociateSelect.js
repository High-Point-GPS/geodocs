import React, { useState, useEffect } from 'react';

import { Box, Autocomplete, Chip, TextField } from '@mui/material';

import { archivedLabel } from '../utils/formatter';

const AssociateSelect = ({
	options,
	label,
	currentSelections,
	onUpdateUploadSelections,
	onUpdateCurrentSelections,
	isDisabled,
	isGroup = false,
	selectWidth = '100%',
	dataKey,
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
			updateOptions();
		}
	};

	useEffect(() => {
		updateOptions();
	}, [options]);

	useEffect(() => {
		if (currentSelections.length === 0) {
			updateOptions();
		}
	}, [currentSelections]);

	const updateOptions = () => {
		if (isGroup || options.length > 1) {
			setCurrentOptions([{ label: `All ${label}s`, value: `All ${label}s` }, ...options]);
		} else {
			setCurrentOptions([...options]);
		}
	}

	return (
		<Box sx={{ width: { xs: '100%', sm: '100%', md: selectWidth } }}>
			<Autocomplete
				multiple
				limitTags={1}
				options={currentOptions}
				value={currentSelections}
				getOptionLabel={(option) => option.label}
				filterSelectedOptions
				// A selection whose asset Geotab no longer lists (archived) is greyed and
				// tagged. The tag is display-only: option.label stays the plain name because
				// the uploader stores selection labels as the file's ownerNames.
				renderTags={(value, getTagProps) =>
					value.map((option, index) => {
						const { key, ...tagProps } = getTagProps({ index });
						return (
							<Chip
								key={key ?? option.value ?? index}
								{...tagProps}
								size="small"
								label={option.archived ? `${option.label} (${archivedLabel(dataKey)})` : option.label}
								sx={option.archived ? { color: '#94a3b8', fontStyle: 'italic', bgcolor: '#f8fafc' } : undefined}
							/>
						);
					})
				}
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
