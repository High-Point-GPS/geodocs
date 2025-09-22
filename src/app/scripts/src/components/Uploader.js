import React, { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    FormControlLabel,
    RadioGroup,
    Radio,
    TextField,
    Switch,
    IconButton,
    Tooltip
} from '@mui/material';
import { formatGeotabData, formatOptions } from '../utils/formatter';
import dayjs from 'dayjs';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Button } from '@mui/material';
import { FilePond } from 'react-filepond';
import '../../../styles/app-styles.css';
import AssociateSelect from './AssociateSelect';
import GroupSelect from './GroupSelect';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'; 


const Uploader = ({
    database,
    onFileUploaded,
    api,
    session,
    server,
    editFile,
    onEditComplete,
    onValidationError,
    databaseConfig
}) => {
    const [uploadFiles, setUploadFiles] = useState([]);
    const [geotabData, setGeotabData] = useState({
        vehicles: [],
        drivers: [],
        trailers: [],
        groups: [],
    });
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
    const [editLoad, setEditLoad] = useState(false);
    const [hasExpiry, setHasExpiry] = useState(false);
    const [expiryDate, setExpiryDate] = useState(dayjs());
    const [uploadType, setUploadType] = useState('uploadGroup');
    const [clearGroup, setClearGroup] = useState(false);

    const handleUpdateUploadType = (e) => {
        setUploadType(e.target.value);
        setSelections({
            vehicles: [],
            drivers: [],
            trailers: [],
            groups: [],
        });
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

        if (!isThereUploadData() === '') {
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

            const { owners, tags } = organizeOwnersAndTags();
            const messageBody = {
                session:   sessionInfo,
                database,
                fileId:    editFile.id,
                filePath:  editFile.path,
                fileName:  editName,       // new name
                owners,
                tags,
            };

            if (hasExpiry) {
                messageBody.expiryDate = expiryDate.toISOString();
            }

            if (editName !== editFile.fileName) {
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

                throw new Error(err.error || 'Upload failed');
            }

            clearUploadForm();
            onEditComplete(editFile.id, data);
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
            expiryDate: hasExpiry ? expiryDate.toISOString() : undefined
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

           console.error('Fetched Files failed: ', errorData.error ? errorData.error : '');
        }
        return response.json();
    };

    const findDevice = (inputDevice, billingDevices) => {
        return billingDevices.findIndex(x => x.serialNumber === inputDevice.serialNumber) !== -1;
    }

    useEffect(() => {
        if (api) {
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
                    const trailerNames = results[2].map(t => t.id);
                    let activeTrailers = results[0].filter(res => {
                        const isActive = new Date(res.activeTo) > new Date();
                        const isId = res.tmpTrailerId && trailerNames.findIndex(t => t === res.tmpTrailerId) !== -1
                        return isActive && isId;
                    });

                    if (!databaseConfig.directBilling) {
                        api.call('Get', { typeName: 'AddInDeviceLink',
                        search: {
                            addInSearch: {
                                configuration: {
                                    solutionId: 'geotabInc.SoftwareOrderNowTestSolution'
                                }
                            }
                        },
                        credentials: {
                            database: database,
                            sessionId: session.sessionId,
                            userName:  session.userName,
                        }
                        },(result) => {
                                const marketDevices = result.map(x => {
                                return {
                                    ...x.device
                                }
                            });

                            filteredDevices = filteredDevices.filter(res => findDevice(res, marketDevices));
                            activeTrailers = activeTrailers.filter(res => findDevice(res, marketDevices));

                              const formatedData = formatGeotabData(
                                filteredDevices,
                                results[1],
                                activeTrailers,
                                results[3]
                            );
                            setGeotabData(formatedData);
                        },  function (error) {
                            const formatedData = formatGeotabData(
                                filteredDevices,
                                results[1],
                                activeTrailers,
                                results[3]
                            );
                            setGeotabData(formatedData);
                        } )

                      
                    } else {
                        const formatedData = formatGeotabData(
                            filteredDevices,
                            results[1],
                            activeTrailers,
                            results[3]
                        );
                        setGeotabData(formatedData);
                    }
                
                },
                function (error) {
                    console.log(error);
                }
            );
        }
    }, [api]);

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
          setValidationError(true);
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
          vehicles: [...formatOptions(dataVehicles)],
          drivers:  [...formatOptions(dataDrivers)],
          trailers: [...formatOptions(dataTrailers)],
          groups:   [...formatOptions(dataGroups)],
        });
      } else {
        setUploadType('uploadGroup');
        const newGroupData = [...geotabData.groups];
        newGroupData.forEach(g => setCheckedTrue(g, [...formatOptions(dataGroups)]));
        setGeotabData({ ...geotabData, groups: newGroupData });
      }

      setUploadData({
        vehicles: [...formatOptions(dataVehicles)],
        drivers:  [...formatOptions(dataDrivers)],
        trailers: [...formatOptions(dataTrailers)],
        groups:   [...formatOptions(dataGroups)],
      });

      setUploadFiles([fileToEdit]);

      if (editFile.expiryDate) {
        setHasExpiry(true);
        setExpiryDate(dayjs(editFile.expiryDate));
      } else {
        setHasExpiry(false);
      }

 
      setEditMode(true);
      setEditName(editFile.fileName);

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


    return (
        <Box className="geotabToolbar" id="upload-area">
        {editLoad ? (
            <Box sx={{height: '250px', display: 'flex', justifyContent: 'center', alignItems: 'center'}}> <CircularProgress /></Box>
        ) : (
            <>
 {!editMode ? (
             <>
                <FilePond
                    files={uploadFiles}
                    onupdatefiles={setUploadFiles}
                    allowMultiple={editMode ? false : true}
                    name="files" /* sets the file input name, it's filepond by default */
                    labelIdle='Drag & Drop your files or <span class="filepond--label-action">Browse</span>'
                />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                        <Tooltip title="More Info" arrow>
                            <IconButton
                                aria-label="Help"
                                onClick={() => window.open('https://www.highpointgps.com/geodocs/', '_blank')}
                                size="large"
                                color='primary'
                            >
                                <HelpOutlineIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </>
            ) : (
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <TextField
                        label="Rename File"
                        variant="outlined"
                        value={editName}
                        sx={{ width: { xs: '90%', sm: '80%', md: '55%' } }}
                        onChange={(e) => setEditName(e.target.value)}
                    />
                </Box>
            )}

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '1rem',
                }}
            >
                <Box
                    sx={{
                        width: { xs: '100%', sm: '100%', md: '75%' },
                        display: 'flex',
                        flexDirection: {
                            xs: 'column',
                            sm: 'column',
                            md: 'row',
                        },
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: { xs: '1rem', sm: '1rem', md: '2rem' },
                    }}
                >
                    <RadioGroup
                        name="row-radio-buttons-group"
                        onChange={handleUpdateUploadType}
                        defaultValue={'uploadGroup'}
                        value={uploadType}
                    >
                        <Box sx={{ display: 'flex', gap: '2.5rem' }}>
                            <FormControlLabel
                                value="uploadGroup"
                                control={<Radio />}
                                label="Upload By Group"
                            />
                        </Box>
                        <Box>
                            <FormControlLabel
                                value="uploadSelection"
                                control={<Radio />}
                                label="Upload By Selection"
                            />
                        </Box>
                    </RadioGroup>
                    <GroupSelect
                        groupData={geotabData.groups}
                        uploadType={uploadType}
                        onUpdateData={handleUpdateGroup}
                        forceClear={clearGroup}
                    />
                </Box>

                <Box
                    sx={{
                        paddingLeft: '1.5rem',
                        paddingRight: '1.5rem',
                        width: '100%',
                        display: 'flex',
                        flexDirection: {
                            xs: 'column',
                            sm: 'column',
                            md: 'row',
                        },
                        justifyContent: 'center',
                        gap: '2rem',
                    }}
                >
                    <AssociateSelect
                        options={geotabData.vehicles}
                        label="Vehicle"
                        currentSelections={selections.vehicles}
                        onUpdateCurrentSelections={(selections) => {
                            handleUpdateCurrentSelections(
                                selections,
                                'vehicles'
                            );
                        }}
                        onUpdateUploadSelections={(data) =>
                            handleUpdateUploadData('vehicles', data)
                        }
                        isDisabled={uploadType !== 'uploadSelection'}
                    />
                    <AssociateSelect
                        options={geotabData.drivers}
                        label="Driver"
                        currentSelections={selections.drivers}
                        onUpdateCurrentSelections={(selections) => {
                            handleUpdateCurrentSelections(
                                selections,
                                'drivers'
                            );
                        }}
                        onUpdateUploadSelections={(data) =>
                            handleUpdateUploadData('drivers', data)
                        }
                        isDisabled={uploadType !== 'uploadSelection'}
                    />
                    <AssociateSelect
                        options={geotabData.trailers}
                        label="Trailer"
                        currentSelections={selections.trailers}
                        onUpdateCurrentSelections={(selections) => {
                            handleUpdateCurrentSelections(
                                selections,
                                'trailers'
                            );
                        }}
                        onUpdateUploadSelections={(data) =>
                            handleUpdateUploadData('trailers', data)
                        }
                        isDisabled={uploadType !== 'uploadSelection'}
                    />
                </Box>
                <Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'Center',
                            gap: '1rem',
                            marginBottom: '1rem',
                        }}
                    >
                        <Typography>Has Expiry Date</Typography>
                        <Switch
                            checked={hasExpiry}
                            value={hasExpiry}
                            onChange={(e) => setHasExpiry(e.target.checked)}
                        />
                    </Box>
                    {hasExpiry && (
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                                label="File Expire Date"
                                value={expiryDate}
                                onChange={(newValue) => {
                                    setExpiryDate(newValue);
                                    console.log(newValue);
                                }}
                            />
                        </LocalizationProvider>
                    )}
                </Box>
                <Box>
                    {loading ? (
                        <CircularProgress />
                    ) : (
                        <>
                            {editMode ? (
                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexDirection: {
                                            xs: 'column',
                                            sm: 'row',
                                        },
                                        gap: { xs: '1rem', sm: '0.5rem' },
                                    }}
                                >
                                    <Button
                                        variant="contained"
                                        onClick={handeEditFile}
                                    >
                                        Save
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="error"
                                        onClick={handleCancelEdit}
                                    >
                                        Cancel
                                    </Button>
                                </Box>
                            ) : (
                                <Button
                                    variant="contained"
                                    onClick={handleUpload}
                                    sx={{
                                        fontWeight: 'bold',
                                        fontSize: '18px',
                                    }}
                                >
                                    Upload
                                </Button>
                            )}
                        </>
                    )}
                </Box>

                <Box>
                    {error !== '' && (
                        <Typography className="errorText">{error}</Typography>
                    )}
                    {success !== '' && (
                        <Typography className="successText">
                            {success}
                        </Typography>
                    )}
                </Box>
            </Box>
            </>
        )}
           
        </Box>
    );
};

export default Uploader;
