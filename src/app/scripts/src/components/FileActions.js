import React, { useState } from 'react';
import { Box, IconButton, Tooltip, Typography, Button, CircularProgress } from '@mui/material';

//import EditDocumentIcon from '@mui/icons-material/EditDocument';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DeleteIcon from '@mui/icons-material/Delete';
import Popup from './Popup';

const FileActions = ({ fileData, fileId, database, session, server, onEditFile, onFileDeleted, onValidationError }) => {
	const [deleteConfirm, setDeleteConfirm] = useState(null);
	const [deleteLoad, setDeleteLoad] = useState(false);
	const [downloadLoad, setDownloadLoad] = useState(false);


	 const onDeleteConfirmed = async () => {
		try {
			setDeleteLoad(true);
			const sessionInfo = {
				database,
				sessionId: session.sessionId,
				userName:  session.userName,
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
					session:  sessionInfo,
					database,
					fileId:   fileData.id,
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
	
	const handleDownload = async () => {
		  setDownloadLoad(true);
		try {
		const sessionInfo = {
			database,
			sessionId: session.sessionId,
			userName: session.userName,
			server
		};
		const messageBody = { session: sessionInfo, filePath: fileData.path, fileName: fileData.fileName };

		const response = await fetch(
			'https://us-central1-geotabfiles.cloudfunctions.net/readDocFile',
			{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify(messageBody)
			}
		);

		if (!response.ok) {
			const errorData = await response.json();
			if (errorData.valid === false && onValidationError) {
				onValidationError();
			}
			console.error('Download failed:', errorData.error || '');
			return;
		}

			const blob = await response.blob();
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = fileData.fileName;
			link.click();
		} catch (err) {
			console.error(err);
		} finally {
			setDownloadLoad(false);
		}
	};

	return (
		<Box sx={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
			
			<Tooltip title="Download File">
				<IconButton variant="contained" onClick={handleDownload} disabled={downloadLoad}>
					    {downloadLoad ? (
							<CircularProgress size={24} />
						) : (
							<OpenInNewRoundedIcon  color="primary" />
						)}
				</IconButton>
			</Tooltip>
			<Tooltip title="Edit File">
				<IconButton
					variant="contained"
					onClick={() => onEditFile({ id: fileId, ...fileData })}
				>
					<EditNoteIcon color="primary" sx={{fontSize: 32}} />
				</IconButton>
			</Tooltip>

			<Tooltip title="Delete File">
				<IconButton
					variant="contained"
					color="error"
					onClick={() => setDeleteConfirm(true)}
				>
					<DeleteIcon color="secondary" />
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
					<Typography sx={{ width: '100%', overflow: 'clip' }}>
						{fileData.fileName ? fileData.fileName: ''}
					</Typography>
				</Box>
				<Box sx={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
					{deleteLoad ? (
						<CircularProgress />
					) : (
						<>
							<Button variant="contained" onClick={onDeleteConfirmed}>
								Yes
							</Button>
							<Button variant="contained" onClick={() => setDeleteConfirm(null)}>
								No
							</Button>
						</>
					)}
				</Box>
			</Popup>
		</Box>
	);
};

export default FileActions;
