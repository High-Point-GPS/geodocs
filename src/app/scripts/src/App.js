import React, { useEffect, useState, useMemo, useRef, lazy, Suspense } from 'react';
import {
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    DialogActions,
    Button,
    Tooltip,
    IconButton,
	TextField,
    Badge,
    Checkbox,
    FormControlLabel,
    InputAdornment,
} from '@mui/material';
import dayjs from 'dayjs';

// Deferred: the uploader pulls in the PrimeReact group picker (+ its theme CSS) and the
// calendar is its own heavy view — neither is needed for the initial document list, so
// both load only when their dialog is opened.
const Uploader = lazy(() => import(/* webpackChunkName: "uploader" */ './components/Uploader'));
const ExpiryCalendar = lazy(() => import(/* webpackChunkName: "expiry-calendar" */ './components/ExpiryCalendar'));
import DocumentTable from './components/DocumentTabel';
import EmailChipsInput, { splitEmails } from './components/EmailChipsInput';
import FileActions from './components/FileActions';
import FilePreview from './components/FilePreview';
import FileTypeGlyph from './components/FileTypeGlyph';
import Spinner from './components/Spinner';

import { formatGeotabData, getFileTypeMeta, matchGeotabData } from './utils/formatter';

import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';
import MarkEmailUnreadOutlinedIcon from '@mui/icons-material/MarkEmailUnreadOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';

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
  typography: {
    fontFamily: 'Roboto, "Segoe UI", Helvetica, Arial, sans-serif',
  },
  components: {
    // Professional, consistent text inputs everywhere (search, filters, dialogs, uploader).
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: '#ffffff',
          transition: 'border-color 120ms ease, box-shadow 120ms ease',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#e2e8f0',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#cbd5e1',
          },
          '&.Mui-focused': {
            boxShadow: '0 0 0 3px rgba(38, 71, 124, 0.12)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#26477C',
            borderWidth: 1,
          },
          '&.Mui-disabled': {
            backgroundColor: '#f1f5f9',
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#64748b',
          '&.Mui-focused': { color: '#26477C' },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        input: {
          '&::placeholder': { color: '#94a3b8', opacity: 1 },
        },
      },
    },
  },
});


const App = ({ api, database, session, server, deepLinkFileId = null }) => {
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
    // True once the Geotab vehicle/driver/trailer/group lists have actually loaded, so
    // the owner-name sync doesn't run against the empty initial map (which would store IDs).
    const [geotabDataLoaded, setGeotabDataLoaded] = useState(false);
    // Guards against re-entering the name sync while a request is in flight.
    const syncingNamesRef = useRef(false);
    // A "...,fileId:<id>" deep link (used by alert emails) is handled once per load.
    const deepLinkHandledRef = useRef(false);

	const [showSuccessDialog, setShowSuccessDialog] = useState(false);

    const [uploaderOpen, setUploaderOpen] = useState(false);
	const [calendarOpen, setCalendarOpen] = useState(false);
	// Preview is tracked by file id (not a raw-array index) so prev/next can follow the
	// order the user actually sees; the table/mobile view reports its displayed order here.
	const [previewFileId, setPreviewFileId] = useState(null);
	const [orderedFiles, setOrderedFiles] = useState([]);

	// Number of documents that are expired or expiring within the alert window — drives the bell badge.
	const expiringCount = useMemo(() => {
		const days = Number(databaseConfig?.alertDaysBeforeExpiry);
		const threshold = Number.isFinite(days) ? days : 7;
		const now = dayjs();
		return files.filter((f) => {
			if (!f.expiryDate) return false;
			return dayjs(f.expiryDate).diff(now, 'day') <= threshold;
		}).length;
	}, [files, databaseConfig]);

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

			// Config and documents are independent — fire both at once so the spinner
			// time is one round trip, not two.
			const requestInit = {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				body: JSON.stringify(messageBody)
			};
			const [configResponse, response] = await Promise.all([
				fetch('https://us-central1-geotabfiles.cloudfunctions.net/getDatabaseConfig', requestInit),
				fetch('https://us-central1-geotabfiles.cloudfunctions.net/fetchDocumentsForDatabase', requestInit),
			]);

			const config = await configResponse.json();

			setDatabaseConfig(config);

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

	// Alert emails link to #addin-geodocs-hpgpsfilemanager,fileId:<id> — once the
	// file list is in, open that file's edit dialog directly. MyGeotab passes the
	// param via add-in state (deepLinkFileId); the hash check covers the embed page.
	useEffect(() => {
		if (deepLinkHandledRef.current || files.length === 0) return;
		deepLinkHandledRef.current = true;
		const hashMatch = window.location.hash.match(/[#,]fileId:([^,&/]+)/);
		const fileId = deepLinkFileId || (hashMatch ? decodeURIComponent(hashMatch[1]) : null);
		if (!fileId) return;
		const target = files.find((f) => String(f.id) === fileId);
		if (target) handeEditFile(target);
	}, [files, deepLinkFileId]);

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

				// The one-time ID migration sets config.updateFromLegacy once it has run;
				// skip the round trip entirely on every load thereafter (the backend would
				// just no-op anyway). Only un-migrated databases pay for it, once.
				if (!databaseConfig.updateFromLegacy) {
					await updateLegacyData(filteredDevices, results[1], activeTrailers, sessionInfo);
				}

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
							setGeotabDataLoaded(true);
						},
						function (error) {
							console.error('Error: Could not find AddIn Device Links.', error);
						}
					);
				} else {
					const formatedData = formatGeotabData(filteredDevices, results[1], activeTrailers, results[3]);
					setGeotabData(formatedData);
					setGeotabDataLoaded(true);
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
					onPreview={() => setPreviewFileId(file.id)}
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

	// Keep each file's saved owner display-names (ownerNames) in sync with Geotab's current
	// names, so the daily expiry email — which runs with no Geotab session — can show them.
	// Runs in the background whenever the app is open: resolves owner IDs -> names via the
	// live Geotab map, and posts only the files whose names changed or are missing. This also
	// backfills files uploaded before the feature existed, and self-heals after a rename.
	useEffect(() => {
		if (!geotabDataLoaded) return;
		if (!files.length) return;
		if (syncingNamesRef.current) return;

		// Resolve a list of owner IDs to names. geotabData is a FILTERED subset (only
		// add-in-linked / active / current assets), so an ID assigned to a now-deactivated
		// or unlinked asset won't be found. In that case we keep the last-known-good name
		// that was previously stored (never DOWNGRADE a real name back to a raw Geotab ID),
		// falling back to the ID only when we have nothing better. Arrays stay positionally
		// aligned with `owners`. Groups are already stored by name.
		const resolveList = (ids, key, prior) =>
			(ids || []).map((id, i) => {
				const hit = geotabData[key].find((d) => d.value === id);
				if (hit) return hit.label;                     // current Geotab name wins
				const prev = prior && prior[i];
				if (prev != null && prev !== id) return prev;  // keep last-known-good name
				return id;                                     // nothing better than the ID
			});

		const resolveNames = (file) => {
			const o = file.owners || {};
			const prior = file.ownerNames || {};
			return {
				vehicles: resolveList(o.vehicles, 'vehicles', prior.vehicles),
				drivers: resolveList(o.drivers, 'drivers', prior.drivers),
				trailers: resolveList(o.trailers, 'trailers', prior.trailers),
				groups: [...(o.groups || [])],
			};
		};

		// Order-independent at the object level. Firestore returns map keys alphabetically
		// sorted, so a whole-object JSON.stringify of the fetched ownerNames would never match
		// our insertion-ordered object — and we'd re-POST every file on every load. Compare
		// each named array element-wise instead (element order within an array is stable).
		const arr = (x) => (Array.isArray(x) ? x : []);
		const eqArr = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
		const sameNames = (a, b) => {
			a = a || {};
			b = b || {};
			return (
				eqArr(arr(a.vehicles), arr(b.vehicles)) &&
				eqArr(arr(a.drivers), arr(b.drivers)) &&
				eqArr(arr(a.trailers), arr(b.trailers)) &&
				eqArr(arr(a.groups), arr(b.groups))
			);
		};

		const updates = [];
		for (const f of files) {
			if (!f.id || f.id === 'config') continue;
			const computed = resolveNames(f);
			if (!sameNames(computed, f.ownerNames)) {
				updates.push({ fileId: f.id, ownerNames: computed });
			}
		}

		if (!updates.length) return;

		syncingNamesRef.current = true;
		// Optimistically attach the computed names locally so this effect doesn't resend them
		// on the re-render it triggers (the next pass finds them unchanged and stops).
		setFiles((prev) =>
			prev.map((f) => {
				const u = updates.find((x) => x.fileId === f.id);
				return u ? { ...f, ownerNames: u.ownerNames } : f;
			})
		);

		const sessionInfo = {
			database,
			sessionId: session.sessionId,
			userName: session.userName,
			server,
		};

		fetch('https://us-central1-geotabfiles.cloudfunctions.net/syncOwnerNames', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ session: sessionInfo, database, updates }),
		})
			.catch((err) => console.error('syncOwnerNames failed:', err))
			.finally(() => {
				syncingNamesRef.current = false;
			});
	}, [files, geotabData, geotabDataLoaded]);

	useEffect(() => {
		function updateSize() {
			setMobile(window.innerWidth < 1200);
		}
		window.addEventListener('resize', updateSize);
		updateSize();
		return () => window.removeEventListener('resize', updateSize);
	}, []);

	const editMeta = editFile ? getFileTypeMeta(editFile.fileName) : null;

	// Human label for how often the expiry reminder repeats (from the days-before-expiry field).
	const repeatDaysNum = Number(globalAlertDaysBeforeExpiry);
	const repeatEveryLabel =
		Number.isFinite(repeatDaysNum) && repeatDaysNum > 0
			? `${repeatDaysNum} day${repeatDaysNum === 1 ? '' : 's'}`
			: 'the set number of days';

	// Drive the preview from the on-screen order (falls back to the raw list until reported).
	const previewList = orderedFiles.length ? orderedFiles : files;
	const previewIndex =
		previewFileId == null
			? null
			: (() => {
					const i = previewList.findIndex((f) => f.id === previewFileId);
					return i >= 0 ? i : null;
			  })();

	return (
	<ThemeProvider theme={theme}>
      <CssBaseline />
		<Box sx={{ flexGrow: 1, bgcolor: '#f8fafc', minHeight: '100vh' }}>
			{/* Header */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					flexWrap: 'wrap',
					gap: 2,
					px: { xs: 2, md: 3 },
					py: 2.5,
				}}
			>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
					<Box
						sx={{
							width: 46,
							height: 46,
							borderRadius: '12px',
							overflow: 'hidden',
							flexShrink: 0,
							boxShadow: '0 2px 6px rgba(16,24,40,0.12)',
						}}
					>
						<img
							src="https://storage.googleapis.com/geotab_mp_images/solution_logos/3e9cd368-d677-4112-999e-15d654cbe7f9.png"
							alt="GeoDocs Logo"
							style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
						/>
					</Box>
					<Box>
						<Typography sx={{ fontWeight: 700, fontSize: 22, color: '#1f2937', lineHeight: 1.2 }}>
							GeoDocs
						</Typography>
						<Typography sx={{ fontSize: 13.5, color: '#6b7280' }}>
							Store, organize, and manage documents by Driver, Vehicle or Trailer.
						</Typography>
					</Box>
				</Box>

				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
					<Button
						variant="contained"
						onClick={() => setUploaderOpen(true)}
						startIcon={<CloudUploadIcon />}
						sx={{
							textTransform: 'none',
							fontWeight: 600,
							borderRadius: '10px',
							px: 2.5,
							py: 1,
							boxShadow: '0 2px 6px rgba(38,71,124,0.25)',
						}}
					>
						Upload Files
					</Button>
					<Tooltip title="View expiry dates on a calendar" arrow>
						<Button
							variant="outlined"
							onClick={() => setCalendarOpen(true)}
							startIcon={<EventBusyOutlinedIcon />}
							sx={{
								textTransform: 'none',
								fontWeight: 600,
								borderRadius: '10px',
								borderColor: '#e5e7eb',
								color: '#334155',
								bgcolor: '#fff',
								px: 2,
								'&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' },
							}}
						>
							Calendar
						</Button>
					</Tooltip>
					<Tooltip title="Configure expiry email alerts" arrow>
						<Button
							variant="outlined"
							onClick={() => setSettingsOpen(true)}
							startIcon={
								<Badge badgeContent={expiringCount} color="error">
									<MarkEmailUnreadOutlinedIcon />
								</Badge>
							}
							sx={{
								textTransform: 'none',
								fontWeight: 600,
								borderRadius: '10px',
								borderColor: '#e5e7eb',
								color: '#334155',
								bgcolor: '#fff',
								px: 2,
								'&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' },
							}}
						>
							Expiry Notifications
						</Button>
					</Tooltip>
					<Tooltip title="More Info" arrow>
						<IconButton
							aria-label="Help"
							onClick={() => window.open('https://www.highpointgps.com/geodocs/', '_blank', 'noopener,noreferrer')}
							sx={{ border: '1px solid #e5e7eb', borderRadius: '10px', bgcolor: '#fff' }}
						>
							<HelpOutlineIcon color="primary" />
						</IconButton>
					</Tooltip>
				</Box>
			</Box>

				<Dialog
					open={settingsOpen}
					onClose={() => setSettingsOpen(false)}
					maxWidth="sm"
					fullWidth
					PaperProps={{ sx: { borderRadius: '16px' } }}
					aria-labelledby="global-alert-settings-title"
				>
					{/* component="div" so the heading/subtitle markup below stays valid HTML */}
					<DialogTitle component="div" sx={{ m: 0, p: 2.5, pb: 1.5, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
						<Box
							sx={{
								width: 56,
								height: 56,
								borderRadius: '50%',
								bgcolor: '#26477C',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								flexShrink: 0,
							}}
						>
							<NotificationsNoneOutlinedIcon sx={{ fontSize: 30, color: '#FF7404' }} />
						</Box>
						<Box sx={{ flex: 1, minWidth: 0 }}>
							<Typography
								component="h2"
								id="global-alert-settings-title"
								sx={{ fontWeight: 700, fontSize: 20, color: '#26477C', lineHeight: 1.3, m: 0 }}
							>
								Global Alert Settings
							</Typography>
							<Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
								Configure the default emails to receive alerts on document expiry dates and how many days before expiry an alert should be sent.
							</Typography>
						</Box>
						<IconButton
							aria-label="close settings"
							onClick={() => setSettingsOpen(false)}
							sx={{ color: (theme) => theme.palette.grey[500], mt: -0.5, mr: -0.5 }}
						>
							<CloseIcon />
						</IconButton>
					</DialogTitle>
					<DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, px: 2.5, pt: 1 }}>
						<Box>
							<Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#334155', mb: 0.75 }}>
								Global Alert Email
							</Typography>
							<EmailChipsInput
								value={splitEmails(globalAlertEmail)}
								onChange={(emails) => setGlobalAlertEmail(emails.join(', '))}
								placeholder={splitEmails(globalAlertEmail).length ? '' : 'Add email…'}
								helperText="The default emails to receive alerts on document expiry dates. Press Space or Enter after each address. Per-file alert emails override this default."
								startIcon={<MailOutlineIcon sx={{ fontSize: 18, color: '#94a3b8', ml: 0.5 }} />}
								ariaLabel="Global alert email"
							/>
						</Box>
						<Box>
							<Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#334155', mb: 0.75 }}>
								Alert Days Before Expiry
							</Typography>
							<TextField
								type="number"
								size="small"
								value={globalAlertDaysBeforeExpiry}
								onChange={(e) => setGlobalAlertDaysBeforeExpiry(e.target.value)}
								fullWidth
								inputProps={{ min: 0, 'aria-label': 'Alert days before expiry' }}
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<EventOutlinedIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
										</InputAdornment>
									),
								}}
								helperText="How many days before a document expires we should send an alert email."
							/>
						</Box>
						<Box
							sx={{
								border: '1px solid #e5e7eb',
								borderRadius: '12px',
								bgcolor: '#fbfcfe',
								px: 2,
								py: 1.75,
								display: 'flex',
								alignItems: 'center',
								gap: 1.5,
							}}
						>
							<Box sx={{ flex: 1, minWidth: 0 }}>
								<FormControlLabel
									sx={{ mb: 0 }}
									control={
										<Checkbox
											checked={dailyNotifications}
											onChange={(e) => setDailyNotifications(e.target.checked)}
											color="primary"
										/>
									}
									label={
										<Typography sx={{ fontWeight: 700, color: '#1f2937' }}>
											Enable daily notifications
										</Typography>
									}
								/>
								<Typography
									variant="caption"
									sx={{ display: 'block', color: '#64748b', ml: 4, mt: '-2px', lineHeight: 1.5 }}
								>
									When enabled, the reminder repeats daily, starting {repeatEveryLabel} before the document expires (set above), until the file is removed.
								</Typography>
							</Box>
							{/* Decorative bell-with-clock illustration; hidden on narrow screens */}
							<Box sx={{ position: 'relative', flexShrink: 0, mr: 1, display: { xs: 'none', sm: 'block' } }}>
								<NotificationsNoneOutlinedIcon sx={{ fontSize: 54, color: '#FF7404' }} />
								<Box
									sx={{
										position: 'absolute',
										bottom: 4,
										right: -4,
										width: 22,
										height: 22,
										borderRadius: '50%',
										bgcolor: '#26477C',
										border: '2px solid #fff',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									<ScheduleIcon sx={{ fontSize: 13, color: '#fff' }} />
								</Box>
							</Box>
						</Box>
					</DialogContent>
					<DialogActions sx={{ px: { xs: 1.5, sm: 2.5 }, pb: 2.5, pt: 0.5, justifyContent: 'space-between' }}>
						<Button
							variant="outlined"
							onClick={() => setSettingsOpen(false)}
							disabled={settingsSaving}
							sx={{
								textTransform: 'none',
								fontWeight: 600,
								borderRadius: '10px',
								px: { xs: 2, sm: 3 },
								borderColor: '#e5e7eb',
								color: '#334155',
								'&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' },
							}}
						>
							Cancel
						</Button>
						<Button
							variant="contained"
							onClick={handleSaveGlobalAlertSettings}
							disabled={settingsSaving}
							startIcon={settingsSaving ? <Spinner size={18} /> : <SaveOutlinedIcon />}
							sx={{
								textTransform: 'none',
								fontWeight: 600,
								borderRadius: '10px',
								px: { xs: 2, sm: 3 },
								boxShadow: '0 2px 6px rgba(38,71,124,0.25)',
							}}
						>
							{settingsSaving ? 'Saving...' : 'Save Settings'}
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
					<Spinner />
				</Box>
			) : (
				<>
					{mobile ? (
						<DocumentMobile
							files={tableFiles}
							geotabData={geotabData}
							onOrderedFilesChange={setOrderedFiles}
						/>
					) : (
						<DocumentTable
							files={tableFiles}
							geotabData={geotabData}
							globalAlertEmail={databaseConfig?.alertEmail || ''}
							onOrderedFilesChange={setOrderedFiles}
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
				// The group picker's dropdown panel renders at document.body (outside this
				// dialog) so its search field can be focused/typed in without MUI's focus
				// trap stealing focus back.
				disableEnforceFocus
			>
				<DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eef2f7' }}>
					{editFile ? (
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
								<FileTypeGlyph fileName={editFile.fileName} size={44} iconSize={24} radius={12} />
								<Box sx={{ minWidth: 0 }}>
									<Typography
										sx={{
											fontWeight: 700,
											fontSize: 18,
											color: '#1f2937',
											lineHeight: 1.2,
											whiteSpace: 'nowrap',
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											maxWidth: { xs: 180, sm: 360, md: 520 },
										}}
									>
										{editFile.fileName}
									</Typography>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: '3px' }}>
										{editMeta && (
											<Box sx={{ px: 0.75, py: '1px', borderRadius: '6px', bgcolor: editMeta.bg, color: editMeta.color, fontSize: 11, fontWeight: 700, letterSpacing: '0.03em' }}>
												{editMeta.label}
											</Box>
										)}
										<Typography variant="caption" sx={{ color: '#94a3b8' }}>
											Edit document details
										</Typography>
									</Box>
								</Box>
							</Box>
						) : (
							<Typography sx={{ fontWeight: 700, fontSize: 18, color: '#1f2937' }}>
								Upload File
							</Typography>
						)}
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
					<Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><Spinner /></Box>}>
						<Uploader
							database={database}
							session={session}
							server={server}
							onFileUploaded={(docs) => { handleFilesUploaded(docs); setUploaderOpen(false); }}
							onValidationError={() => setValidationError(true)}
							editFile={editFile}
							onEditComplete={(id, updateDoc) => { handleFileEditComplete(id, updateDoc); setUploaderOpen(false); }}
							onCancel={() => { setUploaderOpen(false); if (editFile) setEditFile(null); }}
							onFileDeleted={handleFileDeleted}
							globalAlertEmail={databaseConfig?.alertEmail || ''}
							geotabData={geotabData}
							setGeotabData={setGeotabData}
						/>
					</Suspense>
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

			{/* Only mount (and load its chunk) once opened. */}
			{calendarOpen && (
				<Suspense fallback={null}>
					<ExpiryCalendar
						open={calendarOpen}
						onClose={() => setCalendarOpen(false)}
						files={files}
						geotabData={geotabData}
						mobile={mobile}
						onEditFile={(file) => {
							setCalendarOpen(false);
							handeEditFile(file);
						}}
						onUploadClick={() => {
							setCalendarOpen(false);
							setUploaderOpen(true);
						}}
					/>
				</Suspense>
			)}

			<FilePreview
				files={previewList}
				index={previewIndex}
				onClose={() => setPreviewFileId(null)}
				onNavigate={(i) => setPreviewFileId(previewList[i] ? previewList[i].id : null)}
				database={database}
				session={session}
				server={server}
				onValidationError={() => setValidationError(true)}
			/>
		</Box>
		</ThemeProvider>
	);
};

export default App;
