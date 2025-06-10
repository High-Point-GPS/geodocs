import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Dialog, DialogTitle, DialogContent, Typography, DialogActions, Button } from '@mui/material';

import Uploader from './components/Uploader';
import DocumentTable from './components/DocumentTabel';
import FileActions from './components/FileActions';

import '../../styles/app.css';

import DocumentMobile from './components/DocumentMobile';

const App = ({ api, database, session, server }) => {
	const [files, setFiles] = useState([]);
	const [tableFiles, setTableFiles] = useState([]);
	const [editFile, setEditFile] = useState(null);
	const [mobile, setMobile] = useState(false);
	const [loading, setLoading] = useState(false);
	const [validationError, setValidationError] = useState(false);

	const handeEditFile = (fileData) => {
		setEditFile({ ...fileData });
	};

	const handleFileEditComplete = (id, updateDoc) => {
		setEditFile(null);

		const newFiles = [...files];

		const foundFileIndex = newFiles.findIndex((f) => f.id === id);

		if (foundFileIndex !== -1) {
			newFiles[foundFileIndex] = {
				...newFiles[foundFileIndex],
				...updateDoc,
			};

			setFiles([...newFiles]);
		}
	};


	const handleFilesUploaded = (docs) => {
		const newFiles = [...files, ...docs];
		setFiles(newFiles);
	};

	
	const handleFileDeleted = (id) => {
		const newFiles = files.filter((file) => file.id !== id);
		setFiles(newFiles);
	};


	const fetchFiles = async  () => {
		const sessionInfo = {
			database: database,
			sessionId:  session.sessionId,
			userName: session.userName,
			server: server
		};

		const messageBody = {
			database: database,
			session: sessionInfo,
		};

		
		try {
			setLoading(true);

			const response = await fetch('https://us-central1-geotabfiles.cloudfunctions.net/fetchDocumentsForDatabase',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				body: JSON.stringify(messageBody)
			});
			
			if (!response.ok) {
				const errorData = await response.json();

				if (errorData.valid === false) {
					setValidationError(true);
				}

				console.error('Fetched Files failed: ', errorData.error ? errorData.error : '');
				setLoading(false);
				return;
			}

			const data = await response.json();
			const fetchedFiles = data.files.filter(file => file.fileName);


			fetchedFiles.sort((a, b) =>
				a.fileName.localeCompare(b.fileName)
			);
			setFiles(fetchedFiles);
			setLoading(false);
			
			} catch (err) {
				console.error('Error', err);
				setLoading(false);
			}
	}
	

	useEffect(() => {
		fetchFiles();
	}, []);

	useEffect(() => {
		const filesWithActions = files.map((file) => {
			file.action = (
				<FileActions
					fileData={file}
					fileId={file.id}
					onEditFile={handeEditFile}
					onFileDeleted={handleFileDeleted}
					onValidationError={() => setValidationError(true)}
					database={database}
					session={session}
					server={server}
					api={api}
				/>
			);
			return file;
		});

		setTableFiles([...filesWithActions]);
	}, [files]);

	useEffect(() => {
		function updateSize() {
			setMobile(window.innerWidth < 1200);
		}
		window.addEventListener('resize', updateSize);
		updateSize();
		return () => window.removeEventListener('resize', updateSize);
	}, []);

	return (
		<Box id="HPGPS"
		sx={{
			display: 'flex',
			flexDirection: 'column',
			marginLeft: '0.75rem',
			marginRight: '0.75rem',
		}}>
			{loading ? (
			<Box
			sx={{
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				height: '100vh',
			}}>
				<CircularProgress />
			</Box>
			) :
				<>
					<Uploader
						database={database}
						session={session}
						server={server}
						api={api}
						onFileUploaded={handleFilesUploaded}
						onValidationError={() => setValidationError(true)}
						editFile={editFile}
						onEditComplete={handleFileEditComplete}
					/>
						{mobile ? <DocumentMobile files={tableFiles} /> : <DocumentTable files={tableFiles} />}
				</>
				
			}
				<Dialog
				open={validationError}
				onClose={() => setValidationError(false)}
				aria-labelledby="validation-error-title"
				>
				<DialogTitle id="validation-error-title" sx={{fontSize: 24}}>Validation Error</DialogTitle>
				<DialogContent>
					<Typography variant='h6'>We can not validate your Geotab Session to this database, please re authenticate with geotab or contact support.</Typography>
				</DialogContent>
				<DialogActions>
					<Button variant="contained" onClick={() => setValidationError(false)}>
						OK
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};

export default App;
