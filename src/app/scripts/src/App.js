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
	TextField,
    AppBar,
    Toolbar,
    Checkbox,
    FormControlLabel,
} from '@mui/material';

import Uploader from './components/Uploader';
import DocumentTable from './components/DocumentTabel';
import FileActions from './components/FileActions';

import { formatGeotabData } from './utils/formatter';

import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close'; 
import NotificationsIcon from '@mui/icons-material/Notifications';

import '../../styles/app-styles.css';

import DocumentMobile from './components/DocumentMobile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  palette: {
    primary: {
      main: '#26477C',
    },
	secondary: {
		main: '#FF7404',
	}
  },
  // optional: set app-wide fon
});


const App = ({ api, database, session, server }) => {
	const [files, setFiles] = useState([]);
	const [tableFiles, setTableFiles] = useState([]);
	const [editFile, setEditFile] = useState(null);
	const [mobile, setMobile] = useState(false);
	const [loading, setLoading] = useState(false);
	const [validationError, setValidationError] = useState(false);
	const [databaseConfig, setDatabaseConfig] = useState({});
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [settingsSaving, setSettingsSaving] = useState(false);
	const [globalAlertEmail, setGlobalAlertEmail] = useState('');
	const [globalAlertDaysBeforeExpiry, setGlobalAlertDaysBeforeExpiry] = useState('');
	const [dailyNotifications, setDailyNotifications] = useState(false);
    const [geotabData, setGeotabData] = useState({
        vehicles: [],
        drivers: [],
        trailers: [],
        groups: [],
    });

	const [showSuccessDialog, setShowSuccessDialog] = useState(false);

    const [uploaderOpen, setUploaderOpen] = useState(false);

	const getAlertSettingsFromConfig = (config) => ({
		email: config?.alertEmail ?? '',
		days:
			config?.alertDaysBeforeExpiry === 0 || config?.alertDaysBeforeExpiry
				? config.alertDaysBeforeExpiry
				: 7,
		dailyNotifications: config?.dailyNotifications ?? false,
	});

	useEffect(() => {
		const { email, days, dailyNotifications: dn } = getAlertSettingsFromConfig(databaseConfig);
		setGlobalAlertEmail(email ? String(email) : '');
		setGlobalAlertDaysBeforeExpiry(days === 0 || days ? String(days) : '7');
		setDailyNotifications(!!dn);
	}, [databaseConfig]);

	useEffect(() => {
		if (!settingsOpen) return;
		const { email, days, dailyNotifications: dn } = getAlertSettingsFromConfig(databaseConfig);
		setGlobalAlertEmail(email ? String(email) : '');
		setGlobalAlertDaysBeforeExpiry(days === 0 || days ? String(days) : '7');
		setDailyNotifications(!!dn);
	}, [settingsOpen, databaseConfig]);

	const handeEditFile = (fileData) => {
		setEditFile({ ...fileData });
		setUploaderOpen(true);
	};

	const handleFileEditComplete = (id, updateDoc) => {
		setEditFile(null);

		const newFiles = [...files];

		const foundFileIndex = newFiles.findIndex((f) => f.id === id);

		if (foundFileIndex === -1) return;

		const normalized = { ...updateDoc };

		if ('expiryDate' in normalized) {
			const v = normalized.expiryDate;
			if (v === null || v === '' || (typeof v === 'object' && Object.keys(v).length === 0)) {
				normalized.expiryDate = null;
			}
			if (normalized.expiryDate === undefined) {
				delete normalized.expiryDate;
			}
		}

		if ('alertEmail' in normalized) {
			if (normalized.alertEmail === '' || normalized.alertEmail === undefined) {
				normalized.alertEmail = null;
			}
		}

		newFiles[foundFileIndex] = {
			...newFiles[foundFileIndex],
			...normalized,
		};

		if ('expiryDate' in normalized && normalized.expiryDate === null) {
			newFiles[foundFileIndex].expiryDate = null;
		}

		if ('alertEmail' in normalized && normalized.alertEmail === null) {
			newFiles[foundFileIndex].alertEmail = null;
		}

		setFiles([...newFiles]);
	};

	const handleSaveGlobalAlertSettings = async () => {
		setSettingsSaving(true);

		try {
			const sessionInfo = {
				database,
				sessionId: session.sessionId,
				userName: session.userName,
				server,
			};

			const parsedDays = Number(globalAlertDaysBeforeExpiry);
			const alertDaysBeforeExpiry = Number.isFinite(parsedDays) && parsedDays >= 0 ? parsedDays : 7;

			const messageBody = {
				session: sessionInfo,
				database,
				globalAlertEmail: globalAlertEmail.trim(),
				globalAlertDaysBeforeExpiry: alertDaysBeforeExpiry,
				dailyNotifications,
			};

			const response = await fetch(
				'https://us-central1-geotabfiles.cloudfunctions.net/editGlobalAlertSettings',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
					},
					body: JSON.stringify(messageBody),
				}
			);

			const data = await response.json();

			if (!response.ok) {
				if (data.valid === false) {
					setValidationError(true);
				}
				throw new Error(data.error || data.message || 'Failed to save alert settings');
			}

			setDatabaseConfig((current) => {
				return {
					...current,
					alertEmail: data.globalAlertEmail ?? globalAlertEmail.trim(),
					alertDaysBeforeExpiry:
						data.globalAlertDaysBeforeExpiry === 0 || data.globalAlertDaysBeforeExpiry
							? data.globalAlertDaysBeforeExpiry
							: alertDaysBeforeExpiry,
					dailyNotifications: data.dailyNotifications ?? dailyNotifications,
				};
			});
			setSettingsOpen(false);
		} catch (error) {
			console.error('Failed to save global alert settings:', error);
		} finally {
			setSettingsSaving(false);
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

	const  updateLegacyData = async(devices, drivers, trailers, creds) => {
		const vehicleDataTransfer = devices.map(v => {
			return {
				oldData: `${v.name} (${v.serialNumber})`,
				newData: v.id
			}
		});

		const driverDataTransfer = drivers.map(d => {
			return {
				oldData: `${d.firstName} ${d.lastName}`,
				newData: d.id
			}
		});

		const trailerDataTransfer = trailers.map(v => {
			return {
				oldData: `${v.name}`,
				newData: v.id
			}
		});

		const data = {
			vehicles: vehicleDataTransfer,
			drivers: driverDataTransfer,
			trailers: trailerDataTransfer
		};

		const messageBody ={
			session: creds,
			database: creds.database,
			username: creds.userName,
			data: data
		}


		const configResponse = await fetch('https://us-central1-geotabfiles.cloudfunctions.net/updateLegacyData',
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			body: JSON.stringify(messageBody)
		});

		const config = await configResponse.json();

		if (config.success === true) {
			setShowSuccessDialog(true);
		}
	}


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
		
		if (!api || Object.keys(databaseConfig).length === 0) return;
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
			async function (results) {
				const sessionInfo = {
					database: database,
					sessionId:  session.sessionId,
					userName: session.userName,
					server: server
				};

				let filteredDevices = results[0];
				const trailerNames = results[2].map((t) => t.id);
				let activeTrailers = results[0].filter((res) => {
					const isActive = new Date(res.activeTo) > new Date();
					const isId = res.tmpTrailerId && trailerNames.findIndex((t) => t === res.tmpTrailerId) !== -1;
					return isActive && isId;
				});

				await updateLegacyData(filteredDevices, results[1], activeTrailers, sessionInfo);

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
	<ThemeProvider theme={theme}>
      <CssBaseline />
		<Box sx={{ flexGrow: 1 }}>
			<AppBar position="static" sx={{ marginBottom: 3 }}>
				<Toolbar sx={{backgroundColor: '#fefefe', display: 'flex', justifyContent: 'space-between'}}>
					<Box sx={{display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1}}>
						<img src="https://storage.googleapis.com/geotab_mp_images/solution_logos/3e9cd368-d677-4112-999e-15d654cbe7f9.png" alt="GeoDocs Logo" style={{ height: 40, borderRadius: '5px' }} />
						<Typography color="primary" variant="h6" component="div" sx={{ flexGrow: 1, display: { xs: 'none', md: 'inline' } }}>
							GeoDocs
						</Typography>
					</Box>
	
					<Button
						color="primary"
						variant="outlined"
						onClick={() => setUploaderOpen(true)}
						sx={{ 
							marginRight: 2,
							'&:hover': {
								backgroundColor: 'rgba(255, 255, 255, 0.1)'
							}
						}}
						  startIcon={<CloudUploadIcon />}
					>
						Upload
					</Button>
					<Tooltip title="Document Expiration Notifications" arrow>
						<IconButton
							aria-label="Document Expiration Notifications"
							onClick={() => setSettingsOpen(true)}
							size="large"
							color="primary"
						>
							<NotificationsIcon />
						</IconButton>
					</Tooltip>
					<Tooltip title="More Info" arrow>
						<IconButton
							aria-label="Help"
							onClick={() => window.open('https://www.highpointgps.com/geodocs/', '_blank')}
							size="large"
							color="primary"
						>
							<HelpOutlineIcon />
						</IconButton>
					</Tooltip>
				</Toolbar>
			</AppBar>

				<Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
					<DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						Global Alert Settings
						<IconButton
							aria-label="close settings"
							onClick={() => setSettingsOpen(false)}
							sx={{ color: (theme) => theme.palette.grey[500] }}
						>
							<CloseIcon />
						</IconButton>
					</DialogTitle>
					<DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
						<Typography variant="body2" color="text.secondary">
							Configure the default email to receive alerts on document expiry dates and how many days before expiry an alert should be sent.
						</Typography>
						<TextField
							label="Global Alert Email"
							value={globalAlertEmail}
							onChange={(e) => setGlobalAlertEmail(e.target.value)}
							fullWidth
							helperText="The default email to receive alerts on documents expiry dates."
						/>
						<TextField
							label="Alert Days Before Expiry"
							type="number"
							value={globalAlertDaysBeforeExpiry}
							onChange={(e) => setGlobalAlertDaysBeforeExpiry(e.target.value)}
							fullWidth
							inputProps={{ min: 0 }}
							helperText="How many days before a document expires we should send an alert email."
						/>
						<FormControlLabel
							control={
								<Checkbox
									checked={dailyNotifications}
									onChange={(e) => setDailyNotifications(e.target.checked)}
									color="primary"
								/>
							}
							label="Enable daily notifications"
						/>
					</DialogContent>
					<DialogActions sx={{ px: 3, pb: 2 }}>
						<Button onClick={() => setSettingsOpen(false)} disabled={settingsSaving}>
							Cancel
						</Button>
						<Button variant="contained" onClick={handleSaveGlobalAlertSettings} disabled={settingsSaving}>
							{settingsSaving ? 'Saving...' : 'Save'}
						</Button>
					</DialogActions>
				</Dialog>

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
						<DocumentMobile files={tableFiles} geotabData={geotabData} onOpenUploader={() => setUploaderOpen(true)} />
					) : (
						<DocumentTable
							files={tableFiles}
							geotabData={geotabData}
							globalAlertEmail={databaseConfig?.alertEmail || ''}
							onOpenUploader={() => setUploaderOpen(true)}
						/>
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
				<Dialog
				open={showSuccessDialog}
				onClose={() => setShowSuccessDialog(false)}
				aria-labelledby="success-title"
			>
				<DialogTitle id="success-title" sx={{fontSize: 24}}>Data Updated Successfully</DialogTitle>
				<DialogContent>
					<Typography variant='h6'>We have updated your data to use device, vehicle, and trailer ids. Please refresh the page to see the changes.</Typography>
				</DialogContent>
				<DialogActions>
					<Button variant="contained" onClick={() => {
						setShowSuccessDialog(false);
						window.location.reload();
					}}>
						Refresh Page
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
		</ThemeProvider>
	);
};

export default App;
