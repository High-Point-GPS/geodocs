import React, { useState } from 'react';
import { Box, IconButton, Tooltip, Typography, Button } from '@mui/material';

import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Popup from './Popup';
import Spinner from './Spinner';

const FileActions = ({ fileData, fileId, database, session, server, onEditFile, onFileDeleted, onValidationError, onPreview }) => {
	const [deleteConfirm, setDeleteConfirm] = useState(null);
	const [deleteLoad, setDeleteLoad] = useState(false);

	const onDeleteConfirmed = async () => {
		try {
			setDeleteLoad(true);
			const sessionInfo = {
				database,
				sessionId: session.sessionId,
				userName: session.userName,
				server
			};

			const response = await fetch(
				'https://us-central1-geotabfiles.cloudfunctions.net/deleteDocFile',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json'
					},
					body: JSON.stringify({
						session: sessionInfo,
						database,
						fileId: fileData.id,
						filePath: fileData.path
					})
				});

			const data = await response.json();

			if (!response.ok) {
				if (data.valid === false) {
					onValidationError();
				}
				console.error('Delete failed:', data.error || '');
			} else {
				onFileDeleted(fileData.id);
			}
			setDeleteConfirm(false);
			setDeleteLoad(false);
		} catch (error) {
			console.error('Delete error:', error);
			setDeleteLoad(false);
			setDeleteConfirm(false);
		}
	};

	const iconButtonSx = {
		borderRadius: '8px',
		'&:hover': { backgroundColor: 'rgba(38, 71, 124, 0.08)' },
	};

	return (
		<Box sx={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
			<Tooltip title="Preview File" arrow>
				<IconButton size="small" onClick={onPreview} sx={iconButtonSx}>
					<VisibilityOutlinedIcon sx={{ color: '#2563EB' }} fontSize="small" />
				</IconButton>
			</Tooltip>

			<Tooltip title="Edit File" arrow>
				<IconButton
					size="small"
					onClick={() => onEditFile({ id: fileId, ...fileData })}
					sx={iconButtonSx}
				>
					<EditNoteIcon sx={{ color: '#2563EB' }} />
				</IconButton>
			</Tooltip>

			<Tooltip title="Delete File" arrow>
				<IconButton
					size="small"
					onClick={() => setDeleteConfirm(true)}
					sx={{ ...iconButtonSx, '&:hover': { backgroundColor: 'rgba(225, 29, 72, 0.08)' } }}
				>
					<DeleteOutlineIcon sx={{ color: '#E11D48' }} fontSize="small" />
				</IconButton>
			</Tooltip>

			<Popup open={deleteConfirm}>
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'center',
						alignItems: 'center',
						width: '100%',
					}}
				>
					<Typography variant="h6">
						Are you sure you want to delete the following file?
					</Typography>
					<Typography sx={{ width: '100%', overflow: 'clip', mt: 1, fontWeight: 600 }}>
						{fileData.fileName ? fileData.fileName : ''}
					</Typography>
				</Box>
				<Box sx={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
					{deleteLoad ? (
						<Spinner />
					) : (
						<>
							<Button variant="contained" color="error" onClick={onDeleteConfirmed} sx={{ textTransform: 'none', borderRadius: '10px', px: 3 }}>
								Delete
							</Button>
							<Button variant="outlined" onClick={() => setDeleteConfirm(null)} sx={{ textTransform: 'none', borderRadius: '10px', px: 3 }}>
								Cancel
							</Button>
						</>
					)}
				</Box>
			</Popup>
		</Box>
	);
};

export default FileActions;
