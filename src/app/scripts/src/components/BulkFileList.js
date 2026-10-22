import React from 'react';
import { Autocomplete, Box, Chip, IconButton, MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CircularProgress from '@mui/material/CircularProgress';

import FileTypeGlyph from './FileTypeGlyph';
import { archivedLabel } from '../utils/formatter';

export const ASSET_KINDS = [
    { key: 'vehicles', label: 'Vehicles' },
    { key: 'drivers', label: 'Drivers' },
    { key: 'trailers', label: 'Trailers' },
];

export const emptyDetails = () => ({ documentType: '', vehicles: [], drivers: [], trailers: [], expiryDate: null, matched: [] });

export const hasAssets = (details) => ASSET_KINDS.some(({ key }) => details[key].length > 0);

const tokensOf = (text) =>
    String(text || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);

// Whether `needle` appears as consecutive whole words in `hay`.
const containsWords = (hay, needle) => {
    if (!needle.length) return false;
    for (let i = 0; i + needle.length <= hay.length; i++) {
        if (needle.every((t, j) => hay[i + j] === t)) return true;
    }
    return false;
};

// Pre-fills a file's details from its name: "Truck 104 - Registration.pdf" gets vehicle
// "Truck 104" and type "Registration". Whole words only, and names shorter than three
// characters are skipped, so a date like 2026-06-14 never picks vehicle "14". When a name
// fits more than two assets of one kind it is not telling us anything, so none are picked.
export const guessDetails = (filename, geotabData, documentTypes) => {
    const base = String(filename || '').replace(/\.[^.]+$/, '');
    const words = tokensOf(base);
    const details = emptyDetails();
    ASSET_KINDS.forEach(({ key }) => {
        const hits = (geotabData[key] || []).filter((o) => {
            if (o.archived) return false;
            const t = tokensOf(o.label);
            return t.join('').length >= 3 && containsWords(words, t);
        });
        if (hits.length > 0 && hits.length <= 2) {
            details[key] = hits;
            details.matched.push(key);
        }
    });
    const type = documentTypes.find((t) => containsWords(words, tokensOf(t)));
    if (type) {
        details.documentType = type;
        details.matched.push('documentType');
    }
    return details;
};

const AssetPicker = ({ kind, options, value, onChange, error }) => (
    <Autocomplete
        multiple
        size="small"
        limitTags={2}
        options={options}
        value={value}
        getOptionLabel={(o) => o.label}
        isOptionEqualToValue={(o, v) => o.value === v.value}
        filterSelectedOptions
        onChange={(e, next) => onChange(next)}
        renderTags={(tags, getTagProps) =>
            tags.map((o, index) => {
                const { key, ...tagProps } = getTagProps({ index });
                const label = o.archived ? `${o.label} (${archivedLabel(kind.key)})` : o.label;
                return <Chip key={key ?? o.value} {...tagProps} size="small" label={label} title={label} />;
            })
        }
        renderInput={(params) => <TextField {...params} label={kind.label} size="small" error={error} />}
        sx={{ '& .MuiAutocomplete-input': { minWidth: '4px !important' } }}
    />
);

const STATUS = {
    uploading: { icon: <CircularProgress size={14} />, text: 'Uploading…', color: '#26477C' },
    done: { icon: <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />, text: 'Uploaded', color: '#1B7A3D' },
    failed: { icon: <ErrorOutlineIcon sx={{ fontSize: 16 }} />, text: 'Failed', color: '#B91C1C' },
};

// One card per file, each with its own type, vehicles, drivers, trailers and expiry, for
// uploading a batch where every file belongs to something different.
const BulkFileList = ({
    files,
    detailsFor,
    onChangeDetails,
    onCopyToAll,
    onRemove,
    geotabData,
    documentTypes,
    showErrors,
    statusFor,
}) => (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {files.map((item, idx) => {
                const details = detailsFor(item);
                const status = statusFor(item);
                const missing = showErrors && !hasAssets(details) && status?.state !== 'done';
                const update = (patch) =>
                    onChangeDetails(item, {
                        ...details,
                        ...patch,
                        // Once the user touches a field it is theirs, not a guess.
                        matched: details.matched.filter((k) => !(k in patch)),
                    });
                const shown = status && STATUS[status.state];
                return (
                    <Box
                        key={`${item.filename}-${idx}`}
                        sx={{
                            border: '1px solid',
                            borderColor: missing || status?.state === 'failed' ? '#fca5a5' : '#e8edf3',
                            borderRadius: '12px',
                            p: 1.25,
                            bgcolor: status?.state === 'done' ? '#f6fbf7' : '#fff',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: '1 1 200px', minWidth: 0 }}>
                                <FileTypeGlyph fileName={item.filename} size={32} iconSize={18} radius={8} />
                                <Typography
                                    title={item.filename}
                                    sx={{ fontSize: 14, fontWeight: 600, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                >
                                    {item.filename}
                                </Typography>
                            </Box>
                            {documentTypes.length > 0 && (
                                <TextField
                                    select
                                    size="small"
                                    label="Type"
                                    value={details.documentType}
                                    onChange={(e) => update({ documentType: e.target.value })}
                                    sx={{ width: 170 }}
                                >
                                    <MenuItem value="">
                                        <em>None</em>
                                    </MenuItem>
                                    {documentTypes.map((t) => (
                                        <MenuItem key={t} value={t}>
                                            {t}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )}
                            <DatePicker
                                label="Expiry date"
                                value={details.expiryDate}
                                format="DD/MMM/YYYY"
                                onChange={(v) => update({ expiryDate: v })}
                                slotProps={{
                                    textField: { size: 'small', sx: { width: 175, '& .clearButton': { opacity: 1 } } },
                                    field: { clearable: true, onClear: () => update({ expiryDate: null }) },
                                }}
                            />
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {files.length > 1 && (
                                    <Tooltip title="Copy this file's details to every other file" arrow>
                                        <IconButton size="small" aria-label="Copy details to all files" onClick={() => onCopyToAll(item)}>
                                            <ContentCopyIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                <Tooltip title="Remove this file" arrow>
                                    <IconButton size="small" aria-label="Remove file" onClick={() => onRemove(item)}>
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 1 }}>
                            {ASSET_KINDS.map((kind) => (
                                <AssetPicker
                                    key={kind.key}
                                    kind={kind}
                                    options={geotabData[kind.key] || []}
                                    value={details[kind.key]}
                                    onChange={(next) => update({ [kind.key]: next })}
                                    error={missing}
                                />
                            ))}
                        </Box>
                        {(missing || shown || details.matched.length > 0) && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', fontSize: 12.5 }}>
                                {missing && (
                                    <Typography sx={{ fontSize: 12.5, color: '#B91C1C', fontWeight: 600 }}>
                                        Pick at least one vehicle, driver or trailer.
                                    </Typography>
                                )}
                                {shown && (
                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: shown.color, fontWeight: 600 }}>
                                        {shown.icon}
                                        {status.state === 'failed' && status.message ? `${shown.text}: ${status.message}` : shown.text}
                                    </Box>
                                )}
                                {details.matched.length > 0 && !shown && (
                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: '#64748b' }}>
                                        <AutoFixHighOutlinedIcon sx={{ fontSize: 15 }} />
                                        Filled in from the file name — check before uploading.
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Box>
                );
            })}
        </Box>
    </LocalizationProvider>
);

export default BulkFileList;
