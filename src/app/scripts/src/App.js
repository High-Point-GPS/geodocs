import React, { useEffect, useState } from 'react';
import { 
    Box, 
    CircularProgress, 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    Typography, 
    DialogActions, 
    Button, 
    Tooltip, 
    IconButton,
    AppBar,
    Toolbar,
} from '@mui/material';

import Uploader from './components/Uploader';
import DocumentTable from './components/DocumentTabel';
import FileActions from './components/FileActions';

import { formatGeotabData } from './utils/formatter';

import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close'; 

import '../../styles/app-styles.css';

import DocumentMobile from './components/DocumentMobile';

const App = ({ api, database, session, server }) => {
	const [files, setFiles] = useState([]);
	const [tableFiles, setTableFiles] = useState([]);
	const [editFile, setEditFile] = useState(null);
	const [mobile, setMobile] = useState(false);
	const [loading, setLoading] = useState(false);
	const [validationError, setValidationError] = useState(false);
	const [databaseConfig, setDatabaseConfig] = useState({});
    const [geotabData, setGeotabData] = useState({
        vehicles: [],
        drivers: [],
        trailers: [],
        groups: [],
    });

    const [uploaderOpen, setUploaderOpen] = useState(false);

	const handeEditFile = (fileData) => {
		setEditFile({ ...fileData });
		setUploaderOpen(true);
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
		const newFiles = [...docs, ...files];
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

			// get config
			const configResponse = await fetch('https://us-central1-geotabfiles.cloudfunctions.net/getDatabaseConfig',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				body: JSON.stringify(messageBody)
			});

			const config = await configResponse.json();

			setDatabaseConfig(config);

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

	// Load devices/users/trailers/groups for uploader when API is available
	useEffect(() => {
		if (!api) return;
		console.log('Loading Geotab Data for Uploader...');
		api.multiCall(
			[
				[
					'Get',
					{
						typeName: 'Device',
						search: { fromDate: new Date().toISOString() },
					},
				],
				[
					'Get',
					{
						typeName: 'User',
						search: {
							isDriver: true,
							fromDate: new Date().toISOString(),
						},
					},
				],
				['Get', { typeName: 'Trailer' }],
				['Get', { typeName: 'Group' }],
			],
			function (results) {
				let filteredDevices = results[0].filter(
					(res) => res.vehicleIdentificationNumber !== ''
				);
				const trailerNames = results[2].map((t) => t.id);
				let activeTrailers = results[0].filter((res) => {
					const isActive = new Date(res.activeTo) > new Date();
					const isId = res.tmpTrailerId && trailerNames.findIndex((t) => t === res.tmpTrailerId) !== -1;
					return isActive && isId;
				});

				if (!databaseConfig.directBilling) {
					api.call(
						'Get',
						{
							typeName: 'AddInDeviceLink',
							search: {
								addInSearch: {
									configuration: {
										solutionId: 'highPointsGPSGeoDocs™',
									},
								},
							},
						credentials: {
							database: database,
							sessionId: session.sessionId,
							userName: session.userName,
						},
						},
						(result) => {
							const marketDevices = result.map((x) => ({ ...x.device }));
							filteredDevices = filteredDevices.filter((res) => marketDevices.findIndex((md) => md.serialNumber === res.serialNumber) !== -1);
							activeTrailers = activeTrailers.filter((res) => marketDevices.findIndex((md) => md.serialNumber === res.serialNumber) !== -1);

							const formatedData = formatGeotabData(filteredDevices, results[1], activeTrailers, results[3]);
							setGeotabData(formatedData);
						},
						function (error) {
							console.error('Error: Could not find AddIn Device Links.', error);
						}
					);
				} else {
					const formatedData = formatGeotabData(filteredDevices, results[1], activeTrailers, results[3]);
					setGeotabData(formatedData);
				}
			},
			function (error) {
				console.log(error);
			}
		);
	}, [api, databaseConfig]);

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
		<Box sx={{ flexGrow: 1 }}>
			<AppBar position="static" sx={{ marginBottom: 3 }}>
				<Toolbar>
					<Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
						GeoDocs
					</Typography>
					<Button 
						color="inherit" 
						onClick={() => setUploaderOpen(true)}
						sx={{ 
							marginRight: 2,
							'&:hover': {
								backgroundColor: 'rgba(255, 255, 255, 0.1)'
							}
						}}
					>
						Upload
					</Button>
					<Tooltip title="More Info" arrow>
						<IconButton
							aria-label="Help"
							onClick={() => window.open('https://www.highpointgps.com/geodocs/', '_blank')}
							size="large"
							color="inherit"
						>
							<HelpOutlineIcon />
						</IconButton>
					</Tooltip>
				</Toolbar>
			</AppBar>

			{loading ? (
				<Box
					sx={{
						display: 'flex',
						justifyContent: 'center',
						alignItems: 'center',
						height: '100vh',
					}}
				>
					<CircularProgress />
				</Box>
			) : (
				<>
					{/* DocumentTable now hosts the Upload button in its header via onOpenUploader */}
					{mobile ? (
						<DocumentMobile files={tableFiles} onOpenUploader={() => setUploaderOpen(true)} />
					) : (
						<DocumentTable files={tableFiles} onOpenUploader={() => setUploaderOpen(true)} />
					)}
				</>
			)}

			<Dialog 
				open={uploaderOpen} 
				onClose={() => {
					setUploaderOpen(false);
					// Clear edit state when closing dialog
					if (editFile) {
						setEditFile(null);
					}
				}} 
				maxWidth="lg" 
				fullWidth
			>
				<DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					{editFile ? 'Edit File' : 'Upload File'}
					<IconButton
						aria-label="close"
						onClick={() => {
							setUploaderOpen(false);
							if (editFile) {
								setEditFile(null);
							}
						}}
						sx={{
							color: (theme) => theme.palette.grey[500],
						}}
					>
						<CloseIcon />
					</IconButton>
				</DialogTitle>
				<DialogContent>
					<Uploader
						database={database}
						session={session}
						server={server}
						api={api}
						onFileUploaded={(docs) => { handleFilesUploaded(docs); setUploaderOpen(false); }}
						onValidationError={() => setValidationError(true)}
						editFile={editFile}
						onEditComplete={(id, updateDoc) => { handleFileEditComplete(id, updateDoc); setUploaderOpen(false); }}
						databaseConfig={databaseConfig}
						geotabData={geotabData}
						setGeotabData={setGeotabData}
					/>
				</DialogContent>
			</Dialog>

			<Dialog open={validationError} onClose={() => setValidationError(false)} aria-labelledby="validation-error-title">
				<DialogTitle id="validation-error-title" sx={{ fontSize: 24 }}>
					Validation Error
				</DialogTitle>
				<DialogContent>
					<Typography variant="h6">
						We can not validate your Geotab Session to this database, please re authenticate with geotab or contact support.
					</Typography>
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
