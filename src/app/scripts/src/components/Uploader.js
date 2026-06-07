import React, { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    FormControlLabel,
    RadioGroup,
    Radio,
    TextField,
    IconButton,
    Tooltip,
    Divider,
    Alert,
} from '@mui/material';
import { formatOptions, matchGeotabData, getFileTypeMeta } from '../utils/formatter';
import dayjs from 'dayjs';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Button } from '@mui/material';
import FileDropzone from './FileDropzone';
import ClearIcon from '@mui/icons-material/Clear';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import '../../../styles/app-styles.css';
import AssociateSelect from './AssociateSelect';
import GroupSelect from './GroupSelect';
import Spinner from './Spinner';



const Uploader = ({
    database,
    onFileUploaded,
    session,
    server,
    editFile,
    onEditComplete,
    onValidationError,
    onCancel,
    geotabData: geotabDataProp,
    setGeotabData: setGeotabDataProp,
}) => {
    const [uploadFiles, setUploadFiles] = useState([]);
    const geotabData = geotabDataProp || { vehicles: [], drivers: [], trailers: [], groups: [] };
    const setGeotabData = setGeotabDataProp || (() => {});
    const [uploadData, setUploadData] = useState({
        vehicles: [],
        drivers: [],
        trailers: [],
        groups: [],
    });

    const [selections, setSelections] = useState({
        vehicles: [],
        drivers: [],
        trailers: [],
        groups: [],
    });

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editName, setEditName] = useState('');
    const [fileExtension, setFileExtension] = useState('');
    const [editLoad, setEditLoad] = useState(false);
    const [expiryDate, setExpiryDate] = useState(null);
    const [alertEmail, setAlertEmail] = useState('');
    const [driverCanView, setDriverCanView] = useState(true);
    const [uploadType, setUploadType] = useState('uploadSelection');
    const [clearGroup, setClearGroup] = useState(false);
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

    const handleUpdateUploadType = (e) => {
        setUploadType(e.target.value);
        // Only the active mode is shown, so clear the other mode's data on switch.
        const emptyData = { vehicles: [], drivers: [], trailers: [], groups: [] };
        setSelections({ ...emptyData });
        setUploadData({ ...emptyData });
        clearGroups();
    };

    const handleUpdateUploadData = (type, data) => {
        setUploadData({ ...uploadData, [`${type}`]: [...data] });
    };

    const handleUpdateCurrentSelections = (selected, key) => {
        const newSelections = { ...selections, [`${key}`]: [...selected] };
        setSelections(newSelections);
    };

    const handleUpdateGroup = (newGroupData) => {
        setUploadData({ ...uploadData, groups: [...newGroupData] });
        if (clearGroup) {
            setClearGroup(false);
        }
    };

    function test(entities, result = []) {
        if (entities.childrenList === undefined) {
            return result;
        }
        result = [...result, ...entities.childrenList.map((c) => c.label)];
        for (const ele of entities.childrenList) {
            result = test(ele, result);
        }
        return result;
    }

    const organizeOwnersAndTags = () => {
        const owners = {
            vehicles: [],
            drivers: [],
            trailers: [],
            groups: [],
        };

        const tags = [];

        uploadData.vehicles.forEach((vehicle) => {
            owners.vehicles.push(vehicle.value);
            tags.push(vehicle.value);
        });

        uploadData.drivers.forEach((driver) => {
            owners.drivers.push(driver.value);
            tags.push(driver.value);
        });

        uploadData.trailers.forEach((trailer) => {
            owners.trailers.push(trailer.value);
            tags.push(trailer.value);
        });

        uploadData.groups.forEach((group) => {
            const grouptags = test(group);
            owners.groups.push(group.label, ...grouptags);
            tags.push(group.label, ...grouptags);
        });

        return { owners, tags };
    };

    function setCheckedFalse(group) {
        group.checked = false;
        if (group.childrenList === undefined) {
            return;
        }
        for (const child of group.childrenList) {
            setCheckedFalse(child);
        }
        return;
    }

    function setCheckedTrue(group, checkedOnes) {
        if (checkedOnes.findIndex((g) => g.label === group.label) !== -1) {
            group.checked = true;
        }
        if (group.childrenList === undefined) {
            return;
        }
        for (const child of group.childrenList) {
            setCheckedTrue(child, checkedOnes);
        }
        return;
    }

    const clearGroups = () => {
        const newGroupData = [...geotabData.groups];
        newGroupData.forEach((g) => {
            setCheckedFalse(g);
        });
        //setClearGroup(true);
        setGeotabData({ ...geotabData, groups: [...newGroupData] });
    };

    const clearUploadForm = () => {
        setUploadFiles([]);
        setAlertEmail('');
        setDriverCanView(true);
        const emptyData = {
            vehicles: [],
            drivers: [],
            trailers: [],
            groups: [],
        };

        setUploadData({ ...emptyData });
        setSelections({ ...emptyData });
        clearGroups();
    };

    const handleCancelEdit = () => {
        clearUploadForm();
        setEditMode(false);
    };

    const handeEditFile = async () => {
        setError('');

        if (uploadFiles.length <= 0) {
            setError(
                'Must have a file selected for upload. Please drop a file or select one above.'
            );
            return;
        }

        if (!isThereUploadData()) {
            setError(
                'Must select either a Vehicle, Driver, Trailer, or a Group to associate file to.'
            );
            return;
        }

        setLoading(true);

        try {

            const sessionInfo = {
                    database,
                    sessionId: session.sessionId,
                    userName:  session.userName,
                    server,
                };

            // Combine filename with extension
            const fullFileName = `${editName}${fileExtension}`;
            const normalizedAlertEmail = alertEmail.trim() === '' ? null : alertEmail.trim();

            const { owners, tags } = organizeOwnersAndTags();
            const messageBody = {
                session:   sessionInfo,
                database,
                fileId:    editFile.id,
                filePath:  editFile.path,
                fileName:  fullFileName,       // combined name with extension
                owners,
                tags,
                expiryDate: expiryDate ? expiryDate.toISOString() : null,
                alertEmail: normalizedAlertEmail,
                hideFromDriver: !driverCanView,
            };

            // Check if anything actually changed
            const fileNameChanged = fullFileName !== editFile.fileName;
            const expiryChanged = (expiryDate ? expiryDate.toISOString() : null) !== (editFile.expiryDate || null);
            const ownersChanged = JSON.stringify(owners) !== JSON.stringify(editFile.owners);
            const tagsChanged = JSON.stringify(tags) !== JSON.stringify(editFile.tags);
            const fileDataChanged = editName !== editFile.fileName.replace(fileExtension, '');
            const alertEmailChanged = (alertEmail.trim() || null) !== (editFile.alertEmail || null);
            const hideFromDriverChanged = (!driverCanView) !== !!editFile.hideFromDriver;

            if (!fileNameChanged && !expiryChanged && !ownersChanged && !tagsChanged && !fileDataChanged && !alertEmailChanged && !hideFromDriverChanged) {
                setError('No changes made. Please modify the file or its details before saving.');
                setLoading(false);
                return;
            }

            if (fileNameChanged) {
                const file     = uploadFiles[0];
                const base64   = await fileToBase64(file);
                messageBody.fileData    = base64;
                messageBody.contentType = file.type;
            }

             const response = await fetch(
                'https://us-central1-geotabfiles.cloudfunctions.net/editDocFile',
                {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(messageBody)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                if (data.valid === false) {
                    onValidationError()
                }

                const errorMessage = data.error || data.message || 'Edit failed';
                throw new Error(errorMessage);
            }

            clearUploadForm();
            // Force every edited field into the local row so the table reflects the save
            // immediately, regardless of which fields the backend echoes back.
            onEditComplete(editFile.id, {
                ...data,
                fileName: fullFileName,
                owners,
                tags,
                expiryDate: expiryDate ? expiryDate.toISOString() : null,
                alertEmail: normalizedAlertEmail,
                hideFromDriver: !driverCanView,
            });
            setSuccess('File successfully updated!');
            setTimeout(() => setSuccess(''), 3000);
            setEditMode(false);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const isThereUploadData = () => {
        return (
            uploadData.vehicles.length > 0 ||
            uploadData.drivers.length > 0 ||
            uploadData.trailers.length > 0 ||
            uploadData.groups.length > 0
        );
    };

    const handleUpload = async () => {
        setError('');

        if (uploadFiles.length <= 0) {
            setError(
                'Must have a file selected for upload. Please drop a file or select one above.'
            );
            return;
        }

        if (!isThereUploadData()) {
            setError(
                'Must select either a Vehicle, Driver, Trailer, or a Group to associate file to.'
            );
            return;
        }

        setLoading(true);

        Promise.all(
            uploadFiles.map((file) => uploadFile(file.filename, file.file))
        )
            .then((docs) => {
                setSuccess('All Files Successfully uploaded');
                clearUploadForm();

                onFileUploaded(docs);

                setTimeout(() => {
                    setSuccess('');
                }, 3000);
            })
            .catch((error) => {
                console.log('Some failed: ', error);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
            // reader.result is "data:<mime>;base64,AAAA…"
            const dataUrl = reader.result;
            const base64  = dataUrl.split(',')[1];
            resolve(base64);
        };
        reader.readAsDataURL(file);
    });

    const uploadFile = async (filename, file) => {
        const base64 = await fileToBase64(file);
        const normalizedAlertEmail = alertEmail.trim() === '' ? null : alertEmail.trim();

        const sessionInfo = {
            database,
            sessionId: session.sessionId,
            userName:  session.userName,
            server
        };

        const { owners, tags } = organizeOwnersAndTags();

        const messageBody = {
            session: sessionInfo,
            database,
            fileName: filename,
            fileData: base64,
            contentType: file.type,
            owners: owners,
            tags: tags,
            expiryDate: expiryDate ? expiryDate.toISOString() : undefined,
            alertEmail: normalizedAlertEmail,
            hideFromDriver: !driverCanView,
        };

         const response = await fetch(
            'https://us-central1-geotabfiles.cloudfunctions.net/uploadDocFile',
            {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(messageBody)
            }
        );
        if (!response.ok) {
            const errorData = await response.json();

            if (errorData.valid === false) {
               onValidationError();
            }

           console.error('Upload File failed: ', errorData.error ? errorData.error : '');
        }
        const responseData = await response.json();
        return { ...responseData, alertEmail: normalizedAlertEmail, hideFromDriver: !driverCanView };
    };

    useEffect(() => {
  if (editFile === null) return;

  const fetchEditFile = async () => {
    try {
      const sessionInfo = {
        database,
        sessionId: session.sessionId,
        userName:  session.userName,
        server,
      };
      const messageBody = {
        session:  sessionInfo,
        filePath: editFile.path,
        fileName: editFile.fileName,
      };

      setEditLoad(true);

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
        if (errorData.valid === false) {
          onValidationError();
        }
        console.error('Failed to fetch edit file:', errorData.error || '');
        return;
      }

      // Turn the streamed bytes back into a File
      const blob      = await response.blob();
      const fileToEdit = new File([blob], editFile.fileName);

      // Rehydrate your owners/tags state exactly as before
      const dataVehicles = editFile.owners.vehicles.map(v => `${v}`);
      const dataDrivers  = editFile.owners.drivers .map(d => `${d}`);
      const dataTrailers = editFile.owners.trailers.map(t => `${t}`);
      const dataGroups   = editFile.owners.groups  .map(g => `${g}`);

      if (dataGroups.length === 0) {
        setUploadType('uploadSelection');
        setSelections({
          vehicles: [...matchGeotabData(dataVehicles,'vehicles',geotabData)],
          drivers:  [...matchGeotabData(dataDrivers,'drivers',geotabData)],
          trailers: [...matchGeotabData(dataTrailers,'trailers',geotabData)],
          groups:   [...formatOptions(dataGroups)],
        });
      } else {
        setUploadType('uploadGroup');
        const newGroupData = [...geotabData.groups];
        newGroupData.forEach(g => setCheckedTrue(g, [...formatOptions(dataGroups)]));
        setGeotabData({ ...geotabData, groups: newGroupData });
      }

      setUploadData({
        vehicles: [...matchGeotabData(dataVehicles,'vehicles',geotabData)],
        drivers:  [...matchGeotabData(dataDrivers,'drivers',geotabData)],
        trailers: [...matchGeotabData(dataTrailers,'trailers',geotabData)],
        groups:   [...formatOptions(dataGroups)],
      });

      setUploadFiles([fileToEdit]);

      // Extract extension and filename separately
      const lastDotIndex = editFile.fileName.lastIndexOf('.');
      const nameWithoutExt = lastDotIndex > 0 ? editFile.fileName.substring(0, lastDotIndex) : editFile.fileName;
      const ext = lastDotIndex > 0 ? editFile.fileName.substring(lastDotIndex) : '';

      setEditName(nameWithoutExt);
      setFileExtension(ext);

      if (editFile.expiryDate) {
        setExpiryDate(dayjs(editFile.expiryDate));
      } else {
        setExpiryDate(null);
      }

            setAlertEmail(editFile.alertEmail || '');
                        setDriverCanView(editFile.hideFromDriver ? false : true);

 
      setEditMode(true);

      // scroll into view
      document.getElementById('upload-area')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    } catch (err) {
      console.error('Error in fetchEditFile:', err);
    } finally {
        setEditLoad(false);
    }
  };

  fetchEditFile();
}, [editFile]);

    // Build a small thumbnail when the selected/edited file is an image. Reuses the
    // already-fetched blob in uploadFiles[0], so no extra request is made.
    useEffect(() => {
        const file = uploadFiles[0];
        if (file && getFileTypeMeta(file.name).kind === 'image') {
            const url = URL.createObjectURL(file);
            setImagePreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
        setImagePreviewUrl(null);
        return undefined;
    }, [uploadFiles]);

    const sectionCardSx = {
        width: '100%',
        maxWidth: 720,
        mx: 'auto',
        mt: 2,
        p: 2,
        border: '1px solid #e8edf3',
        borderRadius: '14px',
        bgcolor: '#fff',
        boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.25,
    };

    const sectionTitleSx = {
        width: '100%',
        fontSize: 12,
        fontWeight: 700,
        color: '#94a3b8',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
    };

    return (
        <Box className="geotabToolbar" id="upload-area">
        {editLoad ? (
            <Box sx={{height: '250px', display: 'flex', justifyContent: 'center', alignItems: 'center'}}> <Spinner /></Box>
        ) : (
            <>
            <Box sx={sectionCardSx}>
                <Typography sx={sectionTitleSx}>File details</Typography>
 {!editMode ? (
             <>
                <FileDropzone
                    files={uploadFiles}
                    onChange={setUploadFiles}
                    multiple
                />
                    
                </>
            ) : (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginTop: '0.75rem',
                    }}
                >
                    {imagePreviewUrl ? (
                        <Box
                            component="img"
                            src={imagePreviewUrl}
                            alt={editName}
                            sx={{
                                maxHeight: 120,
                                maxWidth: '100%',
                                objectFit: 'contain',
                                borderRadius: '10px',
                                border: '1px solid #e5e7eb',
                                bgcolor: '#f8fafc',
                                p: 0.5,
                            }}
                        />
                    ) : null}
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginTop: '0.25rem',
                            width: '100%',
                        }}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '0.5rem',
                                width: '100%',
                            }}
                        >
                            <TextField
                                label="File Name"
                                variant="outlined"
                                value={editName}
                                sx={{ width: { xs: '100%', sm: '95%', md: '85%' } }}
                                onChange={(e) => setEditName(e.target.value)}
                            />
                            <Typography sx={{ fontWeight: 'bold', minWidth: 'fit-content' }}>
                                {fileExtension}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            )}

            {/* Driver visibility — shown for both new uploads and edits */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        px: 2,
                        py: 0.75,
                        bgcolor: '#f8fafc',
                    }}
                >
                    {driverCanView ? (
                        <VisibilityIcon sx={{ color: '#1B7A3D' }} fontSize="small" />
                    ) : (
                        <VisibilityOffIcon sx={{ color: '#94a3b8' }} fontSize="small" />
                    )}
                    <Tooltip title="Choose whether the driver can see this document" arrow>
                        <Typography sx={{ fontWeight: 600, color: '#334155' }}>
                            Visible to driver
                        </Typography>
                    </Tooltip>
                    <RadioGroup
                        row
                        value={driverCanView ? 'yes' : 'no'}
                        onChange={(e) => setDriverCanView(e.target.value === 'yes')}
                        sx={{ ml: 0.5 }}
                    >
                        <FormControlLabel
                            value="yes"
                            control={<Radio color="primary" size="small" />}
                            label="Yes"
                        />
                        <FormControlLabel
                            value="no"
                            control={<Radio color="primary" size="small" />}
                            label="No"
                            sx={{ mr: 0 }}
                        />
                    </RadioGroup>
                </Box>
            </Box>
            </Box>{/* end File details card */}

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '1rem',
                }}
            >
                <Box sx={sectionCardSx}>
                <Typography sx={sectionTitleSx}>Associations</Typography>
                <RadioGroup
                    row
                    name="row-radio-buttons-group"
                    onChange={handleUpdateUploadType}
                    value={uploadType}
                    sx={{ justifyContent: 'center', gap: 3, mb: 0.5 }}
                >
                    <FormControlLabel
                        value="uploadGroup"
                        control={<Radio />}
                        label="Upload By Group"
                    />
                    <FormControlLabel
                        value="uploadSelection"
                        control={<Radio />}
                        label="Upload By Selection"
                    />
                </RadioGroup>

                {uploadType === 'uploadGroup' ? (
                    <Box sx={{ width: { xs: '100%', md: '80%' } }}>
                        <GroupSelect
                            groupData={geotabData.groups}
                            uploadType={uploadType}
                            onUpdateData={handleUpdateGroup}
                            forceClear={clearGroup}
                        />
                    </Box>
                ) : (
                    <Box
                        sx={{
                            width: '100%',
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'column', md: 'row' },
                            justifyContent: 'center',
                            gap: '1.5rem',
                            px: '0.5rem',
                        }}
                    >
                        <AssociateSelect
                            options={geotabData.vehicles}
                            label="Vehicle"
                            currentSelections={selections.vehicles}
                            onUpdateCurrentSelections={(selected) => {
                                handleUpdateCurrentSelections(selected, 'vehicles');
                            }}
                            onUpdateUploadSelections={(data) =>
                                handleUpdateUploadData('vehicles', data)
                            }
                        />
                        <AssociateSelect
                            options={geotabData.drivers}
                            label="Driver"
                            currentSelections={selections.drivers}
                            onUpdateCurrentSelections={(selected) => {
                                handleUpdateCurrentSelections(selected, 'drivers');
                            }}
                            onUpdateUploadSelections={(data) =>
                                handleUpdateUploadData('drivers', data)
                            }
                        />
                        <AssociateSelect
                            options={geotabData.trailers}
                            label="Trailer"
                            currentSelections={selections.trailers}
                            onUpdateCurrentSelections={(selected) => {
                                handleUpdateCurrentSelections(selected, 'trailers');
                            }}
                            onUpdateUploadSelections={(data) =>
                                handleUpdateUploadData('trailers', data)
                            }
                        />
                    </Box>
                )}
                </Box>{/* end Associations card */}

                <Box sx={{ width: { xs: '100%', md: '75%' }, mt: 0.5 }}>
                    <Divider sx={{ '&::before, &::after': { borderColor: '#e5e7eb' } }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em' }}>
                            EXPIRATION (OPTIONAL)
                        </Typography>
                    </Divider>
                </Box>

                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <Box
                        sx={{
                            width: { xs: '100%', sm: '100%', md: '75%' },
                            display: 'flex',
                            flexDirection: {
                                xs: 'column',
                                sm: 'column',
                                md: 'row',
                            },
                            alignItems: {
                                xs: 'stretch',
                                sm: 'stretch',
                                md: 'center',
                            },
                            justifyContent: 'center',
                            gap: '1rem',
                            marginBottom: '1rem',
                        }}
                    >
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                                label="File Expire Date"
                                value={expiryDate}
                                onChange={(newValue) => {
                                    setExpiryDate(newValue);
                                }}
                                slotProps={{ textField: { size: 'small' } }}
                            />
                        </LocalizationProvider>
                        <Tooltip title="Clear expiry date">
                            <IconButton
                                size="small"
                                onClick={() => setExpiryDate(null)}
                                disabled={!expiryDate}
                                color="secondary"
                            >
                                <ClearIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        {expiryDate ? (
                            <TextField
                                label="Expiration email alert"
                                value={alertEmail}
                                onChange={(e) => setAlertEmail(e.target.value)}
                                size="small"
                                sx={{
                                    width: { xs: '100%', sm: '100%', md: '280px' },
                                }}
                            />
                        ) : null}
                    </Box>
                </Box>
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                    {loading ? (
                        <Spinner />
                    ) : (
                        <>
                            {editMode ? (
                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexDirection: { xs: 'column-reverse', sm: 'row' },
                                        gap: 1.5,
                                    }}
                                >
                                    <Button
                                        variant="outlined"
                                        onClick={() => (onCancel ? onCancel() : handleCancelEdit())}
                                        sx={{
                                            textTransform: 'none',
                                            fontWeight: 600,
                                            borderRadius: '10px',
                                            px: 3,
                                            borderColor: '#e5e7eb',
                                            color: '#334155',
                                            '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' },
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={handeEditFile}
                                        startIcon={<SaveOutlinedIcon />}
                                        sx={{
                                            textTransform: 'none',
                                            fontWeight: 600,
                                            borderRadius: '10px',
                                            px: 4,
                                            boxShadow: '0 2px 6px rgba(38,71,124,0.25)',
                                        }}
                                    >
                                        Save Changes
                                    </Button>
                                </Box>
                            ) : (
                                <Button
                                    variant="contained"
                                    onClick={handleUpload}
                                    startIcon={<CloudUploadIcon />}
                                    sx={{
                                        textTransform: 'none',
                                        fontWeight: 700,
                                        fontSize: '16px',
                                        borderRadius: '10px',
                                        px: 4,
                                        py: 1,
                                        boxShadow: '0 2px 6px rgba(38,71,124,0.25)',
                                    }}
                                >
                                    Upload
                                </Button>
                            )}
                        </>
                    )}
                </Box>

                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', px: 2 }}>
                    {error !== '' && (
                        <Alert severity="error" sx={{ borderRadius: '10px', width: '100%', maxWidth: 520 }}>
                            {error}
                        </Alert>
                    )}
                    {success !== '' && (
                        <Alert severity="success" sx={{ borderRadius: '10px', width: '100%', maxWidth: 520 }}>
                            {success}
                        </Alert>
                    )}
                </Box>
            </Box>
            </>
        )}
           
        </Box>
    );
};

export default Uploader;
