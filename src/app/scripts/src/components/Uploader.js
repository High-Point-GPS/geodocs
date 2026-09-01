import React, { useEffect, useState, useRef } from 'react';
import {
    Box,
    Typography,
    FormControlLabel,
    RadioGroup,
    Radio,
    TextField,
    Tooltip,
    Alert,
    AlertTitle,
    InputAdornment,
    Autocomplete,
    CircularProgress,
} from '@mui/material';
import {
    formatOptions,
    matchGeotabData,
    getFileTypeMeta,
    collapseCompanyGroup,
    isCompanyGroupLabel,
} from '../utils/formatter';
import dayjs from 'dayjs';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Button } from '@mui/material';
import FileDropzone from './FileDropzone';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import '../../../styles/app-styles.css';
import AssociateSelect from './AssociateSelect';
import GroupSelect from './GroupSelect';
import Spinner from './Spinner';
import Popup from './Popup';
import EmailChipsInput, { splitEmails } from './EmailChipsInput';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';

// File types GeoDocs accepts (matches the backend validator). Setting these as the file
// input's `accept` makes mobile pickers expose the Files/document picker (so PDFs and docs
// are selectable), instead of defaulting to camera/gallery only.
const ACCEPTED_FILE_ACCEPT = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/heic',
    'image/heif',
    'image/webp',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.txt',
    '.ppt', '.pptx', '.heic', '.heif', '.webp',
].join(',');

const Uploader = ({
    database,
    onFileUploaded,
    session,
    server,
    editFile,
    onEditComplete,
    onValidationError,
    onCancel,
    onFileDeleted,
    globalAlertEmail = '',
    documentTypes = [],
    onAddDocumentType,
    geotabData: geotabDataProp,
    setGeotabData: setGeotabDataProp,
    geotabAssets = {},
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
    const [errorTitle, setErrorTitle] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editName, setEditName] = useState('');
    const [fileExtension, setFileExtension] = useState('');
    const [editLoad, setEditLoad] = useState(false);
    const [expiryDate, setExpiryDate] = useState(null);
    const [alertEmail, setAlertEmail] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deleteLoad, setDeleteLoad] = useState(false);
    const [driverCanView, setDriverCanView] = useState(true);
    // What the document IS, from the fleet's own list (Fleet Settings), plus a free note.
    // Both optional here — a fleet that hasn't defined any types just doesn't see the field.
    const [documentType, setDocumentType] = useState('');
    const [description, setDescription] = useState('');
    // Creating a type inline writes to the fleet config, so it can fail and has to say so.
    const [addingType, setAddingType] = useState(false);
    const [typeError, setTypeError] = useState('');
    // "Replace file" in the edit dialog: when the user picks a new file we swap it into
    // uploadFiles[0] and flag it, so the save sends the new bytes (editDocFile overwrites
    // the stored object in place, keeping the same record/associations/alerts). The original
    // file + extension are kept in refs so "Use original" can undo without a re-download.
    const [fileReplaced, setFileReplaced] = useState(false);
    const [replaceOpen, setReplaceOpen] = useState(false);
    const originalFileRef = useRef(null);
    const originalExtRef = useRef('');

    // Delete from the edit dialog — same backend call as the table's delete action.
    const handleDeleteFile = async () => {
        if (!editFile) return;
        // Captured up front: the callbacks below unmount this dialog and clear editFile.
        const fileId = editFile.id;
        const filePath = editFile.path;
        try {
            setDeleteLoad(true);
            const sessionInfo = {
                database,
                sessionId: session.sessionId,
                userName: session.userName,
                server,
            };

            const response = await fetch(
                'https://us-central1-geotabfiles.cloudfunctions.net/deleteDocFile',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        session: sessionInfo,
                        database,
                        fileId,
                        filePath,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                if (data.valid === false && onValidationError) {
                    onValidationError();
                }
                console.error('Delete failed:', data.error || '');
                setDeleteLoad(false);
                setDeleteConfirm(false);
                setErrorTitle('Could not delete file');
                setError(data.error || 'Delete failed. Please try again.');
                return;
            }

            // Reset local state before the callbacks unmount this dialog.
            setDeleteLoad(false);
            setDeleteConfirm(false);
            if (onFileDeleted) onFileDeleted(fileId);
            if (onCancel) onCancel();
        } catch (err) {
            console.error('Delete error:', err);
            setDeleteLoad(false);
            setDeleteConfirm(false);
            setErrorTitle('Could not delete file');
            setError('Delete failed. Please check your connection and try again.');
        }
    };
    const [uploadType, setUploadType] = useState('uploadSelection');
    const [clearGroup, setClearGroup] = useState(false);
    // The stored default may use any delimiters/casing ("a@x.com;B@y.com"); normalize it
    // for display the same way the chips inputs do.
    const globalAlertEmailDisplay = splitEmails(globalAlertEmail)
        .map((e) => e.toLowerCase())
        .join(', ');

    // Per-file alert addresses matching the global default are redundant — the global
    // is the fallback recipient when a file has no alert email of its own — so they
    // are dropped from anything we save.
    const normalizeAlertEmailForSave = (str) => {
        const globals = new Set(splitEmails(globalAlertEmail).map((e) => e.toLowerCase()));
        const kept = splitEmails(str).filter((e) => !globals.has(e.toLowerCase()));
        return kept.length ? kept.join(', ') : null;
    };
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
    // The error/success alert sits at the foot of a tall form (below the action button),
    // so on a small screen it lands below the dialog's visible area. We scroll it into
    // view whenever a message appears so the user never has to hunt for it.
    const alertRef = useRef(null);

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
        let groups = [...newGroupData];

        // "Company Group" is the root: selecting it includes every other group, so any
        // other top-level selection is redundant — collapse to just it. (Its childrenList
        // is still expanded into the stored owners/tags, so driver visibility is intact;
        // the picker manages its own checkbox state, so no tree mutation here.)
        const company = groups.find((g) => isCompanyGroupLabel(g.label));
        if (company && groups.length > 1) {
            groups = [company];
        }

        setUploadData({ ...uploadData, groups });
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

        // Human-readable display names parallel to `owners` (which holds Geotab IDs for
        // vehicles/drivers/trailers). Saved alongside so the daily expiry email can show
        // names without a Geotab session. Groups are already stored by name.
        const ownerNames = {
            vehicles: [],
            drivers: [],
            trailers: [],
            groups: [],
        };

        const tags = [];

        uploadData.vehicles.forEach((vehicle) => {
            owners.vehicles.push(vehicle.value);
            ownerNames.vehicles.push(vehicle.label);
            tags.push(vehicle.value);
        });

        uploadData.drivers.forEach((driver) => {
            owners.drivers.push(driver.value);
            ownerNames.drivers.push(driver.label);
            tags.push(driver.value);
        });

        uploadData.trailers.forEach((trailer) => {
            owners.trailers.push(trailer.value);
            ownerNames.trailers.push(trailer.label);
            tags.push(trailer.value);
        });

        uploadData.groups.forEach((group) => {
            const grouptags = test(group);
            owners.groups.push(group.label, ...grouptags);
            ownerNames.groups.push(group.label, ...grouptags);
            tags.push(group.label, ...grouptags);
        });

        return { owners, tags, ownerNames };
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
        setDocumentType('');
        setDescription('');
        setFileReplaced(false);
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

    // Edit dialog: user picked a replacement file. FileDropzone emits { filename, file }
    // wrappers, but the edit-save path (and the image preview) expect a raw File in
    // uploadFiles[0], so unwrap to the raw File. Adopt the replacement's extension (its type
    // may differ from the original) while keeping the curated base name in the name field.
    const handleReplaceFile = (items) => {
        const wrapped = Array.isArray(items) ? items[items.length - 1] : null;
        const raw = wrapped && wrapped.file ? wrapped.file : null;
        if (!raw) return;
        setUploadFiles([raw]);
        setFileReplaced(true);
        const dot = raw.name.lastIndexOf('.');
        const newExt = dot > 0 ? raw.name.substring(dot) : '';
        // Keep the document's original extension if the replacement has none (e.g. a
        // drag-dropped file named "renewed") so we never silently strip ".pdf".
        setFileExtension(newExt || originalExtRef.current || '');
    };

    // Undo a pending replacement — restore the originally-loaded file/extension (kept in refs,
    // so no re-download).
    const handleUseOriginalFile = () => {
        if (originalFileRef.current) setUploadFiles([originalFileRef.current]);
        setFileExtension(originalExtRef.current);
        setFileReplaced(false);
        setReplaceOpen(false);
    };

    const handeEditFile = async () => {
        setError('');
        setErrorTitle('');

        if (uploadFiles.length <= 0) {
            setError(
                'Must have a file selected for upload. Please drop a file or select one above.'
            );
            return;
        }

        if (!isThereUploadData()) {
            setErrorTitle('Add an association');
            setError(
                'Link this file to at least one Vehicle, Driver, Trailer, or Group before saving.'
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
            const normalizedAlertEmail = normalizeAlertEmailForSave(alertEmail);

            const { owners, tags, ownerNames } = organizeOwnersAndTags();
            const messageBody = {
                session:   sessionInfo,
                database,
                fileId:    editFile.id,
                filePath:  editFile.path,
                fileName:  fullFileName,       // combined name with extension
                owners,
                ownerNames,
                tags,
                expiryDate: expiryDate ? expiryDate.toISOString() : null,
                alertEmail: normalizedAlertEmail,
                hideFromDriver: !driverCanView,
                // Always sent (even empty) so clearing the type actually clears it.
                documentType: documentType || null,
                description: description || null,
            };

            // Check if anything actually changed
            const fileNameChanged = fullFileName !== editFile.fileName;
            const expiryChanged = (expiryDate ? expiryDate.toISOString() : null) !== (editFile.expiryDate || null);
            const ownersChanged = JSON.stringify(owners) !== JSON.stringify(editFile.owners || {});
            const tagsChanged = JSON.stringify(tags) !== JSON.stringify(editFile.tags || []);
            const fileDataChanged = editName !== editFile.fileName.replace(fileExtension, '');
            // Compare as normalized lists so delimiter/case differences in stored
            // values ("a@x.com;B@y.com" vs "a@x.com, b@y.com") don't read as changes.
            const normalizeEmailList = (str) =>
                splitEmails(str).map((e) => e.toLowerCase()).join(', ') || null;
            const alertEmailChanged = normalizeEmailList(alertEmail) !== normalizeEmailList(editFile.alertEmail);
            const hideFromDriverChanged = (!driverCanView) !== !!editFile.hideFromDriver;
            const documentTypeChanged = (documentType || '') !== (editFile.documentType || '');
            const descriptionChanged = (description || '') !== (editFile.description || '');

            if (!fileNameChanged && !expiryChanged && !ownersChanged && !tagsChanged && !fileDataChanged && !alertEmailChanged && !hideFromDriverChanged && !documentTypeChanged && !descriptionChanged && !fileReplaced) {
                setError('No changes made. Please modify the file or its details before saving.');
                setLoading(false);
                return;
            }

            // Send the new bytes when the user renamed the file OR replaced it. editDocFile
            // overwrites the stored object in place when the name is unchanged, or repoints
            // the path (and deletes the old object) when the name/extension changed.
            if (fileNameChanged || fileReplaced) {
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

            // Parse defensively: an oversized upload (413) or a platform error returns a
            // non-JSON body, so response.json() would throw a cryptic "Unexpected token <".
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                if (data.valid === false) {
                    onValidationError()
                }

                if (response.status === 413) {
                    throw new Error('This file is too large to upload. Please choose a smaller file.');
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
                ownerNames,
                tags,
                expiryDate: expiryDate ? expiryDate.toISOString() : null,
                alertEmail: normalizedAlertEmail,
                hideFromDriver: !driverCanView,
                documentType: documentType || null,
                description: description || null,
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
        setErrorTitle('');

        if (uploadFiles.length <= 0) {
            setError(
                'Must have a file selected for upload. Please drop a file or select one above.'
            );
            return;
        }

        if (!isThereUploadData()) {
            setErrorTitle('Add an association');
            setError(
                'Link this file to at least one Vehicle, Driver, Trailer, or Group before uploading.'
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
        const normalizedAlertEmail = normalizeAlertEmailForSave(alertEmail);

        const sessionInfo = {
            database,
            sessionId: session.sessionId,
            userName:  session.userName,
            server
        };

        const { owners, tags, ownerNames } = organizeOwnersAndTags();

        const messageBody = {
            session: sessionInfo,
            database,
            fileName: filename,
            fileData: base64,
            contentType: file.type,
            owners: owners,
            ownerNames: ownerNames,
            tags: tags,
            expiryDate: expiryDate ? expiryDate.toISOString() : undefined,
            alertEmail: normalizedAlertEmail,
            hideFromDriver: !driverCanView,
            documentType: documentType || undefined,
            description: description || undefined,
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
        return {
            ...responseData,
            alertEmail: normalizedAlertEmail,
            hideFromDriver: !driverCanView,
            documentType: documentType || null,
            description: description || null,
            ownerNames,
        };
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
        responseMode: 'url',
      };

      setEditLoad(true);

      const response = await fetch(
        'https://us-central1-geotabfiles.cloudfunctions.net/readDocFileUrl',
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

      // New backend returns { url } (signed URL); legacy streams the bytes. We need the
      // actual bytes to rebuild a File for the edit form, so in URL mode fetch the object
      // directly from GCS (cross-origin GET — needs the bucket CORS config; see infra).
      const contentType = response.headers.get('content-type') || '';
      let blob;
      if (contentType.includes('application/json')) {
        const { url } = await response.json();
        const fileResponse = await fetch(url);
        if (!fileResponse.ok) {
          console.error('Failed to download edit file from storage:', fileResponse.status);
          return;
        }
        blob = await fileResponse.blob();
      } else {
        blob = await response.blob();
      }
      // Carry GCS's Content-Type so a later re-upload (on filename change) sends the right
      // MIME type; the previous streamed path produced type: '' here.
      const fileToEdit = new File([blob], editFile.fileName, { type: blob.type });

      // Rehydrate your owners/tags state exactly as before.
      // Older documents can come back without an owners object (or with missing keys).
      const owners = editFile.owners || {};
      const dataVehicles = (owners.vehicles || []).map(v => `${v}`);
      const dataDrivers  = (owners.drivers  || []).map(d => `${d}`);
      const dataTrailers = (owners.trailers || []).map(t => `${t}`);
      const dataGroups   = (owners.groups   || []).map(g => `${g}`);

      if (dataGroups.length === 0) {
        setUploadType('uploadSelection');
        setSelections({
          vehicles: [...matchGeotabData(dataVehicles,'vehicles',geotabData,geotabAssets)],
          drivers:  [...matchGeotabData(dataDrivers,'drivers',geotabData,geotabAssets)],
          trailers: [...matchGeotabData(dataTrailers,'trailers',geotabData,geotabAssets)],
          groups:   [...formatOptions(dataGroups)],
        });
      } else {
        setUploadType('uploadGroup');
        const newGroupData = [...geotabData.groups];
        // Display-only collapse: if Company Group is among the stored groups, check just
        // it in the picker. uploadData below keeps the full stored list, so saving
        // without touching the tree preserves the file's tags exactly.
        newGroupData.forEach(g => setCheckedTrue(g, [...formatOptions(collapseCompanyGroup(dataGroups))]));
        setGeotabData({ ...geotabData, groups: newGroupData });
      }

      setUploadData({
        vehicles: [...matchGeotabData(dataVehicles,'vehicles',geotabData,geotabAssets)],
        drivers:  [...matchGeotabData(dataDrivers,'drivers',geotabData,geotabAssets)],
        trailers: [...matchGeotabData(dataTrailers,'trailers',geotabData,geotabAssets)],
        groups:   [...formatOptions(dataGroups)],
      });

      setUploadFiles([fileToEdit]);
      // Keep the originally-loaded file so a pending "Replace" can be undone without refetching.
      originalFileRef.current = fileToEdit;
      setFileReplaced(false);
      setReplaceOpen(false);

      // Extract extension and filename separately
      const lastDotIndex = editFile.fileName.lastIndexOf('.');
      const nameWithoutExt = lastDotIndex > 0 ? editFile.fileName.substring(0, lastDotIndex) : editFile.fileName;
      const ext = lastDotIndex > 0 ? editFile.fileName.substring(lastDotIndex) : '';

      setEditName(nameWithoutExt);
      setFileExtension(ext);
      originalExtRef.current = ext;

      if (editFile.expiryDate) {
        setExpiryDate(dayjs(editFile.expiryDate));
      } else {
        setExpiryDate(null);
      }

            setAlertEmail(editFile.alertEmail || '');
                        setDriverCanView(editFile.hideFromDriver ? false : true);
      // A stored type the admin has since removed from the list would render as a blank
      // Select; keep it selectable so saving an unrelated change doesn't silently drop it.
      setDocumentType(editFile.documentType || '');
      setDescription(editFile.description || '');

 
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

    // Bring the result/validation message into view as soon as it is set.
    useEffect(() => {
        if ((error || success) && alertRef.current) {
            alertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [error, success]);

    const sectionCardSx = {
        width: '100%',
        minWidth: 0,
        maxWidth: 720,
        mx: 'auto',
        mt: 1.25,
        p: 1.5,
        border: '1px solid #e8edf3',
        borderRadius: '14px',
        bgcolor: '#fff',
        boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
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
                    accept={ACCEPTED_FILE_ACCEPT}
                    multiple
                />
                    
                </>
            ) : (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        width: '100%',
                        mt: 0.5,
                    }}
                >
                    {/* Thumbnail beside the name, not above it — stacking cost about a
                        hundred vertical pixels for a preview that reads fine small. */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, width: '100%' }}>
                        {imagePreviewUrl ? (
                            <Box
                                component="img"
                                src={imagePreviewUrl}
                                alt={editName}
                                sx={{
                                    width: 52,
                                    height: 52,
                                    flexShrink: 0,
                                    objectFit: 'cover',
                                    borderRadius: '10px',
                                    border: '1px solid #e5e7eb',
                                    bgcolor: '#f8fafc',
                                }}
                            />
                        ) : null}
                        <TextField
                            label="File Name"
                            variant="outlined"
                            size="small"
                            value={editName}
                            sx={{ flex: 1, minWidth: 0 }}
                            onChange={(e) => setEditName(e.target.value)}
                        />
                        <Typography sx={{ fontWeight: 'bold', minWidth: 'fit-content' }}>
                            {fileExtension}
                        </Typography>
                    </Box>

                    {/* Replace file: swap in a new version (e.g. a renewed document) without
                        losing this record, its associations, or alert settings. Folded behind
                        a link — most edits only touch the name, dates or associations. */}
                    <Box sx={{ width: '100%', mt: replaceOpen || fileReplaced ? 1 : 0 }}>
                        {!fileReplaced ? (
                            /* Collapsed, the Replace link lives on the visibility row below. */
                            !replaceOpen ? null : (
                            <>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                    <Typography sx={sectionTitleSx}>Replace file (optional)</Typography>
                                    <Button
                                        size="small"
                                        onClick={() => setReplaceOpen(false)}
                                        sx={{ textTransform: 'none', fontWeight: 600, color: '#64748b', flexShrink: 0 }}
                                    >
                                        Cancel
                                    </Button>
                                </Box>
                                <Box sx={{ mt: 0.75 }}>
                                    <FileDropzone
                                        files={[]}
                                        onChange={handleReplaceFile}
                                        accept={ACCEPTED_FILE_ACCEPT}
                                        multiple={false}
                                    />
                                </Box>
                                <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mt: 0.5, textAlign: 'center' }}>
                                    Upload a new version to replace the current file. The document keeps its associations and alert settings — set the new expiry date below.
                                </Typography>
                            </>
                            )
                        ) : (
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 1.5,
                                    border: '1px solid #bfdbfe',
                                    bgcolor: '#eff6ff',
                                    borderRadius: '12px',
                                    px: 1.75,
                                    py: 1.25,
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                    <SwapHorizIcon sx={{ color: '#26477C', flexShrink: 0 }} fontSize="small" />
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#26477C', lineHeight: 1.3 }}>
                                            New file will replace the current one on save
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{ color: '#475569', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: { xs: 180, sm: 320 } }}
                                        >
                                            {uploadFiles[0]?.name || 'New file selected'}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Button
                                    size="small"
                                    onClick={handleUseOriginalFile}
                                    sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0, color: '#334155' }}
                                >
                                    Use original
                                </Button>
                            </Box>
                        )}
                    </Box>
                </Box>
            )}

            {/* What this document is, from the fleet's own list, plus an optional note.
                Hidden entirely when no types are configured — an empty dropdown helps
                nobody, and the field is optional from the web app either way. */}
            {documentTypes.length > 0 || documentType || onAddDocumentType ? (
                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        gap: 1.25,
                        mt: 1,
                    }}
                >
                    <Autocomplete
                        size="small"
                        // A type stored on this file that the admin has since removed from
                        // the list still appears, so saving cannot silently drop it.
                        options={
                            documentType && !documentTypes.includes(documentType)
                                ? [documentType, ...documentTypes]
                                : documentTypes
                        }
                        value={documentType || null}
                        disabled={addingType}
                        onChange={async (e, picked) => {
                            setTypeError('');
                            if (picked && typeof picked === 'object' && picked.addNew) {
                                // Chose "Add …": create it on the fleet before selecting it,
                                // so what gets saved on the document is a type that exists.
                                setAddingType(true);
                                try {
                                    await onAddDocumentType(picked.value);
                                    setDocumentType(picked.value);
                                } catch (err) {
                                    setTypeError(err.message || 'Could not add that type.');
                                } finally {
                                    setAddingType(false);
                                }
                                return;
                            }
                            setDocumentType(picked || '');
                        }}
                        getOptionLabel={(option) =>
                            typeof option === 'string' ? option : `Add “${option.value}”`
                        }
                        isOptionEqualToValue={(option, value) => option === value}
                        filterOptions={(options, params) => {
                            const needle = params.inputValue.trim();
                            const filtered = options.filter((o) =>
                                o.toLowerCase().includes(needle.toLowerCase())
                            );
                            const exists = options.some(
                                (o) => o.toLowerCase() === needle.toLowerCase()
                            );
                            // Offer to create it only when it is genuinely new.
                            if (needle && !exists && onAddDocumentType) {
                                filtered.push({ addNew: true, value: needle });
                            }
                            return filtered;
                        }}
                        renderOption={(props, option) => (
                            <Box
                                component="li"
                                {...props}
                                key={typeof option === 'string' ? option : `add-${option.value}`}
                                sx={
                                    typeof option === 'string'
                                        ? undefined
                                        : { fontWeight: 700, color: '#26477C' }
                                }
                            >
                                {typeof option === 'string' ? option : `Add “${option.value}”`}
                            </Box>
                        )}
                        sx={{ width: { xs: '100%', sm: 260 }, flexShrink: 0 }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Document type"
                                placeholder={onAddDocumentType ? 'Select or type a new one…' : 'Select…'}
                                error={!!typeError}
                                helperText={typeError || ' '}
                                InputProps={{
                                    ...params.InputProps,
                                    startAdornment: (
                                        <>
                                            <InputAdornment position="start" sx={{ ml: 0.5, mr: 0 }}>
                                                <LabelOutlinedIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                                            </InputAdornment>
                                            {params.InputProps.startAdornment}
                                        </>
                                    ),
                                    endAdornment: (
                                        <>
                                            {addingType ? <CircularProgress size={16} /> : null}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
                                }}
                            />
                        )}
                    />
                    <TextField
                        size="small"
                        label="Notes (optional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        fullWidth
                        inputProps={{ maxLength: 500 }}
                    />
                </Box>
            ) : null}

            {/* Driver visibility — shown for both new uploads and edits. While editing it
                shares its row with the Replace link, which keeps the dialog short enough
                not to scroll. */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    gap: 1,
                    mt: 0.75,
                }}
            >
                {editMode && !replaceOpen && !fileReplaced && (
                    <Button
                        size="small"
                        onClick={() => setReplaceOpen(true)}
                        startIcon={<SwapHorizIcon fontSize="small" />}
                        sx={{ textTransform: 'none', fontWeight: 600, color: '#26477C', flexShrink: 0 }}
                    >
                        Replace file
                    </Button>
                )}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        px: 2,
                        py: 0.5,
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
                    gap: '0.5rem',
                }}
            >
                <Box sx={sectionCardSx}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 1.5,
                        width: '100%',
                        minWidth: 0,
                    }}
                >
                <Typography sx={{ ...sectionTitleSx, width: 'auto', flexShrink: 0 }}>
                    Associations
                </Typography>
                <RadioGroup
                    row
                    name="row-radio-buttons-group"
                    onChange={handleUpdateUploadType}
                    value={uploadType}
                    sx={{ justifyContent: 'center', gap: 3, mb: 0, flex: 1 }}
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
                </Box>

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
                            display: 'grid',
                            // 210px is the width at which a selected chip and the dropdown
                            // arrow sit on ONE line. Below it the caret wraps and the field
                            // grows an empty band; so in the narrow edit dialog these fall
                            // to two roomy columns rather than three cramped ones, while
                            // the wide upload dialog still fits all three side by side.
                            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                            gap: 1.25,
                            px: 0,
                        }}
                    >
                        <AssociateSelect
                            options={geotabData.vehicles}
                            label="Vehicle"
                            dataKey="vehicles"
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
                            dataKey="drivers"
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
                            dataKey="trailers"
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

                <Box sx={{ ...sectionCardSx, mb: 1 }}>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            alignItems: 'flex-start',
                            gap: 1.5,
                            width: '100%',
                            minWidth: 0,
                        }}
                    >
                    <Typography
                        sx={{
                            ...sectionTitleSx,
                            width: 'auto',
                            flexShrink: 0,
                            // Sits on the centre line of the 40px fields beside it, rather
                            // than the centre of a block made taller by their helper text.
                            mt: '12px',
                        }}
                    >
                        Expiration (optional)
                    </Typography>
                    <Box
                        sx={{
                            // `width: 100%` here would claim the whole row and push the
                            // inline heading onto a line of its own; take what is left instead.
                            width: 'auto',
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'flex-start',
                            justifyContent: 'flex-start',
                            gap: 1.25,
                        }}
                    >
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                                label="File Expire Date"
                                value={expiryDate}
                                format="DD/MMM/YYYY"
                                onChange={(newValue) => {
                                    setExpiryDate(newValue);
                                }}
                                slotProps={{
                                    textField: {
                                        size: 'small',
                                        // The clear X is hover-only by default on desktop; keep it
                                        // visible whenever a date is set.
                                        sx: { '& .clearButton': { opacity: 1 } },
                                    },
                                    // Shows an in-field clear (X) only when a date is set.
                                    field: { clearable: true, onClear: () => setExpiryDate(null) },
                                    // The mobile picker's field is read-only (no in-field X), so
                                    // Clear must be offered in its dialog's action bar instead.
                                    actionBar: ({ wrapperVariant }) => ({
                                        actions:
                                            wrapperVariant === 'mobile'
                                                ? ['clear', 'cancel', 'accept']
                                                : [],
                                    }),
                                }}
                            />
                        </LocalizationProvider>
                        {expiryDate ? (
                            <EmailChipsInput
                                value={splitEmails(alertEmail)}
                                onChange={(emails) => setAlertEmail(emails.join(', '))}
                                label="Expiration alert emails"
                                placeholder={splitEmails(alertEmail).length ? '' : 'Add email…'}
                                rejectEmails={splitEmails(globalAlertEmail)}
                                rejectMessage={(emails) =>
                                    `${emails.join(', ')} is the global default — it already gets every alert, so it isn't added per file.`
                                }
                                helperText={
                                    globalAlertEmailDisplay
                                        ? splitEmails(alertEmail).length
                                            ? `Overrides the default (${globalAlertEmailDisplay}) for this file.`
                                            : `Default: ${globalAlertEmailDisplay} — emails added here override the default for this file.`
                                        : 'Press Space or Enter after each address.'
                                }
                                sx={{
                                    // Grows into whatever is left rather than claiming a
                                    // fixed width the dialog may not have.
                                    flex: '1 1 220px',
                                    minWidth: 0,
                                }}
                            />
                        ) : null}
                    </Box>
                    </Box>
                    {!expiryDate && (
                        <Typography variant="caption" sx={{ color: '#64748b', textAlign: 'center' }}>
                            Set a date to get alert emails before this document expires.
                        </Typography>
                    )}
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
                                        onClick={() => setDeleteConfirm(true)}
                                        startIcon={<DeleteOutlineIcon />}
                                        sx={{
                                            textTransform: 'none',
                                            fontWeight: 600,
                                            borderRadius: '10px',
                                            px: 3,
                                            borderColor: '#fecdd3',
                                            color: '#E11D48',
                                            '&:hover': { borderColor: '#E11D48', bgcolor: 'rgba(225, 29, 72, 0.04)' },
                                        }}
                                    >
                                        Delete
                                    </Button>
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
                                                {editFile?.fileName || ''}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                            {deleteLoad ? (
                                                <Spinner />
                                            ) : (
                                                <>
                                                    <Button
                                                        variant="contained"
                                                        color="error"
                                                        onClick={handleDeleteFile}
                                                        sx={{ textTransform: 'none', borderRadius: '10px', px: 3 }}
                                                    >
                                                        Delete
                                                    </Button>
                                                    <Button
                                                        variant="outlined"
                                                        onClick={() => setDeleteConfirm(false)}
                                                        sx={{ textTransform: 'none', borderRadius: '10px', px: 3 }}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </>
                                            )}
                                        </Box>
                                    </Popup>
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

                <Box ref={alertRef} sx={{ width: '100%', display: 'flex', justifyContent: 'center', px: 2, scrollMarginTop: '16px' }}>
                    {error !== '' && (
                        <Alert
                            severity="error"
                            sx={{
                                borderRadius: '10px',
                                width: '100%',
                                maxWidth: 520,
                                boxShadow: '0 4px 14px rgba(220,38,38,0.18)',
                                '& .MuiAlert-message': { fontSize: 14, lineHeight: 1.45 },
                            }}
                        >
                            <AlertTitle sx={{ fontWeight: 700, mb: 0.25 }}>{errorTitle || 'Can\'t continue yet'}</AlertTitle>
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
